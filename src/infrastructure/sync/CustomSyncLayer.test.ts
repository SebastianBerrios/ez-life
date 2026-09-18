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

  it('pushes profile changes via update, never upsert (Principio IX — profiles can only ever be created by enroll_self(), never a client insert)', async () => {
    await db.sync_queue.put({
      id: 'q-profile',
      table_name: 'profiles',
      data: { id: 'user-1', notification_hour: 20 },
      created_at: new Date(),
    });

    const mockEq = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({ gt: vi.fn().mockResolvedValue({ data: [], error: null }) }),
          update: mockUpdate,
          upsert: mockUpsert,
        };
      }
      return emptyPullUpsertOk();
    });

    const layer = new CustomSyncLayer();
    await layer.sync();

    expect(mockUpdate).toHaveBeenCalledWith({ id: 'user-1', notification_hour: 20 });
    expect(mockEq).toHaveBeenCalledWith('id', 'user-1');
    expect(mockUpsert).not.toHaveBeenCalled();

    const queue = await db.sync_queue.toArray();
    expect(queue.length).toBe(0);
  });

  it('lets a concurrent caller await the same in-flight cycle instead of resolving early', async () => {
    let resolvePull: (value: { data: unknown[]; error: null }) => void;
    const pullPromise = new Promise<{ data: unknown[]; error: null }>(resolve => {
      resolvePull = resolve;
    });
    let pullCallCount = 0;

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        gt: vi.fn().mockImplementation(() => {
          pullCallCount += 1;
          return pullPromise;
        })
      }),
      upsert: vi.fn().mockResolvedValue({ error: null })
    }));

    const layer = new CustomSyncLayer();
    const first = layer.sync();
    const second = layer.sync();

    let secondResolved = false;
    second.then(() => { secondResolved = true; });

    // Give microtasks a chance to run — the second call must NOT have
    // resolved yet, because the first cycle's pull hasn't finished.
    await Promise.resolve();
    await Promise.resolve();
    expect(secondResolved).toBe(false);

    resolvePull!({ data: [], error: null });
    await Promise.all([first, second]);

    expect(secondResolved).toBe(true);
    // Only one real sync cycle ran, even though sync() was called twice.
    expect(pullCallCount).toBe(17); // one .gt() call per synced table, once
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

  it('discards a superseded stale snapshot for the same row and only pushes the newest one', async () => {
    const older = new Date(Date.now() - 60_000);
    const newer = new Date();

    // A bad snapshot queued before a later fix corrected the row (the
    // real-world case: `distribution_category_id: null` queued, then the
    // row got repaired and re-queued with a valid value).
    await db.sync_queue.put({
      id: 'q-old-bad',
      table_name: 'expense_categories',
      data: { id: 'ec1', distribution_category_id: null },
      created_at: older,
    });
    await db.sync_queue.put({
      id: 'q-new-good',
      table_name: 'expense_categories',
      data: { id: 'ec1', distribution_category_id: 'bucket-1' },
      created_at: newer,
    });

    const mockUpsert = vi.fn().mockImplementation((payload: { distribution_category_id: string | null }) => {
      if (payload.distribution_category_id === null) {
        return Promise.resolve({ error: { code: '23502', message: 'null value in column "distribution_category_id"' } });
      }
      return Promise.resolve({ error: null });
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'expense_categories') {
        return {
          select: vi.fn().mockReturnValue({ gt: vi.fn().mockResolvedValue({ data: [], error: null }) }),
          upsert: mockUpsert,
        };
      }
      return emptyPullUpsertOk();
    });

    const layer = new CustomSyncLayer();
    await layer.sync();

    // The stale bad snapshot was never even sent — only the newest one was.
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert).toHaveBeenCalledWith({ id: 'ec1', distribution_category_id: 'bucket-1' });

    const queue = await db.sync_queue.toArray();
    expect(queue.length).toBe(0); // both the superseded stale entry and the successfully-pushed one are gone
    expect(localStorage.getItem('last_sync')).toBeTruthy();
  });

  it('cleans up superseded entries even when the newest entry for that row also fails', async () => {
    const older = new Date(Date.now() - 60_000);
    const newer = new Date();

    await db.sync_queue.put({
      id: 'q-old',
      table_name: 'expense_categories',
      data: { id: 'ec2', name: 'stale' },
      created_at: older,
    });
    await db.sync_queue.put({
      id: 'q-new-fails',
      table_name: 'expense_categories',
      data: { id: 'ec2', name: 'still broken somehow' },
      created_at: newer,
    });

    const mockUpsert = vi.fn().mockResolvedValue({ error: { message: 'still failing' } });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'expense_categories') {
        return {
          select: vi.fn().mockReturnValue({ gt: vi.fn().mockResolvedValue({ data: [], error: null }) }),
          upsert: mockUpsert,
        };
      }
      return emptyPullUpsertOk();
    });

    const layer = new CustomSyncLayer();
    await layer.sync();

    // Only the newest snapshot was ever attempted.
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert).toHaveBeenCalledWith({ id: 'ec2', name: 'still broken somehow' });

    const queue = await db.sync_queue.toArray();
    expect(queue.length).toBe(1); // the failed newest entry stays queued for retry
    expect(queue[0].id).toBe('q-new-fails'); // the superseded older one was still cleaned up
    expect(localStorage.getItem('last_sync')).toBeFalsy(); // push failure still blocks advancing last_sync
  });

  it('still pushes both entries when they belong to different rows (no false-positive collapsing)', async () => {
    await db.sync_queue.put({
      id: 'q-row-a',
      table_name: 'movements',
      data: { id: 'm-a', amount: 100 },
      created_at: new Date(Date.now() - 1000),
    });
    await db.sync_queue.put({
      id: 'q-row-b',
      table_name: 'movements',
      data: { id: 'm-b', amount: 200 },
      created_at: new Date(),
    });

    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'movements') {
        return {
          select: vi.fn().mockReturnValue({ gt: vi.fn().mockResolvedValue({ data: [], error: null }) }),
          upsert: mockUpsert,
        };
      }
      return emptyPullUpsertOk();
    });

    const layer = new CustomSyncLayer();
    await layer.sync();

    expect(mockUpsert).toHaveBeenCalledTimes(2);
    expect(mockUpsert).toHaveBeenCalledWith({ id: 'm-a', amount: 100 });
    expect(mockUpsert).toHaveBeenCalledWith({ id: 'm-b', amount: 200 });

    const queue = await db.sync_queue.toArray();
    expect(queue.length).toBe(0);
  });
});
