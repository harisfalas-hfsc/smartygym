// Persists the react-query cache to IndexedDB so every page the member has
// seen (and everything OfflineBootstrap prefetched) survives a cold start.
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { createStore, get, set, del } from "idb-keyval";

const store = createStore("smartygym-query-cache", "kv");

const scopedPersistenceKey = (key: string) => {
  try {
    const userId = localStorage.getItem("smartygym_offline_user_id") || "anon";
    return `${userId}::${key}`;
  } catch {
    return `anon::${key}`;
  }
};

export const createOfflinePersister = () =>
  createAsyncStoragePersister({
    key: "smartygym-react-query",
    throttleTime: 2000,
    storage: {
      getItem: async (key) => ((await get(scopedPersistenceKey(key), store)) as string | undefined) ?? null,
      setItem: async (key, value) => {
        await set(scopedPersistenceKey(key), value, store);
      },
      removeItem: async (key) => {
        await del(scopedPersistenceKey(key), store);
      },
    },
  });
