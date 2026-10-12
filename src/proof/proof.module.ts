import { Global, Module } from '@nestjs/common';
import { AppEnv, ENV_TOKEN } from '../config/env';
import { ANCHOR_SERVICE } from './anchor.service';
import { BatchService } from './batch.service';
import { EvmAnchorService } from './evm-anchor.service';
import { MockAnchorService } from './mock-anchor.service';

/**
 * Lógica de prova SEM HTTP: usada pela API e pelo worker.
 * (Os endpoints ficam em ProofHttpModule, que só a API carrega.)
 */
@Global()
@Module({
  providers: [
    BatchService,
    {
      provide: ANCHOR_SERVICE,
      inject: [ENV_TOKEN],
      useFactory: (env: AppEnv) => (env.anchorMode === 'evm' ? new EvmAnchorService(env) : new MockAnchorService()),
    },
  ],
  exports: [BatchService, ANCHOR_SERVICE],
})
export class ProofModule {}
