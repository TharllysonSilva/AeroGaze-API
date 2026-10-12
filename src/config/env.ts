/** Leitura única e tipada das variáveis de ambiente. Falha cedo se algo essencial faltar. */
export interface AppEnv {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  autoRegisterDevices: boolean;
  geofenceMaxAccuracyM: number;
  geofenceMarginM: number;
  geofenceConsecutiveReadings: number;
  geofenceMinDwellS: number;
  aiAlertMinConfidence: number;
  workerIntervalMs: number;
  batchMaxEvents: number;
  batchMinEvents: number;
  batchMaxAgeMin: number;
  anchorMode: 'mock' | 'evm';
  evm: { rpcUrl: string; chainId: string; registryAddress: string; privateKey: string };
}

const num = (v: string | undefined, def: number) => (v !== undefined && v !== '' ? Number(v) : def);
const bool = (v: string | undefined, def: boolean) => (v === undefined || v === '' ? def : v === 'true');

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const nodeEnv = source.NODE_ENV ?? 'development';
  const isProd = nodeEnv === 'production';

  const databaseUrl = source.DATABASE_URL ?? '';
  const jwtSecret = source.JWT_SECRET ?? '';
  if (!databaseUrl) throw new Error('DATABASE_URL não definida');
  if (!jwtSecret) throw new Error('JWT_SECRET não definida');
  if (isProd && (jwtSecret.length < 32 || jwtSecret.startsWith('troque-isto'))) {
    throw new Error('JWT_SECRET fraca para produção: gere um valor aleatório com 32+ caracteres');
  }

  const anchorMode = (source.ANCHOR_MODE ?? 'mock') as 'mock' | 'evm';
  if (anchorMode !== 'mock' && anchorMode !== 'evm') throw new Error('ANCHOR_MODE deve ser mock ou evm');

  const evm = {
    rpcUrl: source.EVM_RPC_URL ?? '',
    chainId: source.EVM_CHAIN_ID ?? '',
    registryAddress: source.EVM_REGISTRY_ADDRESS ?? '',
    privateKey: source.EVM_ANCHOR_PRIVATE_KEY ?? '',
  };
  if (anchorMode === 'evm' && (!evm.rpcUrl || !evm.registryAddress || !evm.privateKey)) {
    throw new Error('ANCHOR_MODE=evm exige EVM_RPC_URL, EVM_REGISTRY_ADDRESS e EVM_ANCHOR_PRIVATE_KEY');
  }

  return {
    nodeEnv,
    port: num(source.PORT, 3000),
    databaseUrl,
    jwtSecret,
    jwtExpiresIn: source.JWT_EXPIRES_IN ?? '12h',
    autoRegisterDevices: bool(source.AUTO_REGISTER_DEVICES, !isProd),
    geofenceMaxAccuracyM: num(source.GEOFENCE_MAX_ACCURACY_M, 30),
    geofenceMarginM: num(source.GEOFENCE_MARGIN_M, 15),
    geofenceConsecutiveReadings: num(source.GEOFENCE_CONSECUTIVE_READINGS, 3),
    geofenceMinDwellS: num(source.GEOFENCE_MIN_DWELL_S, 120),
    aiAlertMinConfidence: num(source.AI_ALERT_MIN_CONFIDENCE, 0.8),
    workerIntervalMs: num(source.WORKER_INTERVAL_MS, 15000),
    batchMaxEvents: num(source.BATCH_MAX_EVENTS, 100),
    batchMinEvents: num(source.BATCH_MIN_EVENTS, 50),
    batchMaxAgeMin: num(source.BATCH_MAX_AGE_MIN, 60),
    anchorMode,
    evm,
  };
}

export const ENV_TOKEN = 'APP_ENV';

/**
 * Em desenvolvimento, carrega o arquivo .env (Node 22+). Não sobrescreve variáveis já definidas
 * e é ignorado em produção, onde a plataforma injeta as variáveis.
 */
export function loadDotEnvIfPresent(): void {
  if (process.env.NODE_ENV === 'production') return;
  try {
    (process as any).loadEnvFile?.('.env');
  } catch {
    /* sem .env: segue com o ambiente atual */
  }
}
