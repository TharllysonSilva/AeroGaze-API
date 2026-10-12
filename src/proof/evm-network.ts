export function assertAllowedEvmChain(configured: string, actual?: bigint): void {
  if (!['84532', '421614', '31337'].includes(configured)) {
    throw new Error('Ancoragem permitida somente em testnet ou rede local.');
  }
  if (actual !== undefined && actual.toString() !== configured) {
    throw new Error('A rede do RPC diverge de EVM_CHAIN_ID.');
  }
}
