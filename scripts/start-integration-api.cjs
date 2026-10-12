const { spawnSync, spawn } = require('node:child_process');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const env = { ...process.env, NODE_ENV: 'development', PORT: '3302',
  DATABASE_URL: 'postgresql://aerogaze:integration-local-only@127.0.0.1:55432/aerogaze_android_test',
  JWT_SECRET: 'integration-test-only-secret-over-32-characters', SEED_PASSWORD: 'demo-integration-2026',
  ANCHOR_MODE: 'mock', AUTO_REGISTER_DEVICES: 'true', BATCH_MIN_EVENTS: '1', BATCH_MAX_AGE_MIN: '0', WORKER_INTERVAL_MS: '5000', RUN_WORKER_IN_API: 'true' };
(async () => {
  const url = new URL(env.DATABASE_URL);
  if (url.hostname !== '127.0.0.1' || url.port !== '55432' || url.pathname !== '/aerogaze_android_test') throw new Error('test database guard');
  const migration = spawnSync(process.execPath, ['scripts/migrate.js'], { env, stdio: 'inherit' });
  if (migration.status !== 0) throw new Error('test migration failed');
  const seed = spawnSync(process.execPath, ['scripts/seed.js'], { env, stdio: 'inherit' });
  if (seed.status !== 0) throw new Error('test seed failed');
  const db = new Client({ connectionString: env.DATABASE_URL }); await db.connect();
  await db.query('UPDATE users SET password_hash=$1 WHERE email=$2', [bcrypt.hashSync(env.SEED_PASSWORD, 10), 'gerente@demo.aerogaze']);
  await db.end();
  const app = spawn(process.execPath, ['dist/main.js'], { env, stdio: 'inherit' });
  app.on('exit', code => process.exit(code ?? 1));
})().catch(() => { console.error('Isolated integration API could not start.'); process.exitCode = 1; });
