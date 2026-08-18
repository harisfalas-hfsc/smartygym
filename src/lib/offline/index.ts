export * from "./db";
export * from "./offlineFirst";
export * from "./credentials";
export * from "./mutationQueue";
export * from "./session";

import { offlineFirst } from "./offlineFirst";
import { getCurrentUserId } from "./session";

/**
 * Wrap any react-query `queryFn` so it is served from the local store when the
 * network is unavailable. Scoped to the signed-in user automatically.
 */
export const offlineQueryFn =
  <T>(key: string, loader: () => Promise<T>) =>
  () =>
    offlineFirst<T>(key, loader, getCurrentUserId());

export * from "./connectivity";
export * from "./syncStatus";
