import { useEffect } from 'react';
import { subscribeSharedSpaceChanges } from '../../infrastructure/supabase/realtime';
import { sessionSync } from '../../infrastructure/sync/CustomSyncLayer';

/**
 * Triggers an immediate incremental sync when a Realtime event arrives for
 * this space (SC-003) — reuses the existing CustomSyncLayer.sync() rather
 * than a separate pull path, so conflict resolution stays in one place.
 */
export function useSharedSpaceRealtime(spaceId: string | null) {
  useEffect(() => {
    if (!spaceId) return;

    const unsubscribe = subscribeSharedSpaceChanges(spaceId, () => {
      sessionSync.sync();
    });

    return unsubscribe;
  }, [spaceId]);
}
