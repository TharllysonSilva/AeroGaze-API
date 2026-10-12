/**
 * Contrato entre o worker e "onde a prova é ancorada".
 * Hoje: MockAnchorService (recibo simulado) ou EvmAnchorService (contrato EvidenceRegistry).
 * Trocar de rede (ou usar Solana) = escrever outra classe que implemente esta interface.
 */
export const ANCHOR_SERVICE = 'ANCHOR_SERVICE';

export interface AnchorInput {
  batchId: string;
  farmId: string;
  merkleRoot: string; // 0x + 64 hex
  leafCount: number;
  schemaVersion: number;
}

export interface AnchorReceipt {
  mode: 'mock' | 'evm';
  chainId: string;
  txRef: string;
  blockNumber: number | null;
}

export interface OnChainAnchor {
  root: string;
  revoked: boolean;
}

export interface AnchorService {
  anchor(input: AnchorInput): Promise<AnchorReceipt>;
  /** Lê o que está gravado na rede. null = não há registro (ou o modo não lê rede). */
  readAnchor(batchId: string): Promise<OnChainAnchor | null>;
}
