import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CustomSyncLayer } from './CustomSyncLayer';
import { db } from '../db/db';

const { mockFrom } = vi.hoisted(() => {
  const mockFrom = vi.fn();
  return { mockFrom };
});

vi.mock('../supabase/client', () => ({
  getSupabaseBrowserClient: vi.fn(() => ({ from: mockFrom }))
}));

function emptyPullUpsertOk() {
  return {
    select: vi.fn().mockReturnValue({
      gt: vi.fn().mockResolvedValue({ data: [], error: null })
    }),
    upsert: vi.fn().mockResolvedValue({ error: null })
  };
}

describe('CustomSyncLayer', () => {
  beforeEach(async () => {
    await db.movements.clear();
    await db.sync_queue.clear();
    localStorage.clear();
    vi.clearAllMocks();
    // Default: no remote changes to pull, pushes succeed. Tests that need
    // different behavior override with mockFrom.mockImplementation(...).
    mockFrom.mockImplementation(() => emptyPullUpsertOk());
  });

  it('should push local pending items and delete from queue', async () => {
    // Inject a pending item
    await db.sync_queue.put({
      id: 'test-sync-1',
      table_name: 'movements',
      data: { id: 'm1', amount: 100 },
      created_at: new Date()
    });

    const layer = new CustomSyncLayer();
    await layer.sync();

    // Verify it was pushed
    expect(mockFrom).toHaveBeenCalledWith('movements');

    // Verify it was deleted from queue
    const queue = await db.sync_queue.toArray();
    expect(queue.length).toBe(0);
    expect(localStorage.getItem('last_sync')).toBeTruthy();
  });

  it('keeps a local tombstone when a newer remote record has no deleted_at', async () => {
    const now = new Date();
    const older = new Date(now.getTime() - 60_000);
    const remoteUpdatedAt = new Date(now.getTime() + 60_000);

    await db.movements.put({
      id: 'm-tombstone',
      user_id: 'u1',
      type: 'EXPENSE',
      amount: 100,
      date: older,
      is_recurring: false,
      created_at: older,
      updated_at: now,
      deleted_at: now, // pending local delete, not yet reflected remotely
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'movements') {
        return {
          select: vi.fn().mockReturnValue({
            gt: vi.fn().mockResolvedValue({
              data: [{
                id: 'm-tombstone',
                user_id: 'u1',
                type: 'EXPENSE',
                amount: 999,
                date: older.toISOString(),
                is_recurring: false,
                created_at: older.toISOString(),
                updated_at: remoteUpdatedAt.toISOString(),
                // no deleted_at: stale pre-delete copy from another device
              }],
              error: null
            })
          }),
          upsert: vi.fn().mockResolvedValue({ error: null })
        };
      }
      return emptyPullUpsertOk();
    });

    const layer = new CustomSyncLayer();
    await layer.sync();

    const local = await db.movements.get('m-tombstone');
    expect(local?.deleted_at).toBeTruthy();
    expect(local?.amount).toBe(100); // not overwritten by the remote record
  });

  it('applies the remote record when the local one is not a tombstone', async () => {
    const now = new Date();
    const older = new Date(now.getTime() - 60_000);

    await db.movements.put({
      id: 'm-normal',
      user_id: 'u1',
      type: 'EXPENSE',
      amount: 100,
      date: older,
      is_recurring: false,
      created_at: older,
      updated_at: older,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'movements') {
        return {
          select: vi.fn().mockReturnValue({
            gt: vi.fn().mockResolvedValue({
              data: [{
                id: 'm-normal',
                user_id: 'u1',
                type: 'EXPENSE',
                amount: 777,
                date: older.toISOString(),
                is_recurring: false,
                created_at: older.toISOString(),
                updated_at: now.toISOString(),
              }],
              error: null
            })
          }),
          upsert: vi.fn().mockResolvedValue({ error: null })
        };
      }
      return emptyPullUpsertOk();
    });

    const layer = new CustomSyncLayer();
    await layer.sync();

    const local = await db.movements.get('m-normal');
    expect(local?.amount).toBe(777); // remote wins, as before
  });

  it('does not advance last_sync when a push fails', async () => {
    await db.sync_queue.put({
      id: 'q1',
      table_name: 'movements',
      data: { id: 'm1', amount: 100 },
      created_at: new Date(),
    });

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        gt: vi.fn().mockResolvedValue({ data: [], error: null })
      }),
      upsert: vi.fn().mockResolvedValue({ error: { message: 'network error' } })
    }));

    const layer = new CustomSyncLayer();
    await layer.sync();

    expect(localStorage.getItem('last_sync')).toBeFalsy();
    const queue = await db.sync_queue.toArray();
    expect(queue.length).toBe(1); // item stays queued for the next cycle
  });
});
