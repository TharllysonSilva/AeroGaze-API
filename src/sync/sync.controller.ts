import { Body, Controller, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { FarmScopeService } from '../farms/farm-scope.service';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { SyncRequestDto } from './sync.dto';
import { SyncService } from './sync.service';

@Controller('v1/sync')
export class SyncController {
  constructor(
    private readonly sync: SyncService,
    private readonly db: DatabaseService,
    private readonly scope: FarmScopeService,
  ) {}

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
