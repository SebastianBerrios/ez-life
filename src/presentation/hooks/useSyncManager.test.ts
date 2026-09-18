import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSyncManager } from './useSyncManager';
import { CustomSyncLayer } from '../../infrastructure/sync/CustomSyncLayer';

vi.mock('../../infrastructure/sync/CustomSyncLayer');

describe('useSyncManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a syncNow function backed by the same CustomSyncLayer instance used for background syncs', async () => {
    const mockSync = vi.fn().mockResolvedValue(undefined);
    vi.mocked(CustomSyncLayer).mockImplementation(function () {
      return { sync: mockSync } as unknown as InstanceType<typeof CustomSyncLayer>;
    });

    const { result } = renderHook(() => useSyncManager());

    // Mount already triggered one sync; calling syncNow() reuses the same instance.
    expect(CustomSyncLayer).toHaveBeenCalledTimes(1);
    expect(mockSync).toHaveBeenCalledTimes(1);

    await result.current.syncNow();

    expect(CustomSyncLayer).toHaveBeenCalledTimes(1); // no second instance created
    expect(mockSync).toHaveBeenCalledTimes(2);
  });
});
