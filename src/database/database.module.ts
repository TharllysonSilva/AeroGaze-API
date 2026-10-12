import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { ENV_TOKEN, loadEnv } from '../config/env';

@Global()
@Module({
  providers: [DatabaseService, { provide: ENV_TOKEN, useFactory: () => loadEnv() }],
  exports: [DatabaseService, ENV_TOKEN],
})
export class DatabaseModule {}
