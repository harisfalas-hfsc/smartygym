import { useEffect, useState } from "react";

/** Single source of truth for connectivity across the app. */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return { isOnline, isOffline: !isOnline };
}

export const OFFLINE_READ_ONLY_MESSAGE =
  "You're offline — you can view everything saved on this device. Creating new items needs an internet connection.";

export const OFFLINE_NO_COPY_MESSAGE =
  "You're offline and this device has no saved copy yet. Connect once and it will be stored here.";
