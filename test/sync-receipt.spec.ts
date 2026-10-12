import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { SyncController } from '../src/sync/sync.controller';
const user: any = { id: 'user-a', organizationId: 'org-a', farmId: 'farm-a' };
const eventId = 'event-a';
function setup() {
  const db = { query: jest.fn() }; const scope = { assertFarm: jest.fn() };
  return { db, scope, controller: new SyncController({} as any, db as any, scope as any) };
}
test('receipt resolves tasks and batch only after organization and farm validation', async () => {
  const { db, scope, controller } = setup();
  db.query.mockResolvedValueOnce({ rows: [{ id: eventId, farm_id: 'farm-a' }] })
    .mockResolvedValueOnce({ rows: [{ id: 'task-a' }] }).mockResolvedValueOnce({ rows: [{ id: 'batch-a', status: 'ancorado' }] });
  expect(await controller.receipt(user, eventId)).toEqual({ eventId, ingestion: 'accepted', tasks: [{ id: 'task-a' }], batch: { id: 'batch-a', status: 'ancorado' } });
  expect(db.query.mock.calls.every((call) => call[1][1] === 'org-a')).toBe(true);
  expect(scope.assertFarm).toHaveBeenCalledWith(user, 'farm-a');
});
test('unknown event does not leak tasks or batches', async () => {
  const { db, controller } = setup(); db.query.mockResolvedValue({ rows: [] });
  await expect(controller.receipt(user, eventId)).rejects.toBeInstanceOf(NotFoundException);
  expect(db.query).toHaveBeenCalledTimes(1);
});
test('farm denial stops receipt lookup', async () => {
  const { db, scope, controller } = setup(); db.query.mockResolvedValue({ rows: [{ farm_id: 'other' }] });
  scope.assertFarm.mockRejectedValue(new ForbiddenException());
  await expect(controller.receipt(user, eventId)).rejects.toBeInstanceOf(ForbiddenException);
  expect(db.query).toHaveBeenCalledTimes(1);
});
test('accepted event without batch returns pending receipt', async () => {
  const { db, controller } = setup(); db.query.mockResolvedValueOnce({ rows: [{ farm_id: 'farm-a' }] }).mockResolvedValue({ rows: [] });
  expect((await controller.receipt(user, eventId)).batch).toBeNull();
});
