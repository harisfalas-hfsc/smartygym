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
