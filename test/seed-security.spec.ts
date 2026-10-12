import { spawnSync } from 'node:child_process';

describe('Segurança do seed em produção', () => {
  it.each(['', 'curta', 'aerogaze-dev-123'])(
    'rejeita a senha inadequada do caso %# antes de conectar',
    (password) => {
      const result = spawnSync(process.execPath, ['scripts/seed.js'], {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: {
          ...process.env,
          NODE_ENV: 'production',
          SEED_PASSWORD: password,
          DATABASE_URL: '',
        },
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        'Em producao, configure SEED_PASSWORD propria'
      );
      if (password) {
        expect(result.stdout + result.stderr).not.toContain(password);
      }
    }
  );
});
