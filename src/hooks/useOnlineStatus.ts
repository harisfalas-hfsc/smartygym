import { useEffect, useState } from "react";
import {
  getConnectivity,
  startConnectivityMonitor,
  subscribeConnectivity,
  type ConnectivityState,
} from "@/lib/offline/connectivity";

/**
 * Single source of truth for connectivity across the app.
 * Backed by the ConnectivityManager (device state + backend reachability),
 * never by navigator.onLine alone.
 */
export function useOnlineStatus() {
  const [state, setState] = useState<ConnectivityState>(() => getConnectivity());

  useEffect(() => {
    startConnectivityMonitor();
    setState(getConnectivity());
    return subscribeConnectivity(setState);
  }, []);

  return {
    state,
    isOnline: state === "online",
    isOffline: state !== "online",
    /** Network exists but our backend is not answering. */
    isServerUnreachable: state === "unreachable",
  };
}

export const OFFLINE_READ_ONLY_MESSAGE =
  "You're offline — you can view everything saved on this device. Creating new items needs an internet connection.";

export const OFFLINE_NO_COPY_MESSAGE =
  "You're offline and this device has no saved copy yet. Connect once and it will be stored here.";

export const SERVER_UNREACHABLE_MESSAGE =
  "We can't reach SmartyGym right now. Your saved content is still available on this device.";
