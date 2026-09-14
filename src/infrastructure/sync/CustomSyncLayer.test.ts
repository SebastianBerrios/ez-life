import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CustomSyncLayer } from './CustomSyncLayer';
import { db } from '../db/db';
import { supabase } from '../supabase/client';

vi.mock('../supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        gt: vi.fn().mockResolvedValue({ data: [], error: null })
      }),
      upsert: vi.fn().mockResolvedValue({ error: null })
    })
  }
}));

describe('CustomSyncLayer', () => {
  beforeEach(async () => {
    await db.movements.clear();
    await db.sync_queue.clear();
    localStorage.clear();
    vi.clearAllMocks();
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
    expect(supabase.from).toHaveBeenCalledWith('movements');

    // Verify it was deleted from queue
    const queue = await db.sync_queue.toArray();
    expect(queue.length).toBe(0);
    expect(localStorage.getItem('last_sync')).toBeTruthy();
  });
});
