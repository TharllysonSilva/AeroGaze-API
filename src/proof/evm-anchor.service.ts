import { assertAllowedEvmChain } from './evm-network';
import { Injectable } from '@nestjs/common';
import { Contract, JsonRpcProvider, Wallet, id as keccakId } from 'ethers';
import { AppEnv } from '../config/env';
import { AnchorInput, AnchorReceipt, AnchorService, OnChainAnchor } from './anchor.service';

const ABI = [
  'function anchor(bytes32 batchId, bytes32 root, bytes32 farmRef, uint32 leafCount, uint32 schemaVersion) external',
  'function getAnchor(bytes32 batchId) view returns (tuple(bytes32 root, address issuer, uint64 anchoredAt, uint32 leafCount, uint32 schemaVersion, bool revoked, bytes32 farmRef))',
];

/**
 * Ancoragem real no contrato EvidenceRegistry (qualquer rede EVM: Base, Arbitrum, Optimism, Ethereum).
 * Na rede vão SÓ hashes: o batchId e o farmId viram keccak256 (sem dado pessoal, sem telemetria).
 */
@Injectable()
export class EvmAnchorService implements AnchorService {
  private readonly contract: Contract;
  private readonly provider: JsonRpcProvider;
  private readonly expectedChainId: string;

  constructor(env: AppEnv) {
    assertAllowedEvmChain(env.evm.chainId);
    this.expectedChainId = env.evm.chainId;
    this.provider = new JsonRpcProvider(env.evm.rpcUrl);
    const wallet = new Wallet(env.evm.privateKey, this.provider);
    this.contract = new Contract(env.evm.registryAddress, ABI, wallet);
  }

  async anchor(input: AnchorInput): Promise<AnchorReceipt> {
    const batchRef = keccakId(input.batchId);
    const network = await this.provider.getNetwork();
    assertAllowedEvmChain(this.expectedChainId, network.chainId);

    // Idempotência: se uma tentativa anterior chegou à rede mas a resposta se perdeu, não reenvia.
    const existing = await this.readAnchor(input.batchId);
    if (existing) {
      if (existing.root.toLowerCase() !== input.merkleRoot.toLowerCase()) {
        throw new Error('lote já ancorado com raiz diferente: investigar (possível adulteração)');
      }
      return { mode: 'evm', chainId: network.chainId.toString(), txRef: 'ja-ancorado', blockNumber: null };
    }

    const tx = await this.contract.anchor(
      batchRef,
      input.merkleRoot,
      keccakId(input.farmId),
      input.leafCount,
      input.schemaVersion,
    );
    const receipt = await tx.wait(1);
    return {
      mode: 'evm',
      chainId: network.chainId.toString(),
      txRef: tx.hash,
      blockNumber: receipt?.blockNumber ?? null,
    };
  }

  async readAnchor(batchId: string): Promise<OnChainAnchor | null> {
    const network = await this.provider.getNetwork();
    assertAllowedEvmChain(this.expectedChainId, network.chainId);
    const a = await this.contract.getAnchor(keccakId(batchId));
    if (BigInt(a.anchoredAt) === 0n) return null;
    return { root: a.root as string, revoked: Boolean(a.revoked) };
  }
}
