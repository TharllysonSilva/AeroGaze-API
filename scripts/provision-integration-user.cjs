const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const bcrypt = require('bcryptjs');
const { Client } = require('pg');
const config = path.resolve('.env.integration.local');
process.loadEnvFile(config);
const email = 'gerente.integracao@demo.aerogaze';
const farmId = '3dfa544b-dbef-43d7-a3ae-aefcaac700a3';
const knownBatch = '4224def8-9233-42a2-a3fe-373587cff86c';
async function main() {
  const rawUrl = process.env.INTEGRATION_DATABASE_URL;
  if (!rawUrl) throw new Error('Preencha INTEGRATION_DATABASE_URL no arquivo local.');
  const url = new URL(rawUrl);
  if (!url.hostname.endsWith('.neon.tech')) throw new Error('A conexão deve apontar para o banco Neon publicado.');
  const db = new Client({ connectionString: rawUrl, connectionTimeoutMillis: 15000 });
  await db.connect();
  try {
    const result = await db.query(
      `SELECT f.id, f.name, f.organization_id FROM farms f
       JOIN proof_batches b ON b.farm_id=f.id AND b.organization_id=f.organization_id
       WHERE f.id=$1 AND b.id=$2 AND b.anchor_mode='evm' AND b.chain_id='84532'`, [farmId, knownBatch]);
    if (result.rows.length !== 1) throw new Error('Banco/fazenda não correspondem ao protótipo publicado. Nenhuma conta criada.');
    const farm = result.rows[0];
    console.log(JSON.stringify({ host: url.hostname, email, role: 'gerente', farm: farm.name, scope: 'somente esta fazenda' }));
    if (!process.argv.includes('--create')) { console.log('Conferência concluída; use --create para cadastrar a conta solicitada.'); return; }
    if ((await db.query('SELECT id FROM users WHERE lower(email)=lower($1)', [email])).rowCount) {
      throw new Error('Esta conta já existe; o script não substitui sua senha.');
    }
    const password = randomBytes(24).toString('base64url');
    const hash = await bcrypt.hash(password, 12);
    // Save the credential first: on a later database error it remains recoverable locally.
    const original = fs.readFileSync(config, 'utf8');
    const updated = original.replace(/^INTEGRATION_EMAIL=.*$/m, `INTEGRATION_EMAIL="${email}"`)
      .replace(/^INTEGRATION_PASSWORD=.*$/m, `INTEGRATION_PASSWORD="${password}"`);
    if (updated === original || !/^INTEGRATION_EMAIL=/m.test(original) || !/^INTEGRATION_PASSWORD=/m.test(original)) {
      throw new Error('O arquivo local precisa conter os campos INTEGRATION_EMAIL e INTEGRATION_PASSWORD.');
    }
    fs.writeFileSync(config, updated, { mode: 0o600 });
    await db.query('BEGIN');
    try {
      const user = (await db.query(
        `INSERT INTO users (organization_id, farm_id, email, name, password_hash, role)
         VALUES ($1,$2,$3,$4,$5,'gerente') RETURNING id`,
        [farm.organization_id, farm.id, email, 'Gerente de integração', hash])).rows[0];
      await db.query(
        `INSERT INTO audit_log (organization_id, user_id, action, entity, entity_id, details)
         VALUES ($1,$2,'auth.provision_integration','user',$3,$4)`,
        [farm.organization_id, user.id, String(user.id), JSON.stringify({ role: 'gerente', farmId: farm.id })]);
      await db.query('COMMIT');
      console.log('Conta criada. A senha está somente no arquivo local protegido do Git.');
    } catch (error) { await db.query('ROLLBACK'); throw error; }
  } finally { await db.end(); }
}
main().catch(error => {
  // Connection errors can include credentials in a URI; never print the raw error.
  const safe = ['Preencha', 'A conexão', 'Banco/', 'Esta conta', 'O arquivo'].some(prefix => error.message?.startsWith(prefix));
  console.error(safe ? error.message : 'Não foi possível concluir o cadastro. Verifique a conexão e tente novamente.');
  process.exitCode = 1;
});
