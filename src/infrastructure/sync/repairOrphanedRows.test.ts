import { describe, it, expect, beforeEach } from 'vitest';
import { repairOrphanedLocalRows } from './repairOrphanedRows';
import { db } from '../db/db';

describe('repairOrphanedLocalRows', () => {
  beforeEach(async () => {
    await db.profiles.clear();
    await db.movements.clear();
    await db.income_sources.clear();
    await db.sync_queue.clear();
  });

  it('re-keys a movement created under a stale user_id to the correct session user id', async () => {
    await db.movements.put({
      id: 'm1',
      user_id: 'stale-random-uuid',
      type: 'EXPENSE',
      amount: 100,
      date: new Date(),
      is_recurring: false,
      created_at: new Date(),
      updated_at: new Date(),
    });

    await repairOrphanedLocalRows('real-session-id');

    const repaired = await db.movements.get('m1');
    expect(repaired?.user_id).toBe('real-session-id');
  });

  it('re-queues a repaired row for push (Dexie updating hook fires)', async () => {
    await db.movements.put({
      id: 'm1',
      user_id: 'stale-random-uuid',
      type: 'EXPENSE',
      amount: 100,
      date: new Date(),
      is_recurring: false,
      created_at: new Date(),
      updated_at: new Date(),
    });

    await repairOrphanedLocalRows('real-session-id');

    const queue = (await db.sync_queue.toArray()).filter(item => item.table_name === 'movements');
    expect(queue.length).toBeGreaterThan(0);
    expect(queue.some(item => item.data.user_id === 'real-session-id')).toBe(true);
  });

  it('does not touch rows that already belong to the correct user', async () => {
    const original = {
      id: 'm2',
      user_id: 'real-session-id',
      type: 'EXPENSE' as const,
      amount: 200,
      date: new Date(),
      is_recurring: false,
      created_at: new Date(),
      updated_at: new Date(),
    };
    await db.movements.put(original);
    await db.sync_queue.clear(); // ignore the queue entry from the initial put

    await repairOrphanedLocalRows('real-session-id');

    const queue = await db.sync_queue.toArray();
    expect(queue.length).toBe(0);
  });

  it('re-keys a stray local profile row to the session id when no correct profile exists yet', async () => {
    await db.profiles.put({
      id: 'stale-random-uuid',
      notification_hour: 20,
      created_at: new Date(),
      updated_at: new Date(),
    });

    await repairOrphanedLocalRows('real-session-id');

    const repaired = await db.profiles.get('real-session-id');
    expect(repaired?.notification_hour).toBe(20);
    expect(await db.profiles.get('stale-random-uuid')).toBeUndefined();
  });

  it('discards the stray profile row without overwriting an existing correct one', async () => {
    await db.profiles.put({
      id: 'real-session-id',
      notification_hour: 9,
      created_at: new Date(),
      updated_at: new Date(),
    });
    await db.profiles.put({
      id: 'stale-random-uuid',
      notification_hour: 20,
      created_at: new Date(),
      updated_at: new Date(),
    });

    await repairOrphanedLocalRows('real-session-id');

    const correct = await db.profiles.get('real-session-id');
    expect(correct?.notification_hour).toBe(9); // untouched, not clobbered by the stray
    expect(await db.profiles.get('stale-random-uuid')).toBeUndefined();
  });

  it('is a no-op when given an empty user id', async () => {
    await db.movements.put({
      id: 'm1',
      user_id: 'stale-random-uuid',
      type: 'EXPENSE',
      amount: 100,
      date: new Date(),
      is_recurring: false,
      created_at: new Date(),
      updated_at: new Date(),
    });

    await repairOrphanedLocalRows('');

    const untouched = await db.movements.get('m1');
    expect(untouched?.user_id).toBe('stale-random-uuid');
  });
});
