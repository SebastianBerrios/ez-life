import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db/db';
import { LocalSyncStatusRepository } from './LocalSyncStatusRepository';

describe('LocalSyncStatusRepository', () => {
  beforeEach(async () => { await db.delete(); await db.open(); });

  it('reports a locally written record as pending until the queue is drained', async () => {
    const now = new Date();
    const saved = { id: 'm-local', user_id: 'A', type: 'EXPENSE' as const, amount: 100, date: now, is_recurring: false, created_at: now, updated_at: now };
    await db.movements.put(saved); // the creating hook mirrors the write into sync_queue
    const status = new LocalSyncStatusRepository();
    expect((await status.getPendingRecordIds('movements')).has(saved.id)).toBe(true);

    await db.sync_queue.clear(); // what CustomSyncLayer does after a successful push
    expect((await status.getPendingRecordIds('movements')).has(saved.id)).toBe(false);
  });

  it('only returns ids of the requested table', async () => {
    await db.sync_queue.bulkPut([
      { id: 'q1', table_name: 'movements', data: { id: 'm1' }, created_at: new Date() },
      { id: 'q2', table_name: 'movements', data: { id: 'm1' }, created_at: new Date() },
      { id: 'q3', table_name: 'debts', data: { id: 'd1' }, created_at: new Date() },
    ]);
    const status = new LocalSyncStatusRepository();
    expect([...(await status.getPendingRecordIds('movements'))]).toEqual(['m1']);
    expect([...(await status.getPendingRecordIds('debts'))]).toEqual(['d1']);
    expect((await status.getPendingRecordIds('tasks')).size).toBe(0);
  });
});
