import { useEffect, useState } from "react";
import { initializeConnectivity, isNetworkOnline, subscribeConnectivity } from "@/lib/offline";

/** Single source of truth for connectivity across the app. */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(isNetworkOnline);

  useEffect(() => {
    void initializeConnectivity().then(setIsOnline);
    return subscribeConnectivity(setIsOnline);
  }, []);

  return { isOnline, isOffline: !isOnline };
}

export const OFFLINE_READ_ONLY_MESSAGE =
  "You're offline — you can view everything saved on this device. Creating new items needs an internet connection.";

export const OFFLINE_NO_COPY_MESSAGE =
  "You're offline and this device has no saved copy yet. Connect once and it will be stored here.";
