import { useState, useEffect, useCallback } from 'react';
import { initializeConnectivity, isNetworkOnline, subscribeConnectivity } from '@/lib/offline';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(isNetworkOnline);
  const [wasOffline, setWasOffline] = useState(false);

  const updateOnlineStatus = useCallback((online: boolean) => {
    setIsOnline(online);
    
    if (!online) {
      setWasOffline(true);
    }
  }, []);

  useEffect(() => {
    void initializeConnectivity().then(updateOnlineStatus);
    return subscribeConnectivity(updateOnlineStatus);
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
