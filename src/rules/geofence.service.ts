import { Inject, Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { AppEnv, ENV_TOKEN } from '../config/env';

/**
 * Geofence conforme o documento: uma posição só vira violação depois de considerar
 * precisão do GPS, margem externa, permanência mínima e leituras consecutivas.
 * O PostGIS calcula a relação espacial; quem decide a ação é o RulesService.
 */
@Injectable()
export class GeofenceService {
  constructor(@Inject(ENV_TOKEN) private readonly env: AppEnv) {}

  /** true quando as N últimas leituras do ativo, todas precisas, estão fora da margem de TODOS os polígonos. */
  async isSustainedViolation(client: PoolClient, farmId: string, assetId: string): Promise<boolean> {
    const n = this.env.geofenceConsecutiveReadings;
    const { rows } = await client.query(
      `WITH last AS (
         SELECT location, accuracy_m, occurred_at
           FROM sync_events
          WHERE farm_id = $1 AND type = 'position.reported' AND payload->>'assetId' = $2
          ORDER BY occurred_at DESC, id DESC
          LIMIT $3)
       SELECT count(*)::int AS total,
              count(*) FILTER (
                WHERE accuracy_m IS NOT NULL AND accuracy_m <= $4
                  AND NOT EXISTS (
                    SELECT 1 FROM plots p
                     WHERE p.farm_id = $1 AND ST_DWithin(p.boundary::geography, last.location, $5))
              )::int AS outside,
              COALESCE(EXTRACT(EPOCH FROM (max(occurred_at) - min(occurred_at))), 0)::float AS span_s
         FROM last`,
      [farmId, assetId, n, this.env.geofenceMaxAccuracyM, this.env.geofenceMarginM],
    );
    const r = rows[0];
    return r.total === n && r.outside === n && r.span_s >= this.env.geofenceMinDwellS;
  }

  /** Talhão/piquete que contém o ponto. Com GPS impreciso, não conclui (devolve null). */
  async findPlot(
    client: PoolClient,
    farmId: string,
    lat: number,
    lon: number,
    accuracyM: number | null,
  ): Promise<string | null> {
    if (accuracyM === null || accuracyM > this.env.geofenceMaxAccuracyM) return null;
    const { rows } = await client.query(
      `SELECT id FROM plots
        WHERE farm_id = $1 AND ST_Covers(boundary, ST_SetSRID(ST_MakePoint($2, $3), 4326))
        ORDER BY (kind = 'talhao') DESC, id
        LIMIT 1`,
      [farmId, lon, lat],
    );
    return rows[0]?.id ?? null;
  }
}
