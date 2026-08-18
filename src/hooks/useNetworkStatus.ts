import { useState, useEffect, useCallback, useRef } from 'react';
import { useOnlineStatus } from './useOnlineStatus';

/**
 * Legacy-compatible wrapper around the single ConnectivityManager.
 * Kept so existing callers keep working; do not add a second detection system.
 */
export function useNetworkStatus() {
  const { isOnline, isOffline, isServerUnreachable, state } = useOnlineStatus();
  const [wasOffline, setWasOffline] = useState(false);
  const previous = useRef(isOnline);

  useEffect(() => {
    if (!isOnline) setWasOffline(true);
    previous.current = isOnline;
  }, [isOnline]);

  const clearWasOffline = useCallback(() => setWasOffline(false), []);

  return { state, isOnline, isOffline, isServerUnreachable, wasOffline, clearWasOffline };
}
