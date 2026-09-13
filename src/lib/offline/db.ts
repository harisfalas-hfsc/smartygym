// Compatibility-only API. Offline persistence has been retired permanently;
// callers remain source-compatible but nothing is written to or read from the device.

export interface Envelope<T = unknown> {
  data: T;
  savedAt: number;
}

export const ANON_SCOPE = "anon";

export const scopedKey = (key: string, userId?: string | null) => `${userId || ANON_SCOPE}::${key}`;

export async function saveOffline<T>(key: string, data: T, userId?: string | null): Promise<void> {
  void key;
  void data;
  void userId;
}

export async function readOffline<T>(key: string, userId?: string | null): Promise<Envelope<T> | null> {
  void key;
  void userId;
  return null;
}

export async function removeOffline(key: string, userId?: string | null): Promise<void> {
  void key;
  void userId;
}

export async function allKeys(): Promise<string[]> {
  return [];
}

/** Clear ONLY the given account's keys. Never touches other accounts on the device. */
export async function clearUserScope(userId: string): Promise<void> {
  void userId;
}

/**
 * Keys that must NEVER be evicted — member state. Only expendable detail/media
 * entries can be trimmed, oldest-first.
 */
const PROTECTED_PREFIXES = [
  "account",
  "access",
  "subscription",
  "profile",
  "settings",
  "logbook",
  "progress",
  "history",
  "saved",
  "owned",
  "purchases",
  "favorites",
  "badges",
  "notifications",
  "messages",
  "inbox",
  "community",
  "library:list",
  "library:filters",
  "workouts:list",
  "programs:list",
];

export const isProtectedKey = (scoped: string): boolean => {
  const bare = scoped.split("::").slice(1).join("::");
  return PROTECTED_PREFIXES.some((p) => bare.startsWith(p));
};

/** Evict oldest expendable entries once the store grows past `maxEntries`. */
export async function trimCache(maxEntries = 4000): Promise<number> {
  void maxEntries;
  return 0;
}

// ---- versioning & migrations ----------------------------------------------
// The local store is a versioned KV database. Migrations must NEVER destroy
// user-generated data; they only reshape or drop derived/cached entries.
const META_KEY = "__meta::database-version";

export const LOCAL_DATABASE_VERSION = 2;

/**
 * Retained for callers compiled against the former offline layer.
 */
export async function initLocalDatabase(): Promise<number> {
  return LOCAL_DATABASE_VERSION;
}
