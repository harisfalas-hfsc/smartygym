// SmartyGym no longer runs an offline app-shell service worker. Old installs
// (browser, PWA, WebView wrappers) must be cleaned up so every visit loads the
// current deployment straight from the network.

const APP_CACHE_NAMES = [
  "smartygym-app-identity",
  "smartygym-pages",
  "html-pages",
  "static-assets",
  "images",
  "google-fonts",
  "supabase-storage",
];

const LEGACY_DATABASES = ["smartygym-query-cache", "smartygym-offline"];

/** Unregister every app service worker and drop its caches. Safe to call always. */
export const purgeAppServiceWorkers = async (): Promise<void> => {
  if (typeof window === "undefined") return;

  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        regs.map(async (reg) => {
          const scriptURL =
            reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || "";
          // Leave messaging workers (push notifications) alone.
          if (scriptURL.includes("firebase-messaging-sw") || scriptURL.includes("OneSignal")) return;
          await reg.unregister();
        })
      );
    }
  } catch {
    // ignore
  }

  try {
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
    }
  } catch {
    // ignore
  }

  // Drop every database created by the retired offline implementation. These
  // stores contain only obsolete device copies and must never affect live data.
  await Promise.allSettled(
    LEGACY_DATABASES.map(
      (name) =>
        new Promise<void>((resolve) => {
          try {
            const request = indexedDB.deleteDatabase(name);
            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
            request.onblocked = () => resolve();
          } catch {
            resolve();
          }
        }),
    ),
  );
};

