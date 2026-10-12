import { BatchService } from '../src/proof/batch.service';
import { ProofController } from '../src/proof/proof.controller';
import { toHex } from '../src/proof/merkle';
const leaf = Buffer.alloc(32, 7);
test('RPC outage preserves pending batch and schedules retry without modifying tasks', async () => {
  const batch = { id: 'batch-a', farm_id: 'farm-a', merkle_root: toHex(leaf), leaf_count: 1, schema_version: 1, attempts: 0 };
  const db = { query: jest.fn().mockResolvedValueOnce({ rows: [batch] }).mockResolvedValue({ rows: [] }) };
  const anchor = { anchor: jest.fn().mockRejectedValue(new Error('RPC offline')) };
  const service = new BatchService(db as any, {} as any, anchor as any);
  expect(await service.anchorPending()).toBe(0);
  expect(db.query.mock.calls[1][1]).toEqual(['batch-a', 1, 'pendente', 'RPC offline', '120']);
  expect(db.query.mock.calls.some(([sql]) => /tasks/i.test(sql))).toBe(false);
});
test('after RPC recovery the same batch is anchored without creating another batch', async () => {
  const batch = { id: 'batch-a', farm_id: 'farm-a', merkle_root: toHex(leaf), leaf_count: 1, schema_version: 1, attempts: 1 };
  const db = { query: jest.fn().mockResolvedValueOnce({ rows: [batch] }).mockResolvedValue({ rows: [] }) };
  const anchor = { anchor: jest.fn().mockResolvedValue({ mode: 'evm', chainId: '84532', txRef: 'tx-a', blockNumber: 12 }) };
  expect(await new BatchService(db as any, {} as any, anchor as any).anchorPending()).toBe(1);
  expect(anchor.anchor.mock.calls[0][0].batchId).toBe('batch-a');
  expect(db.query.mock.calls[1][1]).toEqual(['batch-a', 'evm', '84532', 'tx-a', 12]);
});
test('public verification does not mark RPC outage as tampering or network confirmation', async () => {
  const db = { query: jest.fn().mockResolvedValue({ rows: [{ id: 'batch-a', merkle_root: toHex(leaf), leaf_count: 1, status: 'ancorado', anchor_mode: 'evm', chain_id: '84532' }] }) };
  const controller = new ProofController(db as any, {} as any, { readAnchor: jest.fn().mockRejectedValue(new Error('offline')) } as any);
  jest.spyOn(controller as any, 'recompute').mockResolvedValue({ leaves: [leaf], rows: [{ event_id: 'event-a', stored_leaf: toHex(leaf) }] });
  const result = await controller.verify('batch-a');
  expect(result.onChain).toEqual({ checked: false });
  expect(result.tamperedEventCount).toBe(0);
});
