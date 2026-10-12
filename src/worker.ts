import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { loadDotEnvIfPresent } from './config/env';
import { WorkerModule } from './worker/worker.module';

loadDotEnvIfPresent();

/** Entrada do processo worker (sem servidor HTTP). */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();
}
bootstrap();
