import { Body, Controller, ForbiddenException, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { FarmScopeService } from '../farms/farm-scope.service';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { RegisterFlutterDeviceDto, SyncRequestDto } from './sync.dto';
import { SyncService } from './sync.service';

@Controller('v1/sync')
export class SyncController {
  constructor(
    private readonly sync: SyncService,
    private readonly db: DatabaseService,
    private readonly scope: FarmScopeService,
  ) {}

  /** Cadastro explícito; revogação e propriedade anteriores nunca são substituídas. */
  @Post('devices')
  @HttpCode(200)
  @Roles('gerente', 'administrador')
  async registerDevice(@CurrentUser() user: AuthUser, @Body() body: RegisterFlutterDeviceDto) {
    await this.scope.assertFarm(user, body.farmId);
    return this.db.tx(async client => {
      const inserted = await client.query(
        `INSERT INTO devices (id,organization_id,farm_id,name) VALUES ($1,$2,$3,'Flutter')
         ON CONFLICT (id) DO NOTHING RETURNING id`, [body.deviceId,user.organizationId,body.farmId]);
      const { rows } = await client.query('SELECT organization_id,farm_id,revoked_at FROM devices WHERE id=$1 FOR UPDATE', [body.deviceId]);
      const device = rows[0];
      if (!device || device.organization_id !== user.organizationId || device.farm_id !== body.farmId || device.revoked_at) {
        throw new ForbiddenException('aparelho revogado ou vinculado a outro escopo');
      }
      if (inserted.rowCount) await client.query(
        `INSERT INTO audit_log (organization_id,user_id,action,entity,entity_id,details)
         VALUES ($1,$2,'device.register','device',$3,$4)`,
        [user.organizationId,user.id,body.deviceId,JSON.stringify({farmId:body.farmId})]);
      return { deviceId: body.deviceId, farmId: body.farmId, registered: true };
    });
  }

  /** Recibo autenticado: relaciona o UUID do aparelho às tarefas e ao lote, sem reenviar. */
  @Get('events/:eventId/receipt')
  async receipt(@CurrentUser() user: AuthUser, @Param('eventId', ParseUUIDPipe) eventId: string) {
    const { rows } = await this.db.query(
      `SELECT id, farm_id FROM sync_events WHERE id = $1 AND organization_id = $2`,
      [eventId, user.organizationId],
    );
    if (!rows[0]) throw new NotFoundException('evento não encontrado');
    await this.scope.assertFarm(user, rows[0].farm_id);
    const [tasks, batches] = await Promise.all([
      this.db.query(
        `SELECT id, title, status FROM tasks WHERE source_event_id = $1 AND organization_id = $2 ORDER BY created_at`,
        [eventId, user.organizationId],
      ),
      this.db.query(
        `SELECT b.id, b.status, b.anchor_mode, b.chain_id, b.tx_ref, b.block_number
           FROM proof_batch_items i JOIN proof_batches b ON b.id = i.batch_id
          WHERE i.event_id = $1 AND b.organization_id = $2 ORDER BY b.created_at DESC LIMIT 1`,
        [eventId, user.organizationId],
      ),
    ]);
    return { eventId, ingestion: 'accepted', tasks: tasks.rows, batch: batches.rows[0] ?? null };
  }

  /**
   * Endpoint que o outbox do Flutter (Drift) chama quando a rede volta.
   * Sempre 200 com um recibo POR EVENTO; o status HTTP não diz nada sobre cada evento.
   */
  @Post('events')
  @HttpCode(200)
  @Roles('operador', 'veterinario', 'gerente', 'administrador')
  events(@CurrentUser() user: AuthUser, @Body() body: SyncRequestDto) {
    return this.sync.ingest(user, body);
  }
}
