import { useEffect } from 'react';
import { CustomSyncLayer } from '../../infrastructure/sync/CustomSyncLayer';

export function useSyncManager() {
  useEffect(() => {
    const syncLayer = new CustomSyncLayer();

    // Trigger sync on mount
    syncLayer.sync();

    // Trigger sync when network comes online
    const handleOnline = () => {
      syncLayer.sync();
    };
    
    window.addEventListener('online', handleOnline);

    // Optional: Polling every 5 minutes if online
    const interval = setInterval(() => {
      if (navigator.onLine) {
        syncLayer.sync();
      }
    }, 5 * 60 * 1000);

    return () => {
      window.removeEventListener('online', handleOnline);
      clearInterval(interval);
    };
  }, []);
}
