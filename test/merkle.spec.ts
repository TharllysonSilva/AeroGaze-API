import { canonicalize } from '../src/proof/canonical-json';
import { leafHash, merkleProof, merkleRoot, toHex, verifyProof } from '../src/proof/merkle';
import { eventLeafData } from '../src/proof/event-leaf';

describe('canonicalize', () => {
  it('ordena chaves e ignora undefined', () => {
    expect(canonicalize({ b: 1, a: { d: 2, c: [3, { z: 1, y: 2 }] }, u: undefined })).toBe(
      '{"a":{"c":[3,{"y":2,"z":1}],"d":2},"b":1}',
    );
  });
  it('é estável independente da ordem de inserção', () => {
    expect(canonicalize({ x: 1, y: 2 })).toBe(canonicalize({ y: 2, x: 1 }));
  });
});

describe('merkle', () => {
  const mk = (n: number) => Array.from({ length: n }, (_, i) => leafHash(`evento-${i}`));

  it.each([1, 2, 3, 4, 5, 7, 8, 13, 100])('prova de cada folha confere com %i folhas', (n) => {
    const leaves = mk(n);
    const root = toHex(merkleRoot(leaves));
    for (let i = 0; i < n; i++) {
      expect(verifyProof(leaves[i], merkleProof(leaves, i), root)).toBe(true);
    }
  });

  it('adulterar um evento depois invalida a prova', () => {
    const leaves = mk(6);
    const root = toHex(merkleRoot(leaves));
    const proof = merkleProof(leaves, 2);
    const forged = leafHash('evento-2-ADULTERADO');
    expect(verifyProof(forged, proof, root)).toBe(false);
  });

  it('ordem dos eventos muda a raiz', () => {
    const a = mk(4);
    const b = [a[1], a[0], a[2], a[3]];
    expect(toHex(merkleRoot(a))).not.toBe(toHex(merkleRoot(b)));
  });

  it('folha e nó interno não se confundem (separação de domínio)', () => {
    const [l0, l1] = mk(2);
    const root = merkleRoot([l0, l1]);
    // Tratar a raiz como se fosse uma "folha" não reproduz a mesma raiz
    expect(merkleRoot([leafHash(Buffer.concat([l0, l1]).toString('utf8'))]).equals(root)).toBe(false);
  });

  it('lote vazio é erro', () => {
    expect(() => merkleRoot([])).toThrow();
  });
});

describe('eventLeafData', () => {
  const base = {
    id: '11111111-1111-4111-8111-111111111111',
    organization_id: 'o',
    farm_id: 'f',
    device_id: 'd',
    type: 'inspection.recorded',
    schema_version: 1,
    occurred_at: '2026-10-07T12:00:00.000Z',
    payload: { b: 2, a: 1 },
  };
  it('é determinístico e sensível a qualquer campo', () => {
    expect(eventLeafData(base)).toBe(eventLeafData({ ...base, payload: { a: 1, b: 2 } }));
    expect(eventLeafData(base)).not.toBe(eventLeafData({ ...base, payload: { a: 1, b: 3 } }));
    expect(eventLeafData(base)).not.toBe(eventLeafData({ ...base, farm_id: 'f2' }));
  });
});
