import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppEnv, ENV_TOKEN } from '../config/env';
import { DatabaseService } from '../database/database.service';
import { ANCHOR_SERVICE, AnchorService } from './anchor.service';
import { eventLeafData } from './event-leaf';
import { leafHash, merkleRoot, toHex } from './merkle';

const MAX_ATTEMPTS = 12;

@Injectable()
export class BatchService {
  private readonly log = new Logger(BatchService.name);

  constructor(
    private readonly db: DatabaseService,
    @Inject(ENV_TOKEN) private readonly env: AppEnv,
    @Inject(ANCHOR_SERVICE) private readonly anchorService: AnchorService,
  ) {}

  /**
   * Lê eventos novos do outbox, agrupa por fazenda e monta um lote (árvore de Merkle) por grupo.
   * Tudo em uma transação: ou o lote existe e o outbox é marcado como processado, ou nada muda.
   */
  async buildBatches(): Promise<number> {
    // Política de custo: cada lote vira UMA transação na rede (e custa gás). Só fecha o lote quando
    // há eventos suficientes OU o evento mais antigo já esperou o tempo máximo.
    const stats = await this.db.query(
      `SELECT count(*)::int AS n, min(created_at) AS oldest
         FROM outbox WHERE topic = 'event.accepted' AND processed_at IS NULL`,
    );
    const { n, oldest } = stats.rows[0];
    if (n === 0) return 0;
    const ageMin = (Date.now() - new Date(oldest).getTime()) / 60_000;
    if (n < this.env.batchMinEvents && ageMin < this.env.batchMaxAgeMin) return 0;

    return this.db.tx(async (client) => {
      const pending = await client.query(
        `SELECT id, aggregate_id FROM outbox
          WHERE topic = 'event.accepted' AND processed_at IS NULL
          ORDER BY id
          LIMIT $1
          FOR UPDATE SKIP LOCKED`,
        [this.env.batchMaxEvents],
      );
      if (pending.rowCount === 0) return 0;

      const ids = pending.rows.map((r) => r.aggregate_id);
      const events = await client.query(
        `SELECT id, organization_id, farm_id, device_id, type, schema_version, occurred_at, payload
           FROM sync_events
          WHERE id = ANY($1::uuid[])
          ORDER BY farm_id, occurred_at, id`,
        [ids],
      );

      const byFarm = new Map<string, typeof events.rows>();
      for (const e of events.rows) {
        const list = byFarm.get(e.farm_id) ?? [];
        list.push(e);
        byFarm.set(e.farm_id, list);
      }

      let created = 0;
      for (const [farmId, list] of byFarm) {
        const leaves = list.map((e) => leafHash(eventLeafData(e)));
        const root = toHex(merkleRoot(leaves));
        const batch = await client.query(
          `INSERT INTO proof_batches (organization_id, farm_id, merkle_root, leaf_count)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [list[0].organization_id, farmId, root, list.length],
        );
        const batchId = batch.rows[0].id;
        for (let i = 0; i < list.length; i++) {
          await client.query(
            `INSERT INTO proof_batch_items (batch_id, position, event_id, leaf) VALUES ($1,$2,$3,$4)`,
            [batchId, i, list[i].id, toHex(leaves[i])],
          );
        }
        created++;
      }

      await client.query(`UPDATE outbox SET processed_at = now() WHERE id = ANY($1::bigint[])`, [
        pending.rows.map((r) => r.id),
      ]);
      return created;
    });
  }

  /**
   * Ancora lotes pendentes. Falha de rede NUNCA derruba a operação da fazenda:
   * o lote fica pendente e é tentado de novo com espera crescente.
   */
  async anchorPending(): Promise<number> {
    // "Reserva" os lotes por 5 min para dois workers não pegarem o mesmo.
    const claimed = await this.db.query(
      `UPDATE proof_batches SET next_attempt_at = now() + interval '5 minutes'
        WHERE id IN (
          SELECT id FROM proof_batches
           WHERE status = 'pendente' AND next_attempt_at <= now()
           ORDER BY created_at LIMIT 5
           FOR UPDATE SKIP LOCKED)
        RETURNING id, farm_id, merkle_root, leaf_count, schema_version, attempts`,
    );

    let done = 0;
    for (const b of claimed.rows) {
      try {
        const receipt = await this.anchorService.anchor({
          batchId: b.id,
          farmId: b.farm_id,
          merkleRoot: b.merkle_root,
          leafCount: b.leaf_count,
          schemaVersion: b.schema_version,
        });
        await this.db.query(
          `UPDATE proof_batches
              SET status='ancorado', anchored_at=now(), anchor_mode=$2, chain_id=$3, tx_ref=$4,
                  block_number=$5, last_error=NULL
            WHERE id=$1`,
          [b.id, receipt.mode, receipt.chainId, receipt.txRef, receipt.blockNumber],
        );
        done++;
      } catch (err) {
        const attempts = b.attempts + 1;
        const status = attempts >= MAX_ATTEMPTS ? 'falhou' : 'pendente';
        const backoffSec = Math.min(60 * 2 ** attempts, 3600);
        await this.db.query(
          `UPDATE proof_batches
              SET attempts=$2, status=$3, last_error=$4, next_attempt_at = now() + ($5 || ' seconds')::interval
            WHERE id=$1`,
          [b.id, attempts, status, String((err as Error).message).slice(0, 500), String(backoffSec)],
        );
        this.log.warn(`falha ao ancorar lote ${b.id} (tentativa ${attempts}): ${(err as Error).message}`);
      }
    }
    return done;
  }
}
