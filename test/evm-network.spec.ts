import { Contract, JsonRpcProvider, Wallet } from 'ethers';
import { loadEnv } from '../src/config/env';
import { EvmAnchorService } from '../src/proof/evm-anchor.service';

jest.mock('ethers', () => ({
  ...jest.requireActual('ethers'),
  Contract: jest.fn(),
  JsonRpcProvider: jest.fn(),
  Wallet: jest.fn(),
}));

const getNetwork = jest.fn();
const getAnchor = jest.fn();
const sendAnchor = jest.fn();

const input = {
  batchId: '00000000-0000-4000-8000-000000000001',
  farmId: '00000000-0000-4000-8000-000000000002',
  merkleRoot: '0x' + '11'.repeat(32),
  leafCount: 1,
  schemaVersion: 1,
};

const makeEnv = (chainId = '84532') => loadEnv({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://banco-ficticio',
  JWT_SECRET: 'segredo-ficticio-exclusivo-dos-testes',
  ANCHOR_MODE: 'evm',
  EVM_CHAIN_ID: chainId,
  EVM_RPC_URL: 'https://rpc-ficticio.invalid',
  EVM_REGISTRY_ADDRESS: '0x1111111111111111111111111111111111111111',
  EVM_ANCHOR_PRIVATE_KEY: 'valor-ficticio-sem-chave-real',
});

beforeEach(() => {
  jest.clearAllMocks();

  getNetwork.mockResolvedValue({ chainId: 84532n });
  getAnchor.mockResolvedValue({ anchoredAt: 0n });
  sendAnchor.mockResolvedValue({
    hash: 'recibo-simulado-exclusivo-do-teste',
    wait: async () => ({ blockNumber: 123 }),
  });

  (JsonRpcProvider as unknown as jest.Mock)
    .mockImplementation(() => ({ getNetwork }));
  (Wallet as unknown as jest.Mock)
    .mockImplementation(() => ({}));
  (Contract as unknown as jest.Mock)
    .mockImplementation(() => ({
      getAnchor,
      anchor: sendAnchor,
    }));
});

test('configuracao mainnet e recusada antes de carregar a carteira', () => {
  expect(() => new EvmAnchorService(makeEnv('8453')))
    .toThrow(/somente em testnet ou rede local/);
  expect(Wallet).not.toHaveBeenCalled();
  expect(Contract).not.toHaveBeenCalled();
});

test.each([8453n, 421614n])(
  'RPC na rede %s bloqueia a ancoragem configurada para Base Sepolia',
  async (chainId) => {
    getNetwork.mockResolvedValue({ chainId });
    const service = new EvmAnchorService(makeEnv());

    await expect(service.anchor(input)).rejects.toThrow(/diverge/);
    expect(getAnchor).not.toHaveBeenCalled();
    expect(sendAnchor).not.toHaveBeenCalled();
  }
);

test('leitura da prova tambem rejeita RPC de outra rede', async () => {
  getNetwork.mockResolvedValue({ chainId: 8453n });
  const service = new EvmAnchorService(makeEnv());

  await expect(service.readAnchor(input.batchId)).rejects.toThrow(/diverge/);
  expect(getAnchor).not.toHaveBeenCalled();
});

test.each(['84532', '421614', '31337'])(
  'rede permitida %s continua ancorando quando coincide com a configuracao',
  async (chainId) => {
    getNetwork.mockResolvedValue({ chainId: BigInt(chainId) });
    const service = new EvmAnchorService(makeEnv(chainId));

    const receipt = await service.anchor(input);

    expect(receipt.chainId).toBe(chainId);
    expect(sendAnchor).toHaveBeenCalledTimes(1);
  }
);

test('lote ja ancorado com a mesma raiz nao envia outra transacao', async () => {
  getAnchor.mockResolvedValue({
    anchoredAt: 1n,
    root: input.merkleRoot,
    revoked: false,
  });
  const service = new EvmAnchorService(makeEnv());

  const receipt = await service.anchor(input);

  expect(receipt.txRef).toBe('ja-ancorado');
  expect(sendAnchor).not.toHaveBeenCalled();
});

test('lote existente com raiz diferente e recusado', async () => {
  getAnchor.mockResolvedValue({
    anchoredAt: 1n,
    root: '0x' + '22'.repeat(32),
    revoked: false,
  });
  const service = new EvmAnchorService(makeEnv());

  await expect(service.anchor(input)).rejects.toThrow(/raiz diferente/);
  expect(sendAnchor).not.toHaveBeenCalled();
});
