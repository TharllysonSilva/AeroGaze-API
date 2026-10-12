/**
 * Testes de aceite do documento de arquitetura, contra PostgreSQL + PostGIS REAIS.
 * Precisam de um banco exclusivo para teste (o nome DEVE terminar em _test; ele é zerado a cada execução):
 *   TEST_DATABASE_URL=postgresql://aerogaze:aerogaze_dev@localhost:5432/aerogaze_test npm test
 * Sem TEST_DATABASE_URL, estes testes são ignorados (os de Merkle continuam rodando).
 */
import { execSync } from 'child_process';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { Client } from 'pg';
import { AppModule } from '../src/app.module';
import { BatchService } from '../src/proof/batch.service';
import { DatabaseService } from '../src/database/database.service';

const TEST_DB = process.env.TEST_DATABASE_URL;
const d = TEST_DB ? describe : describe.skip;

d('critérios de aceite (PostgreSQL + PostGIS)', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let base: string;
  let tokenOp = '';
  let tokenOutraOrg = '';
  let farmId = '';
  let plotB12 = '';
  const nowMinus = (s: number) => new Date(Date.now() - s * 1000).toISOString();

  async function api(path: string, opts: { method?: string; token?: string; body?: unknown } = {}) {
    const res = await fetch(base + path, {
      method: opts.method ?? 'GET',
      headers: {
        'content-type': 'application/json',
        ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const text = await res.text();
    return { status: res.status, json: text ? JSON.parse(text) : null };
  }

  const sync = (events: any[], token = tokenOp, device = 'device-demo-01', farm = farmId) =>
    api('/v1/sync/events', { method: 'POST', token, body: { farmId: farm, deviceId: device, events } });

  const inspection = (over: Record<string, any> = {}) => ({
    id: randomUUID(),
    type: 'inspection.recorded',
    schemaVersion: 1,
    occurredAt: nowMinus(30),
    payload: {
      location: { lat: -12.645, lon: -55.823, accuracyM: 8 },
      ai: { label: 'mancha_de_folha', confidence: 0.92, modelVersion: 'tflite-0.1' },
    },
    ...over,
  });

  const position = (asset: string, lat: number, lon: number, accuracyM: number, secondsAgo: number) => ({
    id: randomUUID(),
    type: 'position.reported',
    schemaVersion: 1,
    occurredAt: nowMinus(secondsAgo),
    payload: { assetId: asset, location: { lat, lon, accuracyM } },
  });

  beforeAll(async () => {
    const env = {
      ...process.env,
      DATABASE_URL: TEST_DB!,
      JWT_SECRET: 'segredo-de-teste-com-mais-de-trinta-e-dois-caracteres',
      AUTO_REGISTER_DEVICES: 'true',
      ANCHOR_MODE: 'mock',
      BATCH_MIN_EVENTS: '1',
      BATCH_MAX_AGE_MIN: '0',
    };
    Object.assign(process.env, env);

    // Trava de segurança: só zera bancos cujo nome termina em _test (nunca um banco de verdade).
    const dbName = new URL(TEST_DB!).pathname.replace('/', '');
    if (!dbName.endsWith('_test')) throw new Error(`TEST_DATABASE_URL deve apontar para um banco *_test (recebido: ${dbName})`);
    const admin = new Client({ connectionString: TEST_DB });
    await admin.connect();
    await admin.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await admin.end();

    execSync('node scripts/migrate.js', { env, stdio: 'pipe' });
    execSync('node scripts/seed.js', { env, stdio: 'pipe' });

    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(0);
    base = `http://127.0.0.1:${(app.getHttpServer().address() as any).port}`;
    db = app.get(DatabaseService);

    farmId = (await db.query(`SELECT id FROM farms WHERE name = 'Fazenda Demo Santa Aurora'`)).rows[0].id;
    plotB12 = (await db.query(`SELECT id FROM plots WHERE name = 'Talhão B-12'`)).rows[0].id;

    // Segunda organização, para provar o isolamento entre clientes
    const org2 = (await db.query(`INSERT INTO organizations (name) VALUES ('Outra Org') RETURNING id`)).rows[0].id;
    await db.query(`INSERT INTO farms (organization_id, name) VALUES ($1, 'Fazenda da Outra Org')`, [org2]);
    await db.query(
      `INSERT INTO users (organization_id, email, name, password_hash, role) VALUES ($1,'op@outra.org','Op Outra',$2,'operador')`,
      [org2, bcrypt.hashSync('senha-outra-org', 10)],
    );

    const loginOp = await api('/v1/auth/login', { method: 'POST', body: { email: 'operador@demo.aerogaze', password: 'aerogaze-dev-123' } });
    tokenOp = loginOp.json.accessToken;
    tokenOutraOrg = (await api('/v1/auth/login', { method: 'POST', body: { email: 'op@outra.org', password: 'senha-outra-org' } })).json.accessToken;
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it('health responde ok com o banco de pé', async () => {
    const r = await api('/health');
    expect(r.status).toBe(200);
    expect(r.json.db).toBe('ok');
  });

  it('rotas protegidas exigem token', async () => {
    expect((await api('/v1/alerts')).status).toBe(401);
    expect((await api('/v1/auth/login', { method: 'POST', body: { email: 'operador@demo.aerogaze', password: 'errada-123' } })).status).toBe(401);
  });

  describe('Sincronização idempotente', () => {
    it('aceita, localiza o talhão, gera alerta + tarefa; reenviar NÃO duplica o efeito', async () => {
      const ev = inspection();
      const first = await sync([ev]);
      expect(first.json.acks[0].status).toBe('accepted');

      const row = (await db.query(`SELECT plot_id FROM sync_events WHERE id = $1`, [ev.id])).rows[0];
      expect(row.plot_id).toBe(plotB12);

      const again = await sync([ev]);
      expect(again.json.acks[0].status).toBe('duplicate');

      const alerts = await db.query(`SELECT count(*)::int n FROM alerts WHERE source_event_id = $1`, [ev.id]);
      const tasks = await db.query(`SELECT count(*)::int n FROM tasks WHERE source_event_id = $1`, [ev.id]);
      const outbox = await db.query(`SELECT count(*)::int n FROM outbox WHERE aggregate_id = $1`, [ev.id]);
      expect(alerts.rows[0].n).toBe(1);
      expect(tasks.rows[0].n).toBe(1);
      expect(outbox.rows[0].n).toBe(1);
    });

    it('um evento ruim não derruba os demais do mesmo lote', async () => {
      const good = inspection({ payload: { ai: { label: 'saudavel', confidence: 0.99 } } });
      const future = inspection({ occurredAt: new Date(Date.now() + 3_600_000).toISOString() });
      const r = await sync([future, good]);
      expect(r.json.acks.map((a: any) => a.status)).toEqual(['rejected', 'accepted']);
    });

    it('IA "inconclusivo" gera só tarefa de revisão humana, sem alerta', async () => {
      const ev = inspection({ payload: { ai: { label: 'inconclusivo', confidence: 0.4 } } });
      await sync([ev]);
      expect((await db.query(`SELECT count(*)::int n FROM alerts WHERE source_event_id=$1`, [ev.id])).rows[0].n).toBe(0);
      expect((await db.query(`SELECT count(*)::int n FROM tasks WHERE source_event_id=$1`, [ev.id])).rows[0].n).toBe(1);
    });

    it('não repete alerta aberto igual (mesmo talhão e mesmo achado)', async () => {
      const a = inspection();
      const b = inspection();
      await sync([a, b]);
      const n = (await db.query(`SELECT count(*)::int n FROM alerts WHERE source_event_id = ANY($1::uuid[])`, [[a.id, b.id]])).rows[0].n;
      expect(n).toBe(0); // já havia alerta aberto do primeiro teste
    });

    it('eventos são append-only: UPDATE e DELETE falham', async () => {
      await expect(db.query(`UPDATE sync_events SET type = 'x'`)).rejects.toThrow(/append-only/);
      await expect(db.query(`DELETE FROM sync_events`)).rejects.toThrow(/append-only/);
    });
  });

  describe('Geofence', () => {
    it('3 leituras precisas e consecutivas fora do perímetro, com permanência: gera alerta', async () => {
      const lat = -12.66, lon = -55.82; // ~1,5 km ao sul da fazenda
      const r = await sync([
        position('BR-042', lat, lon, 8, 300),
        position('BR-042', lat, lon, 8, 200),
        position('BR-042', lat, lon, 8, 100),
      ]);
      expect(r.json.summary.accepted).toBe(3);
      const n = (await db.query(`SELECT count(*)::int n FROM alerts WHERE rule='RG-GEO-01' AND dedupe_key LIKE '%BR-042'`)).rows[0].n;
      expect(n).toBe(1);
    });

    it('na borda (dentro da margem externa) NÃO alerta', async () => {
      const lat = -12.6481, lon = -55.823; // ~11 m além da divisa, margem é 15 m
      await sync([
        position('BR-043', lat, lon, 8, 300),
        position('BR-043', lat, lon, 8, 200),
        position('BR-043', lat, lon, 8, 100),
      ]);
      const n = (await db.query(`SELECT count(*)::int n FROM alerts WHERE dedupe_key LIKE '%BR-043'`)).rows[0].n;
      expect(n).toBe(0);
    });

    it('GPS impreciso NÃO alerta, mesmo longe', async () => {
      const lat = -12.66, lon = -55.82;
      await sync([
        position('BR-044', lat, lon, 90, 300),
        position('BR-044', lat, lon, 90, 200),
        position('BR-044', lat, lon, 90, 100),
      ]);
      const n = (await db.query(`SELECT count(*)::int n FROM alerts WHERE dedupe_key LIKE '%BR-044'`)).rows[0].n;
      expect(n).toBe(0);
    });

    it('com GPS impreciso o talhão não é atribuído', async () => {
      const ev = inspection({ payload: { location: { lat: -12.645, lon: -55.823, accuracyM: 120 }, ai: { label: 'saudavel', confidence: 0.9 } } });
      await sync([ev]);
      expect((await db.query(`SELECT plot_id FROM sync_events WHERE id=$1`, [ev.id])).rows[0].plot_id).toBeNull();
    });
  });

  describe('Segurança e isolamento', () => {
    it('usuário de outra organização não acessa a fazenda (404, sem vazar existência)', async () => {
      expect((await sync([inspection()], tokenOutraOrg)).status).toBe(404);
      expect((await api(`/v1/farms/${farmId}/plots`, { token: tokenOutraOrg })).status).toBe(404);
      expect((await api(`/v1/alerts?farmId=${farmId}`, { token: tokenOutraOrg })).status).toBe(404);
      const own = await api('/v1/alerts', { token: tokenOutraOrg });
      expect(own.json).toEqual([]); // nada da outra organização aparece
    });

    it('papel sem permissão é barrado (operador não cria talhão)', async () => {
      const r = await api(`/v1/farms/${farmId}/plots`, {
        method: 'POST', token: tokenOp,
        body: { name: 'X', kind: 'talhao', boundary: { type: 'Polygon', coordinates: [[[0,0],[0,1],[1,1],[0,0]]] } },
      });
      expect(r.status).toBe(403);
    });

    it('aparelho revogado não sincroniza', async () => {
      await sync([inspection()], tokenOp, 'device-a-revogar');
      await db.query(`UPDATE devices SET revoked_at = now() WHERE id = 'device-a-revogar'`);
      expect((await sync([inspection()], tokenOp, 'device-a-revogar')).status).toBe(403);
    });
  });

  describe('Prova de integridade', () => {
    let batchId = '';

    it('worker monta o lote e ancora (mock); verificação pública valida', async () => {
      const batches = app.get(BatchService);
      const created = await batches.buildBatches();
      expect(created).toBeGreaterThanOrEqual(1);
      expect(await batches.anchorPending()).toBeGreaterThanOrEqual(1);

      batchId = (await db.query(`SELECT id FROM proof_batches WHERE status='ancorado' ORDER BY created_at LIMIT 1`)).rows[0].id;
      const v = await api(`/v1/verify/${batchId}`); // pública: sem token
      expect(v.status).toBe(200);
      expect(v.json.valid).toBe(true);
      expect(v.json.anchor.mode).toBe('mock');
    });

    it('prova de inclusão de um evento confere', async () => {
      const item = (await db.query(`SELECT event_id FROM proof_batch_items WHERE batch_id=$1 LIMIT 1`, [batchId])).rows[0];
      const tokenAud = (await api('/v1/auth/login', { method: 'POST', body: { email: 'auditor@demo.aerogaze', password: 'aerogaze-dev-123' } })).json.accessToken;
      const p = await api(`/v1/proof/batches/${batchId}/events/${item.event_id}`, { token: tokenAud });
      expect(p.status).toBe(200);
      expect(p.json.valid).toBe(true);
    });

    it('adulteração posterior faz a verificação FALHAR', async () => {
      const item = (await db.query(`SELECT event_id FROM proof_batch_items WHERE batch_id=$1 LIMIT 1`, [batchId])).rows[0];
      // Simula um administrador de banco mal-intencionado: desliga a trava e altera o dado.
      await db.query(`ALTER TABLE sync_events DISABLE TRIGGER sync_events_append_only`);
      await db.query(`UPDATE sync_events SET payload = jsonb_set(payload, '{adulterado}', 'true') WHERE id = $1`, [item.event_id]);
      await db.query(`ALTER TABLE sync_events ENABLE TRIGGER sync_events_append_only`);

      const v = await api(`/v1/verify/${batchId}`);
      expect(v.json.valid).toBe(false);
      expect(v.json.tamperedEventCount).toBeGreaterThanOrEqual(1);
    });

    it('política de custo: com poucos eventos e lote recente, o worker espera (não gasta gás à toa)', async () => {
      const batches = app.get(BatchService);
      const prev = { min: (batches as any).env.batchMinEvents, age: (batches as any).env.batchMaxAgeMin };
      (batches as any).env.batchMinEvents = 50;
      (batches as any).env.batchMaxAgeMin = 60;
      try {
        await sync([inspection({ payload: { ai: { label: 'saudavel', confidence: 0.95 } } })]);
        expect(await batches.buildBatches()).toBe(0); // 1 evento < 50 e ainda não passou 60 min
        expect((await db.query(`SELECT count(*)::int n FROM outbox WHERE processed_at IS NULL`)).rows[0].n).toBeGreaterThanOrEqual(1);
      } finally {
        (batches as any).env.batchMinEvents = prev.min;
        (batches as any).env.batchMaxAgeMin = prev.age;
      }
      expect(await batches.buildBatches()).toBeGreaterThanOrEqual(1); // com a política relaxada, fecha
    });

    it('operação continua com a blockchain indisponível (lote fica pendente com retry)', async () => {
      const batches = app.get(BatchService);
      const failing = { anchor: async () => { throw new Error('rede indisponível'); }, readAnchor: async () => null };
      (batches as any).anchorService = failing;

      const r = await sync([inspection({ payload: { ai: { label: 'saudavel', confidence: 0.9 } } })]);
      expect(r.json.acks[0].status).toBe('accepted'); // fazenda segue operando
      await batches.buildBatches();
      await batches.anchorPending();
      const pend = (await db.query(`SELECT status, attempts, last_error FROM proof_batches ORDER BY created_at DESC LIMIT 1`)).rows[0];
      expect(pend.status).toBe('pendente');
      expect(pend.attempts).toBe(1);
      expect(pend.last_error).toMatch(/rede indisponível/);
    });
  });
});
