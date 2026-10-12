import { Body, ConflictException, Controller, Get, Module, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { randomUUID } from 'crypto';
import { CurrentUser, Roles } from '../auth/decorators';
import { AuthUser } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import { FarmsModule } from '../farms/farms.module';
import { FarmScopeService } from '../farms/farm-scope.service';
import { applyCommand, Command, COMMANDS, initialScenario, Scenario, scenarioTelemetry } from './scenario';

class ActionDto {
  @IsUUID('4') id: string;
  @IsIn(COMMANDS) command: Command;
  @IsOptional() @IsString() @MaxLength(64) target?: string;
}
@Controller('v1/demo/farms')
export class DemoController {
  constructor(private readonly db:DatabaseService,private readonly scope:FarmScopeService){}
  private async snapshot(farmId:string,state:Scenario) {
    const {rows:plots}=await this.db.query('SELECT id,name,kind,ST_AsGeoJSON(boundary)::json AS boundary FROM plots WHERE farm_id=$1 ORDER BY name',[farmId]);
    return {farmId,state,plots,telemetry:scenarioTelemetry(state,plots)};
  }
  @Get(':farmId')
  async read(@CurrentUser() user:AuthUser,@Param('farmId',ParseUUIDPipe) farmId:string) {
    await this.scope.assertFarm(user,farmId);
    const {rows}=await this.db.query('SELECT state FROM demo_scenarios WHERE farm_id=$1 AND organization_id=$2',[farmId,user.organizationId]);
    return this.snapshot(farmId,rows[0]?.state??initialScenario());
  }
  @Post(':farmId/actions')
  @Roles('operador','veterinario','gerente','administrador')
  async action(@CurrentUser() user:AuthUser,@Param('farmId',ParseUUIDPipe) farmId:string,@Body() dto:ActionDto) {
    await this.scope.assertFarm(user,farmId);
    return this.db.tx(async client=>{
      // Serialize ações de uma fazenda, inclusive seu primeiro acesso.
      await client.query('SELECT id FROM farms WHERE id=$1 AND organization_id=$2 FOR UPDATE',[farmId,user.organizationId]);
      const prior=await client.query('SELECT * FROM demo_actions WHERE id=$1',[dto.id]);
      if(prior.rows[0]) {
        const p=prior.rows[0];
        if(p.farm_id!==farmId||p.organization_id!==user.organizationId||p.user_id!==user.id||p.command!==dto.command||(p.target??null)!==(dto.target??null))throw new ConflictException('Identidade de ação já usada com outro conteúdo');
        return {...p.response,duplicate:true};
      }
      const current=await client.query('SELECT state FROM demo_scenarios WHERE farm_id=$1',[farmId]);
      const state:Scenario=current.rows[0]?.state??initialScenario();
      const label=applyCommand(state,dto.command,dto.target);
      state.history[0].eventId=dto.id;
      await client.query(`INSERT INTO demo_scenarios(farm_id,organization_id,state) VALUES($1,$2,$3)
        ON CONFLICT(farm_id) DO UPDATE SET state=EXCLUDED.state,updated_at=now()`,[farmId,user.organizationId,JSON.stringify(state)]);
      const device=`demo-${farmId}`;
      await client.query('INSERT INTO devices(id,organization_id,farm_id,name) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING',[device,user.organizationId,farmId,'Simulador de operação do hackathon']);
      const asset=dto.target??(dto.command.startsWith('drone.')?'AERO-01':dto.command.startsWith('stock.')?'ESTOQUE-01':dto.command.startsWith('support.')?'COMANDO-01':dto.command.startsWith('pest.')?'CULTURA-01':'IRR-01');
      const payload={simulated:true,command:dto.command,assetId:asset,label,scenarioVersion:state.version};
      await client.query(`INSERT INTO sync_events(id,organization_id,farm_id,device_id,type,schema_version,occurred_at,payload)
        VALUES($1,$2,$3,$4,'demo.action_recorded',1,now(),$5)`,[dto.id,user.organizationId,farmId,device,JSON.stringify(payload)]);
      await client.query("INSERT INTO outbox(topic,aggregate_id,data) VALUES('event.accepted',$1,$2)",[dto.id,JSON.stringify({farmId,organizationId:user.organizationId})]);
      let taskId:string|null=null;
      if(['irrigation.fail','pest.detect','support.request'].includes(dto.command)) {
        const key=`demo:${farmId}:${dto.command}`;
        const alert=await client.query(`INSERT INTO alerts(organization_id,farm_id,source_event_id,rule,severity,title,details,dedupe_key)
          VALUES($1,$2,$3,'demo_operational','alta',$4,$5,$6) ON CONFLICT(dedupe_key) WHERE dedupe_key IS NOT NULL AND status='aberto'
          DO NOTHING RETURNING id`,[user.organizationId,farmId,dto.id,label,JSON.stringify(payload),key]);
        if(alert.rows[0]) {
          taskId=randomUUID();
          await client.query(`INSERT INTO tasks(id,organization_id,farm_id,alert_id,source_event_id,title,description,priority)
            VALUES($1,$2,$3,$4,$5,$6,'Cenário simulado: executar a ação correspondente e conferir telemetria.','alta')`,[taskId,user.organizationId,farmId,alert.rows[0].id,dto.id,label]);
        }
      }
      const cause=dto.command==='irrigation.repair'?'irrigation.fail':dto.command==='pest.resolve'?'pest.detect':null;
      if(cause) {
        const alerts=await client.query("UPDATE alerts SET status='resolvido' WHERE organization_id=$1 AND farm_id=$2 AND dedupe_key=$3 AND status<>'resolvido' RETURNING id",[user.organizationId,farmId,`demo:${farmId}:${cause}`]);
        for(const alert of alerts.rows)await client.query("UPDATE tasks SET status='concluida' WHERE organization_id=$1 AND farm_id=$2 AND alert_id=$3",[user.organizationId,farmId,alert.id]);
      }
      const response={id:dto.id,eventId:dto.id,taskId,label,state,simulated:true};
      await client.query('INSERT INTO demo_actions(id,organization_id,farm_id,user_id,command,target,response) VALUES($1,$2,$3,$4,$5,$6,$7)',[dto.id,user.organizationId,farmId,user.id,dto.command,dto.target??null,JSON.stringify(response)]);
      await client.query("INSERT INTO audit_log(organization_id,user_id,action,entity,entity_id,details) VALUES($1,$2,'demo.action','farm',$3,$4)",[user.organizationId,user.id,farmId,JSON.stringify({id:dto.id,command:dto.command,target:dto.target,simulated:true})]);
      return response;
    });
  }
}
@Module({imports:[FarmsModule],controllers:[DemoController]})
export class DemoModule {}
