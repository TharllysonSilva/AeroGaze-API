#!/usr/bin/env node
/* Dados de demonstração coerentes: UMA fazenda, dois talhões, um piquete, um aparelho e um usuário por papel.
 * Coordenadas centradas em LAT -12.645 / LON -55.823 (as mesmas das telas do app).
 * Uso: npm run seed */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Client } = require('pg');

function loadDotEnv() {
  const file = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}

// retângulo [lonMin, latMin, lonMax, latMax] -> GeoJSON Polygon
const rect = ([x1, y1, x2, y2]) => ({
  type: 'Polygon',
  coordinates: [[[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]]],
});

async function main() {
  loadDotEnv();
  const password = process.env.SEED_PASSWORD || 'aerogaze-dev-123';
  if (process.env.NODE_ENV === 'production' &&
      (!process.env.SEED_PASSWORD || password === 'aerogaze-dev-123' || password.length < 16)) {
    throw new Error('Em producao, configure SEED_PASSWORD propria com pelo menos 16 caracteres.');
  }
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const existing = await client.query(`SELECT id FROM organizations WHERE name = 'Grupo Demo AeroGaze'`);
  if (existing.rowCount) {
    console.log('seed já aplicado (organização demo existe). Nada a fazer.');
    await client.end();
    return;
  }

  await client.query('BEGIN');
  try {
    const org = (await client.query(
      `INSERT INTO organizations (name) VALUES ('Grupo Demo AeroGaze') RETURNING id`)).rows[0].id;
    const farm = (await client.query(
      `INSERT INTO farms (organization_id, name) VALUES ($1, 'Fazenda Demo Santa Aurora') RETURNING id`, [org])).rows[0].id;

    const plots = [
      ['Talhão B-12', 'talhao', rect([-55.8260, -12.6480, -55.8200, -12.6420])],
      ['Talhão B-13', 'talhao', rect([-55.8200, -12.6480, -55.8140, -12.6420])],
      ['Piquete Norte', 'piquete', rect([-55.8260, -12.6420, -55.8140, -12.6370])],
    ];
    for (const [name, kind, geo] of plots) {
      await client.query(
        `INSERT INTO plots (farm_id, name, kind, boundary)
         VALUES ($1, $2, $3, ST_SetSRID(ST_GeomFromGeoJSON($4), 4326))`,
        [farm, name, kind, JSON.stringify(geo)]);
    }

    await client.query(
      `INSERT INTO devices (id, organization_id, farm_id, name) VALUES ('device-demo-01', $1, $2, 'Celular demo 01')`,
      [org, farm]);

    const hash = bcrypt.hashSync(password, 10);
    const users = [
      ['operador@demo.aerogaze', 'Operador Demo', 'operador', farm],
      ['vet@demo.aerogaze', 'Veterinária Demo', 'veterinario', farm],
      ['gerente@demo.aerogaze', 'Gerente Demo', 'gerente', farm],
      ['auditor@demo.aerogaze', 'Auditor Demo', 'auditor', null],
      ['admin@demo.aerogaze', 'Administrador Demo', 'administrador', null],
    ];
    for (const [email, name, role, farmId] of users) {
      await client.query(
        `INSERT INTO users (organization_id, farm_id, email, name, password_hash, role)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [org, farmId, email, name, hash, role]);
    }
    await client.query('COMMIT');
    console.log('seed aplicado.');
    console.log(`  organização: ${org}`);
    console.log(`  fazenda:     ${farm}`);
    console.log(`  usuários:    operador@/vet@/gerente@/auditor@/admin@demo.aerogaze`);
    console.log('  aparelho:    device-demo-01');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
