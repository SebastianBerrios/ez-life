import { useEffect, useRef, useCallback } from 'react';
import { CustomSyncLayer } from '../../infrastructure/sync/CustomSyncLayer';

export function useSyncManager() {
  const syncLayerRef = useRef<CustomSyncLayer | null>(null);
  if (!syncLayerRef.current) {
    syncLayerRef.current = new CustomSyncLayer();
  }

  // Exposed so callers that need to know a sync cycle actually finished
  // (e.g. deciding whether a device needs onboarding) can await it, sharing
  // the same CustomSyncLayer instance/in-flight cycle as the background jobs
  // below instead of racing a separate one.
  const syncNow = useCallback(() => syncLayerRef.current!.sync(), []);

  useEffect(() => {
    // Trigger sync on mount
    syncNow();

    // Trigger sync when network comes online
    const handleOnline = () => {
      syncNow();
    };

    window.addEventListener('online', handleOnline);

    // Optional: Polling every 5 minutes if online
    const interval = setInterval(() => {
      if (navigator.onLine) {
        syncNow();
      }
    }, 5 * 60 * 1000);

    return () => {
      window.removeEventListener('online', handleOnline);
      clearInterval(interval);
    };
  }, [syncNow]);

  return { syncNow };
}
