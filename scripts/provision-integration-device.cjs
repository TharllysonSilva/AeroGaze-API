// Narrow enrollment for the integration account; never un-revokes a device.
const { Client } = require('pg');
process.loadEnvFile('.env.integration.local');
const deviceId = process.argv[2];
const farmId = '3dfa544b-dbef-43d7-a3ae-aefcaac700a3';
async function main() {
  if (!/^flutter-[0-9a-f-]{36}$/.test(deviceId || '')) throw new Error('Identificador Flutter inválido.');
  const url = new URL(process.env.INTEGRATION_DATABASE_URL);
  if (!url.hostname.endsWith('.neon.tech')) throw new Error('Banco incompatível.');
  const db = new Client({ connectionString: url.toString(), connectionTimeoutMillis: 15000 });
  await db.connect();
  try {
    await db.query('BEGIN');
    const users = await db.query(`SELECT id, organization_id FROM users WHERE email=$1 AND farm_id=$2 AND role='gerente' AND active=true`, ['gerente.integracao@demo.aerogaze', farmId]);
    if (users.rowCount !== 1) throw new Error('Conta de integração incompatível.');
    const user = users.rows[0];
    const inserted = await db.query(`INSERT INTO devices (id, organization_id, farm_id, name) VALUES ($1,$2,$3,'Flutter integração') ON CONFLICT (id) DO NOTHING RETURNING id`, [deviceId,user.organization_id,farmId]);
    const rows = await db.query('SELECT organization_id, farm_id, revoked_at FROM devices WHERE id=$1', [deviceId]);
    const device = rows.rows[0];
    if (device.organization_id !== user.organization_id || device.farm_id !== farmId || device.revoked_at) throw new Error('Dispositivo pertence a outro escopo ou foi revogado.');
    if (inserted.rowCount) await db.query(`INSERT INTO audit_log (organization_id,user_id,action,entity,entity_id,details) VALUES ($1,$2,'device.provision_integration','device',$3,$4)`, [user.organization_id,user.id,deviceId,JSON.stringify({farmId})]);
    await db.query('COMMIT');
    console.log('Dispositivo de integração cadastrado na fazenda de demonstração: '+deviceId);
  } catch (error) { await db.query('ROLLBACK'); throw error; } finally { await db.end(); }
}
main().catch(() => { console.error('Cadastro não concluído; nenhuma permissão ampliada.'); process.exitCode=1; });
