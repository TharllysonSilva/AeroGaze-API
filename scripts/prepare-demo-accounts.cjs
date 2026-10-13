// Owner-requested demo credentials. Never prints passwords or connection URLs.
const fs = require('node:fs');
const { randomBytes } = require('node:crypto');
const bcrypt = require('bcryptjs');
const { Client } = require('pg');
process.loadEnvFile('.env.integration.local');
const file = '.env.accounts.local';
const farmId = '3dfa544b-dbef-43d7-a3ae-aefcaac700a3';
const profiles = [
  ['operador@demo.aerogaze', 'Operador Demo', 'operador'],
  ['vet@demo.aerogaze', 'Veterinária Demo', 'veterinario'],
  ['gerente@demo.aerogaze', 'Gerente Demo', 'gerente'],
  ['auditor@demo.aerogaze', 'Auditor Demo', 'auditor'],
  ['admin@demo.aerogaze', 'Administrador Demo', 'administrador'],
];
async function main() {
  if (!fs.existsSync(file) && !process.argv.includes('--prepare')) {
    throw new Error('Use --prepare somente para a preparação autorizada das contas demo.');
  }
  const db = new Client({connectionString: process.env.INTEGRATION_DATABASE_URL, connectionTimeoutMillis:15000});
  await db.connect();
  try {
    const farm = (await db.query(`SELECT f.organization_id FROM farms f JOIN proof_batches b ON b.farm_id=f.id WHERE f.id=$1 AND b.chain_id='84532' LIMIT 1`, [farmId])).rows[0];
    if (!farm) throw new Error('Escopo de demonstração não encontrado');
    let accounts;
    if (fs.existsSync(file)) accounts = JSON.parse(fs.readFileSync(file, 'utf8')).accounts;
    else {
      accounts = profiles.map(([email,name,role])=>({email,name,role,password:randomBytes(24).toString('base64url')}));
      accounts.push({email:process.env.INTEGRATION_EMAIL,role:'gerente',password:process.env.INTEGRATION_PASSWORD});
      fs.writeFileSync(file, JSON.stringify({notice:'Credenciais privadas da demonstração. Não publicar nem enviar ao Git.',accounts},null,2),{flag:'wx',mode:0o600});
      await db.query('BEGIN');
      try {
        for (const a of accounts.slice(0,5)) {
          const existing = (await db.query('SELECT id,organization_id,role FROM users WHERE lower(email)=lower($1) FOR UPDATE',[a.email])).rows[0];
          if(existing && (existing.organization_id!==farm.organization_id || existing.role!==a.role)) throw new Error('Conta fora do escopo');
          const hash=await bcrypt.hash(a.password,12);
          const user=existing ? (await db.query('UPDATE users SET password_hash=$2,active=true WHERE id=$1 RETURNING id',[existing.id,hash])).rows[0] : (await db.query('INSERT INTO users(organization_id,farm_id,email,name,password_hash,role) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[farm.organization_id,['administrador','auditor'].includes(a.role)?null:farmId,a.email,a.name,hash,a.role])).rows[0];
          await db.query(`INSERT INTO audit_log(organization_id,action,entity,entity_id,details) VALUES($1,'auth.owner_demo_password_reset','user',$2,$3)`,[farm.organization_id,String(user.id),JSON.stringify({role:a.role})]);
        }
        await db.query('COMMIT');
      } catch(e) { await db.query('ROLLBACK'); throw e; }
    }
    for(const a of accounts) {
      const r=await fetch('https://aerogaze-api.onrender.com/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:a.email,password:a.password})});
      if(!r.ok) throw new Error('Login não validado');
      const result=await r.json();
      console.log(JSON.stringify({email:a.email,role:result.user.role,login:r.status}));
    }
    console.log('Seis credenciais salvas somente em .env.accounts.local e validadas na API publicada.');
  } finally {await db.end();}
}
main().catch(()=>{console.error('Conferência de contas não concluída. Nenhum segredo foi impresso.');process.exitCode=1;});
