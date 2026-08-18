import { useState, useEffect, useCallback } from 'react';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(() => 
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [wasOffline, setWasOffline] = useState(false);

  const updateOnlineStatus = useCallback(() => {
    const online = navigator.onLine;
    setIsOnline(online);
    
    if (!online) {
      setWasOffline(true);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, [updateOnlineStatus]);

  const clearWasOffline = useCallback(() => {
    setWasOffline(false);
  }, []);

  return { 
    isOnline, 
    isOffline: !isOnline,
    wasOffline,
    clearWasOffline
  };
}
