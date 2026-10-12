import { Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { DatabaseService } from '../database/database.service';
import { FarmScopeService } from '../farms/farm-scope.service';

class ListQuery {
  @IsOptional() @IsUUID() farmId?: string;
  @IsOptional() @IsIn(['aberto', 'reconhecido', 'resolvido', 'pendente', 'em_progresso', 'concluida']) status?: string;
}
class AlertStatusDto {
  @IsIn(['aberto', 'reconhecido', 'resolvido']) status: string;
}
class TaskStatusDto {
  @IsIn(['pendente', 'em_progresso', 'concluida']) status: string;
}

/** Leituras que alimentam o Centro de Comando (Next.js) e o app: tudo com escopo de organização/fazenda. */
@Controller('v1')
export class OperationsController {
  constructor(private readonly db: DatabaseService, private readonly scope: FarmScopeService) {}

  private async resolveFarm(user: AuthUser, farmId?: string): Promise<string | null> {
    if (farmId) {
      await this.scope.assertFarm(user, farmId);
      return farmId;
    }
    return user.farmId; // preso a uma fazenda: só ela; senão null = todas da organização
  }

  @Get('alerts')
  async alerts(@CurrentUser() user: AuthUser, @Query() q: ListQuery) {
    const farm = await this.resolveFarm(user, q.farmId);
    const { rows } = await this.db.query(
      `SELECT id, farm_id, plot_id, rule, severity, title, details, status, created_at
         FROM alerts
        WHERE organization_id = $1 AND ($2::uuid IS NULL OR farm_id = $2) AND ($3::text IS NULL OR status = $3)
        ORDER BY created_at DESC LIMIT 200`,
      [user.organizationId, farm, q.status ?? null],
    );
    return rows;
  }

  @Get('tasks')
  async tasks(@CurrentUser() user: AuthUser, @Query() q: ListQuery) {
    const farm = await this.resolveFarm(user, q.farmId);
    const { rows } = await this.db.query(
      `SELECT id, farm_id, plot_id, alert_id, title, description, priority, status, created_at
         FROM tasks
        WHERE organization_id = $1 AND ($2::uuid IS NULL OR farm_id = $2) AND ($3::text IS NULL OR status = $3)
        ORDER BY created_at DESC LIMIT 200`,
      [user.organizationId, farm, q.status ?? null],
    );
    return rows;
  }

  @Get('events')
  @Roles('veterinario', 'gerente', 'auditor', 'administrador')
  async events(@CurrentUser() user: AuthUser, @Query() q: ListQuery) {
    const farm = await this.resolveFarm(user, q.farmId);
    const { rows } = await this.db.query(
      `SELECT id, farm_id, plot_id, device_id, type, occurred_at, received_at, payload
         FROM sync_events
        WHERE organization_id = $1 AND ($2::uuid IS NULL OR farm_id = $2)
        ORDER BY occurred_at DESC LIMIT 200`,
      [user.organizationId, farm],
    );
    return rows;
  }

  @Patch('alerts/:id/status')
  @Roles('veterinario', 'gerente', 'administrador')
  async setAlertStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AlertStatusDto,
  ) {
    const { rows } = await this.db.query(
      `UPDATE alerts SET status = $3
        WHERE id = $1 AND organization_id = $2 AND ($4::uuid IS NULL OR farm_id = $4)
        RETURNING id, status`,
      [id, user.organizationId, dto.status, user.farmId],
    );
    if (!rows[0]) throw new NotFoundException('alerta não encontrado');
    await this.db.query(
      `INSERT INTO audit_log (organization_id, user_id, action, entity, entity_id, details)
       VALUES ($1,$2,'alert.status','alert',$3,$4)`,
      [user.organizationId, user.id, id, JSON.stringify({ status: dto.status })],
    );
    return rows[0];
  }

  @Patch('tasks/:id/status')
  async setTaskStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TaskStatusDto,
  ) {
    const { rows } = await this.db.query(
      `UPDATE tasks SET status = $3
        WHERE id = $1 AND organization_id = $2 AND ($4::uuid IS NULL OR farm_id = $4)
        RETURNING id, status`,
      [id, user.organizationId, dto.status, user.farmId],
    );
    if (!rows[0]) throw new NotFoundException('tarefa não encontrada');
    await this.db.query(
      `INSERT INTO audit_log (organization_id, user_id, action, entity, entity_id, details)
       VALUES ($1,$2,'task.status','task',$3,$4)`,
      [user.organizationId, user.id, id, JSON.stringify({ status: dto.status })],
    );
    return rows[0];
  }
}
