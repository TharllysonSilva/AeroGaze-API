import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { FarmsModule } from './farms/farms.module';
import { HealthController } from './health/health.controller';
import { OperationsModule } from './operations/operations.module';
import { ProofHttpModule } from './proof/proof-http.module';
import { ProofModule } from './proof/proof.module';
import { RulesModule } from './rules/rules.module';
import { SyncModule } from './sync/sync.module';
import { DemoModule } from './demo/demo.controller';
import { SolanaModule } from './solana/solana.controller';

@Module({
  imports: [DatabaseModule, AuthModule, FarmsModule, RulesModule, ProofModule, ProofHttpModule, SyncModule, OperationsModule, DemoModule, SolanaModule],
  controllers: [HealthController],
})
export class AppModule {}
