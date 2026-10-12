import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WorkerModule } from './worker/worker.module';
import { loadDotEnvIfPresent, loadEnv } from './config/env';

loadDotEnvIfPresent();

async function bootstrap() {
  const env = loadEnv(); // falha cedo se faltar DATABASE_URL / JWT_SECRET
  const rootModule = process.env.RUN_WORKER_IN_API === 'true'
    ? { module: AppModule, imports: [WorkerModule] }
    : AppModule;
  const app = await NestFactory.create(rootModule, { bufferLogs: false });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true }));
  // CORS: o dashboard Next.js precisa chamar a API do navegador. Restrinja a origem em produção.
  app.enableCors({ origin: process.env.CORS_ORIGIN?.split(',') ?? true });
  app.enableShutdownHooks();

  // 0.0.0.0 é obrigatório em container (Railway/Render); PORT é injetada pela plataforma.
  await app.listen(env.port, '0.0.0.0');
  new Logger('Bootstrap').log(`API no ar na porta ${env.port} (ancoragem: ${env.anchorMode})`);
}
bootstrap();
