import { Capacitor } from "@capacitor/core";
import { Network, type ConnectionStatus } from "@capacitor/network";

type ConnectivityListener = (online: boolean) => void;

let currentOnline = typeof navigator === "undefined" ? true : navigator.onLine;
let initialized = false;
let initializing: Promise<boolean> | null = null;
const listeners = new Set<ConnectivityListener>();

const publish = (online: boolean) => {
  currentOnline = online;
  listeners.forEach((listener) => listener(online));
};

const browserStatus = () => (typeof navigator === "undefined" ? true : navigator.onLine);

/** Initialize the one connectivity source shared by web, PWA, Android and iOS. */
export const initializeConnectivity = async (): Promise<boolean> => {
  if (initialized) return currentOnline;
  if (initializing) return initializing;

  initializing = (async () => {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => publish(true));
      window.addEventListener("offline", () => publish(false));
    }

    if (Capacitor.isNativePlatform()) {
      try {
        const status = await Network.getStatus();
        publish(status.connected);
        await Network.addListener("networkStatusChange", (next: ConnectionStatus) => {
          publish(next.connected);
        });
      } catch {
        publish(browserStatus());
      }
    } else {
      publish(browserStatus());
    }

    initialized = true;
    initializing = null;
    return currentOnline;
  })();

  return initializing;
};

export const getNetworkStatus = async (): Promise<boolean> => {
  if (!initialized) return initializeConnectivity();
  if (Capacitor.isNativePlatform()) {
    try {
      const status = await Network.getStatus();
      publish(status.connected);
    } catch {
      // Keep the last native status when the bridge is temporarily unavailable.
    }
  }
  return currentOnline;
};

export const isNetworkOnline = (): boolean => currentOnline;

export const subscribeConnectivity = (listener: ConnectivityListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};