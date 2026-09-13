import { reportRequestFailure, reportRequestSuccess } from "./connectivity";

export class OfflineUnavailableError extends Error {
  constructor(message = "You're offline and this device has no saved copy yet.") {
    super(message);
    this.name = "OfflineUnavailableError";
  }
}

/**
 * SmartyGym no longer serves content from a local cache. Every read — web,
 * installed PWA, or the native Android/iOS WebView — goes straight to the
 * database, so newly published workouts and programs appear immediately on
 * every device. The helper name is kept so existing call sites stay unchanged.
 */
export async function offlineFirst<T>(
  _key: string,
  loader: () => Promise<T>,
  _userId?: string | null,
): Promise<T> {
  try {
    const fresh = await loader();
    reportRequestSuccess();
    return fresh;
  } catch (error) {
    reportRequestFailure();
    throw error;
  }
}

/** Retained for compatibility — there is no local copy to peek at any more. */
export async function peekOffline<T>(_key: string, _userId?: string | null): Promise<T | null> {
  return null;
}
