'use client';
import { useEffect } from 'react';
export function OfflineRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(error => console.error('Offline cache failed:', error));
    }
  }, []);
  return null;
}
