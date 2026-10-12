import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ProofModule } from '../proof/proof.module';
import { WorkerService } from './worker.service';

@Module({
  imports: [DatabaseModule, ProofModule],
  providers: [WorkerService],
})
export class WorkerModule {}
