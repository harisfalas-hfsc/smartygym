// Persists the react-query cache to IndexedDB so every page the member has
// seen (and everything OfflineBootstrap prefetched) survives a cold start.
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { createStore, get, set, del } from "idb-keyval";

const store = createStore("smartygym-query-cache", "kv");

export const createOfflinePersister = () =>
  createAsyncStoragePersister({
    key: "smartygym-react-query",
    throttleTime: 2000,
    storage: {
      getItem: async (key) => ((await get(key, store)) as string | undefined) ?? null,
      setItem: async (key, value) => {
        await set(key, value, store);
      },
      removeItem: async (key) => {
        await del(key, store);
      },
    },
  });
