import { useEffect, useState } from 'react';

/**
 * Returns whether the browser reports being online.
 *
 * Notes:
 * - `navigator.onLine` is best-effort; it may be `true` even when the API is unreachable.
 * - We still keep this as a user-friendly signal ("Offline"), while API errors are handled separately.
 */
export function useNetworkStatus(): boolean {
  const [online, setOnline] = useState(() => {
    if (typeof navigator === 'undefined') return true;
    return Boolean(navigator.onLine);
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return online;
}
