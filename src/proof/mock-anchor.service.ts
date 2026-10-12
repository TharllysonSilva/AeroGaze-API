import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { AnchorInput, AnchorReceipt, AnchorService, OnChainAnchor } from './anchor.service';

/** Recibo simulado: permite demonstrar o fluxo inteiro sem rede, carteira ou custo. */
@Injectable()
export class MockAnchorService implements AnchorService {
  async anchor(input: AnchorInput): Promise<AnchorReceipt> {
    const fake = createHash('sha256').update(`${input.batchId}:${input.merkleRoot}`).digest('hex');
    return { mode: 'mock', chainId: 'mock', txRef: `0xmock${fake.slice(0, 58)}`, blockNumber: null };
  }

  async readAnchor(): Promise<OnChainAnchor | null> {
    return null; // modo simulado não tem rede para consultar
  }
}
