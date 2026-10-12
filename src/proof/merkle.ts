import { createHash } from 'crypto';

/**
 * Árvore de Merkle com separação de domínio (0x00 = folha, 0x01 = nó interno), que impede
 * confundir uma folha com um nó. Nó sem par sobe sem alteração (não duplica a última folha).
 */
const sha256 = (...parts: Buffer[]): Buffer => createHash('sha256').update(Buffer.concat(parts)).digest();

export const toHex = (b: Buffer): string => '0x' + b.toString('hex');
export const fromHex = (h: string): Buffer => Buffer.from(h.replace(/^0x/, ''), 'hex');

export const leafHash = (canonicalData: string): Buffer =>
  sha256(Buffer.from([0x00]), Buffer.from(canonicalData, 'utf8'));

const nodeHash = (left: Buffer, right: Buffer): Buffer => sha256(Buffer.from([0x01]), left, right);

export interface ProofStep {
  position: 'left' | 'right'; // lado em que o IRMÃO fica
  hash: string;
}

function buildLevels(leaves: Buffer[]): Buffer[][] {
  if (leaves.length === 0) throw new Error('lote vazio');
  const levels: Buffer[][] = [leaves];
  while (levels[levels.length - 1].length > 1) {
    const cur = levels[levels.length - 1];
    const next: Buffer[] = [];
    for (let i = 0; i < cur.length; i += 2) {
      next.push(i + 1 < cur.length ? nodeHash(cur[i], cur[i + 1]) : cur[i]);
    }
    levels.push(next);
  }
  return levels;
}

export function merkleRoot(leaves: Buffer[]): Buffer {
  const levels = buildLevels(leaves);
  return levels[levels.length - 1][0];
}

export function merkleProof(leaves: Buffer[], index: number): ProofStep[] {
  if (index < 0 || index >= leaves.length) throw new Error('índice fora do lote');
  const levels = buildLevels(leaves);
  const proof: ProofStep[] = [];
  let idx = index;
  for (let l = 0; l < levels.length - 1; l++) {
    const level = levels[l];
    const isRight = idx % 2 === 1;
    const siblingIdx = isRight ? idx - 1 : idx + 1;
    if (siblingIdx < level.length) {
      proof.push({ position: isRight ? 'left' : 'right', hash: toHex(level[siblingIdx]) });
    }
    idx = Math.floor(idx / 2);
  }
  return proof;
}

export function verifyProof(leaf: Buffer, proof: ProofStep[], expectedRoot: string): boolean {
  let acc = leaf;
  for (const step of proof) {
    const sib = fromHex(step.hash);
    acc = step.position === 'left' ? nodeHash(sib, acc) : nodeHash(acc, sib);
  }
  return toHex(acc).toLowerCase() === expectedRoot.toLowerCase();
}
