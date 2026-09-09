// Kill-switch service worker.
// SmartyGym no longer ships an offline app-shell worker. This replacement
// evicts the old Workbox caches for this registration, reloads open tabs so
// they pick up the current deployment, then unregisters itself for good.
function isWorkboxCacheForThisRegistration(name) {
  const hasWorkboxBucket = /(^|-)precache-v\d+-|(^|-)runtime-|(^|-)googleAnalytics-/.test(name);
  return hasWorkboxBucket && name.endsWith(self.registration.scope);
}

const APP_CACHE_NAMES = [
  "smartygym-app-identity",
  "smartygym-pages",
  "html-pages",
  "static-assets",
  "images",
  "google-fonts",
  "supabase-storage",
];

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        const doomed = cacheNames.filter(
          (name) => isWorkboxCacheForThisRegistration(name) || APP_CACHE_NAMES.includes(name)
        );
        await Promise.allSettled(doomed.map((name) => caches.delete(name)));
        await self.clients.claim();
        const windowClients = await self.clients.matchAll({ type: "window" });
        await Promise.allSettled(windowClients.map((client) => client.navigate(client.url)));
      } finally {
        await self.registration.unregister();
      }
    })()
  )
);
