import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { AppEnv, ENV_TOKEN } from '../config/env';
import { BatchService } from '../proof/batch.service';

/**
 * Worker do outbox. Roda como PROCESSO SEPARADO da API (npm run start:worker):
 *  1) monta lotes de prova (Merkle) com os eventos novos;
 *  2) ancora os lotes pendentes (mock ou EVM), com retry e espera crescente.
 * Se a rede/blockchain cair, só este processo sofre: a fazenda continua operando.
 */
@Injectable()
export class WorkerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger(WorkerService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly batches: BatchService, @Inject(ENV_TOKEN) private readonly env: AppEnv) {}

  onApplicationBootstrap() {
    this.log.log(`worker iniciado (a cada ${this.env.workerIntervalMs} ms, ancoragem: ${this.env.anchorMode})`);
    void this.tick();
    this.timer = setInterval(() => void this.tick(), this.env.workerIntervalMs);
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    if (this.running) return; // nunca sobrepõe execuções
    this.running = true;
    try {
      const created = await this.batches.buildBatches();
      const anchored = await this.batches.anchorPending();
      if (created || anchored) this.log.log(`lotes criados: ${created} | ancorados: ${anchored}`);
    } catch (err) {
      this.log.error(`falha no ciclo do worker: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
