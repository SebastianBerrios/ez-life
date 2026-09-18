import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db';

describe('Local Database (Dexie.js)', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('should initialize successfully with all required tables', () => {
    expect(db.profiles).toBeDefined();
    expect(db.income_sources).toBeDefined();
    expect(db.distribution_categories).toBeDefined();
    expect(db.expense_categories).toBeDefined();
    expect(db.expense_subcategories).toBeDefined();
    expect(db.savings_goals).toBeDefined();
    expect(db.movements).toBeDefined();
    expect(db.sync_queue).toBeDefined();
  });

  describe('sync_queue mirroring via creating/updating hooks', () => {
    // Regression test: a plain `db.<table>.put(...)` call (as every
    // Local*Repository does) only opens an implicit transaction scoped to
    // that one table. Without the dbcore middleware in
    // `setupSyncQueueTransactionScope()`, the creating/updating hooks'
    // `trans.table('sync_queue').put(...)` targets a store outside that
    // transaction's scope and silently drops the write — no error, but
    // nothing ever lands in sync_queue, so nothing would ever sync.
    it('enqueues a sync_queue row when a movement is created through a plain put()', async () => {
      await db.movements.put({
        id: 'movement-1',
        user_id: 'user-1',
        date: new Date(),
        amount: 1000,
        type: 'expense',
        created_at: new Date(),
        updated_at: new Date()
      } as never);

      const all = await db.sync_queue.toArray();
      const queued = all.filter(q => q.table_name === 'movements');
      expect(queued).toHaveLength(1);
      expect((queued[0].data as { id: string }).id).toBe('movement-1');
    });

    it('enqueues a sync_queue row when a task is created through a plain put()', async () => {
      await db.tasks.put({
        id: 'task-1',
        user_id: 'user-1',
        title: 'Pagar cuota',
        due_date: new Date(),
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date()
      } as never);

      const all = await db.sync_queue.toArray();
      const queued = all.filter(q => q.table_name === 'tasks');
      expect(queued).toHaveLength(1);
      expect((queued[0].data as { id: string }).id).toBe('task-1');
    });

    it('enqueues a sync_queue row when an existing movement is updated through a plain put()', async () => {
      const base = {
        id: 'movement-2',
        user_id: 'user-1',
        date: new Date(),
        amount: 500,
        type: 'expense',
        created_at: new Date(),
        updated_at: new Date()
      };
      await db.movements.put(base as never);

      await db.movements.put({ ...base, amount: 750, updated_at: new Date() } as never);

      const all = await db.sync_queue.toArray();
      const queued = all.filter(q => q.table_name === 'movements');
      expect(queued.length).toBeGreaterThanOrEqual(2);
      expect(queued.some(q => (q.data as { amount: number }).amount === 750)).toBe(true);
    });
  });
});
