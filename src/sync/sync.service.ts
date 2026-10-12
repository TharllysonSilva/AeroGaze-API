import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { PoolClient } from 'pg';
import { AuthUser } from '../auth/auth.types';
import { AppEnv, ENV_TOKEN } from '../config/env';
import { DatabaseService } from '../database/database.service';
import { FarmScopeService } from '../farms/farm-scope.service';
import { GeofenceService } from '../rules/geofence.service';
import { RulesService } from '../rules/rules.service';
import { EventAck, SyncEventDto, SyncRequestDto } from './sync.dto';

class Rejection extends Error {}

interface Location {
  lat: number;
  lon: number;
  accuracyM: number | null;
}

@Injectable()
export class SyncService {
  private readonly log = new Logger(SyncService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly scope: FarmScopeService,
    private readonly rules: RulesService,
    private readonly geofence: GeofenceService,
    @Inject(ENV_TOKEN) private readonly env: AppEnv,
  ) {}

  /**
   * Recebe um lote de eventos do aparelho. Cada evento tem a SUA transação e o SEU recibo:
   * um evento ruim não derruba os outros, e reenviar o lote inteiro é seguro (idempotente).
   * O app só deve marcar "Sincronizado" o que voltar como accepted ou duplicate.
   */
  async ingest(user: AuthUser, req: SyncRequestDto) {
    await this.scope.assertFarm(user, req.farmId);
    await this.ensureDevice(user, req.farmId, req.deviceId);

    const acks: EventAck[] = [];
    for (const ev of req.events) {
      acks.push(await this.processOne(user, req, ev));
    }

    const summary = {
      accepted: acks.filter((a) => a.status === 'accepted').length,
      duplicate: acks.filter((a) => a.status === 'duplicate').length,
      rejected: acks.filter((a) => a.status === 'rejected').length,
    };
    await this.db.query(
      `INSERT INTO audit_log (organization_id, user_id, device_id, action, entity, entity_id, details)
       VALUES ($1,$2,$3,'sync.batch','farm',$4,$5)`,
      [user.organizationId, user.id, req.deviceId, req.farmId, JSON.stringify(summary)],
    );
    return { acks, summary, serverTime: new Date().toISOString() };
  }

  private async ensureDevice(user: AuthUser, farmId: string, deviceId: string) {
    const { rows } = await this.db.query(
      `SELECT organization_id, farm_id, revoked_at FROM devices WHERE id = $1`,
      [deviceId],
    );
    const dev = rows[0];
    if (!dev) {
      if (!this.env.autoRegisterDevices) throw new ForbiddenException('aparelho não cadastrado');
      await this.db.query(
        `INSERT INTO devices (id, organization_id, farm_id, name) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING`,
        [deviceId, user.organizationId, farmId, `auto-${deviceId}`],
      );
      return;
    }
    if (dev.organization_id !== user.organizationId || dev.farm_id !== farmId) {
      throw new ForbiddenException('aparelho pertence a outra fazenda');
    }
    if (dev.revoked_at) throw new ForbiddenException('aparelho revogado');
  }

  private parseLocation(payload: Record<string, any>): Location | null {
    const loc = payload?.location;
    if (loc === undefined || loc === null) return null;
    const lat = Number(loc.lat);
    const lon = Number(loc.lon);
    const acc = loc.accuracyM === undefined || loc.accuracyM === null ? null : Number(loc.accuracyM);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      throw new Rejection('location inválida (lat/lon fora do intervalo)');
    }
    if (acc !== null && (!Number.isFinite(acc) || acc < 0)) throw new Rejection('accuracyM inválida');
    return { lat, lon, accuracyM: acc };
  }

  private async processOne(user: AuthUser, req: SyncRequestDto, ev: SyncEventDto): Promise<EventAck> {
    try {
      const occurred = new Date(ev.occurredAt);
      if (occurred.getTime() > Date.now() + 5 * 60_000) throw new Rejection('occurredAt no futuro');
      const location = this.parseLocation(ev.payload);

      const status = await this.db.tx((client) => this.persist(client, user, req, ev, occurred, location));
      return { id: ev.id, status };
    } catch (err) {
      if (err instanceof Rejection) return { id: ev.id, status: 'rejected', reason: err.message };
      this.log.error(`erro ao processar evento ${ev.id}: ${(err as Error).message}`);
      return { id: ev.id, status: 'rejected', reason: 'erro interno ao processar' };
    }
  }

  private async persist(
    client: PoolClient,
    user: AuthUser,
    req: SyncRequestDto,
    ev: SyncEventDto,
    occurred: Date,
    location: Location | null,
  ): Promise<'accepted' | 'duplicate'> {
    const plotId = location
      ? await this.geofence.findPlot(client, req.farmId, location.lat, location.lon, location.accuracyM)
      : null;

    // A idempotência é o próprio índice único: o mesmo UUID nunca entra duas vezes.
    const inserted = await client.query(
      `INSERT INTO sync_events
         (id, organization_id, farm_id, plot_id, device_id, type, schema_version, occurred_at, payload, location, accuracy_m)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,
               CASE WHEN $10::float8 IS NULL THEN NULL
                    ELSE ST_SetSRID(ST_MakePoint($10::float8, $11::float8), 4326)::geography END,
               $12)
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [
        ev.id,
        user.organizationId,
        req.farmId,
        plotId,
        req.deviceId,
        ev.type,
        ev.schemaVersion,
        occurred,
        JSON.stringify(ev.payload),
        location?.lon ?? null,
        location?.lat ?? null,
        location?.accuracyM ?? null,
      ],
    );

    if (inserted.rowCount === 0) {
      // Já existia. Se for de OUTRA organização, não confirma (não vaza nem aceita).
      const existing = await client.query(`SELECT organization_id FROM sync_events WHERE id = $1`, [ev.id]);
      if (existing.rows[0]?.organization_id !== user.organizationId) throw new Rejection('id de evento em conflito');
      return 'duplicate'; // nenhum efeito colateral repetido: sem novo alerta, tarefa ou outbox
    }

    await client.query(
      `INSERT INTO outbox (topic, aggregate_id, data) VALUES ('event.accepted', $1, $2)`,
      [ev.id, JSON.stringify({ farmId: req.farmId, type: ev.type })],
    );

    await this.rules.evaluate(client, {
      eventId: ev.id,
      organizationId: user.organizationId,
      farmId: req.farmId,
      plotId,
      type: ev.type,
      payload: ev.payload,
    });
    return 'accepted';
  }
}
