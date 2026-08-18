// Offline local store — IndexedDB backed, user-scoped, envelope based.
import { createStore, get as idbGet, set as idbSet, del as idbDel, keys as idbKeys } from "idb-keyval";

const store = createStore("smartygym-offline", "kv");

export interface Envelope<T = unknown> {
  data: T;
  savedAt: number;
}

export const ANON_SCOPE = "anon";

export const scopedKey = (key: string, userId?: string | null) => `${userId || ANON_SCOPE}::${key}`;

export async function saveOffline<T>(key: string, data: T, userId?: string | null): Promise<void> {
  try {
    const envelope: Envelope<T> = { data, savedAt: Date.now() };
    await idbSet(scopedKey(key, userId), envelope, store);
  } catch (e) {
    console.warn("[offline] save failed", key, e);
  }
}

export async function readOffline<T>(key: string, userId?: string | null): Promise<Envelope<T> | null> {
  try {
    const envelope = (await idbGet(scopedKey(key, userId), store)) as Envelope<T> | undefined;
    return envelope ?? null;
  } catch (e) {
    console.warn("[offline] read failed", key, e);
    return null;
  }
}

export async function removeOffline(key: string, userId?: string | null): Promise<void> {
  try {
    await idbDel(scopedKey(key, userId), store);
  } catch {
    // ignore
  }
}

export async function allKeys(): Promise<string[]> {
  try {
    return ((await idbKeys(store)) as IDBValidKey[]).map((k) => String(k));
  } catch {
    return [];
  }
}

/** Clear ONLY the given account's keys. Never touches other accounts on the device. */
export async function clearUserScope(userId: string): Promise<void> {
  const prefix = `${userId}::`;
  const keys = await allKeys();
  await Promise.all(keys.filter((k) => k.startsWith(prefix)).map((k) => idbDel(k, store)));
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
  const keys = await allKeys();
  if (keys.length <= maxEntries) return 0;

  const expendable: { key: string; savedAt: number }[] = [];
  for (const key of keys) {
    if (isProtectedKey(key)) continue;
    const env = (await idbGet(key, store)) as Envelope | undefined;
    expendable.push({ key, savedAt: env?.savedAt ?? 0 });
  }

  expendable.sort((a, b) => a.savedAt - b.savedAt);
  const toRemove = Math.min(expendable.length, keys.length - maxEntries);
  await Promise.all(expendable.slice(0, toRemove).map((e) => idbDel(e.key, store)));
  return toRemove;
}

// ---- versioning & migrations ----------------------------------------------
// The local store is a versioned KV database. Migrations must NEVER destroy
// user-generated data; they only reshape or drop derived/cached entries.
const META_KEY = "__meta::database-version";

export const LOCAL_DATABASE_VERSION = 2;

type Migration = (keys: string[]) => Promise<void>;

const MIGRATIONS: Record<number, Migration> = {
  // v1 -> v2: content details gained an entitlement-aware shape. Drop only the
  // derived detail entries so they are re-synced; personal data is untouched.
  2: async (keys) => {
    const derived = keys.filter((k) => {
      const bare = k.split("::").slice(1).join("::");
      return bare.startsWith("detail:") && !isProtectedKey(k);
    });
    await Promise.all(derived.map((k) => idbDel(k, store)));
  },
};

/**
 * Opens/upgrades the local database. Safe to call on every start.
 * Returns the version actually in use.
 */
export async function initLocalDatabase(): Promise<number> {
  let current = 0;
  try {
    current = ((await idbGet(META_KEY, store)) as number | undefined) ?? 0;
  } catch {
    return LOCAL_DATABASE_VERSION;
  }
  if (current === LOCAL_DATABASE_VERSION) return current;

  const keys = await allKeys();
  for (let v = current + 1; v <= LOCAL_DATABASE_VERSION; v += 1) {
    const migration = MIGRATIONS[v];
    try {
      if (migration) await migration(keys);
      await idbSet(META_KEY, v, store);
    } catch (e) {
      // Partial migration: keep the last successfully applied version so the
      // next start retries from exactly this point instead of restarting.
      console.warn("[offline] migration failed at v" + v, e);
      return v - 1;
    }
  }
  return LOCAL_DATABASE_VERSION;
}
