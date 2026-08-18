import { readOffline, saveOffline } from "./db";

export class OfflineUnavailableError extends Error {
  constructor(message = "You're offline and this device has no saved copy yet.") {
    super(message);
    this.name = "OfflineUnavailableError";
  }
}

const isOnline = () => (typeof navigator === "undefined" ? true : navigator.onLine);

/**
 * Single read path for the whole app: try the network, persist the fresh result
 * locally, and fall back to the last saved copy on any failure.
 */
export async function offlineFirst<T>(
  key: string,
  loader: () => Promise<T>,
  userId?: string | null,
): Promise<T> {
  if (isOnline()) {
    try {
      const fresh = await loader();
      void saveOffline(key, fresh, userId);
      return fresh;
    } catch (error) {
      const cached = await readOffline<T>(key, userId);
      if (cached) return cached.data;
      throw error;
    }
  }

  const cached = await readOffline<T>(key, userId);
  if (cached) return cached.data;

  // Offline with nothing saved — still try (captive portals / flaky flags).
  try {
    const fresh = await loader();
    void saveOffline(key, fresh, userId);
    return fresh;
  } catch {
    throw new OfflineUnavailableError();
  }
}

/** Read the cached copy without touching the network. */
export async function peekOffline<T>(key: string, userId?: string | null): Promise<T | null> {
  const cached = await readOffline<T>(key, userId);
  return cached ? cached.data : null;
}
