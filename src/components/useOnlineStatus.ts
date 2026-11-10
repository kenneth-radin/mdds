import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Browser online/offline detection for web. On native there is no NetInfo
 * dependency, so this returns true and the dashboard falls back to its
 * reading-staleness check for the Online/Offline badge.
 */
export function useBrowserOnline(): boolean {
  const [online, setOnline] = useState<boolean>(
    Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return online;
}
