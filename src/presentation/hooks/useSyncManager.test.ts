import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSyncManager } from './useSyncManager';
const { sync } = vi.hoisted(() => ({ sync: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../infrastructure/sync/CustomSyncLayer', () => ({ sessionSync: { sync } }));
describe('useSyncManager', () => {
  it('uses the session coordinator for every mounted consumer', async () => {
    sync.mockClear(); const first = renderHook(() => useSyncManager()); renderHook(() => useSyncManager());
    await first.result.current.syncNow(); expect(sync).toHaveBeenCalledTimes(3);
  });
});
