#!/usr/bin/env node
/* Aplica, em ordem, os arquivos de /migrations que ainda não rodaram.
 * Uso: npm run migrate   (lê DATABASE_URL do ambiente ou do arquivo .env) */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function loadDotEnv() {
  const file = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}

async function main() {
  loadDotEnv();
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não definida');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const dir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const done = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [file]);
    if (done.rowCount) continue;
    console.log(`aplicando ${file} ...`);
    await client.query('BEGIN');
    try {
      await client.query(fs.readFileSync(path.join(dir, file), 'utf8'));
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  }
  console.log('migrações em dia');
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
