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

const getAppBundle = (documentRoot: Document): string | null => {
  const source = Array.from(documentRoot.querySelectorAll<HTMLScriptElement>('script[type="module"][src]'))
    .map((script) => script.getAttribute("src"))
    .find((src) => src?.includes("/assets/index-"));
  return source ? new URL(source, window.location.origin).href : null;
};

/** Refresh already-open clients when the live deployment changes. */
export const startDeploymentUpdateWatcher = (): (() => void) => {
  if (typeof window === "undefined" || window.location.hostname === "localhost") return () => undefined;
  const loadedBundle = getAppBundle(document);
  if (!loadedBundle) return () => undefined;

  let checking = false;
  const check = async () => {
    if (checking || !navigator.onLine) return;
    checking = true;
    try {
      // Always inspect the root document, avoiding route-specific prerender or CDN variance.
      const response = await fetch(`/?__smarty_version=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
      });
      if (!response.ok) return;
      const publishedDocument = new DOMParser().parseFromString(await response.text(), "text/html");
      const publishedBundle = getAppBundle(publishedDocument);
      if (publishedBundle && publishedBundle !== loadedBundle) {
        window.location.reload();
      }
    } catch {
      // Keep the current screen usable during temporary connectivity failures.
    } finally {
      checking = false;
    }
  };

  const interval = window.setInterval(() => void check(), 10_000);
  const onVisible = () => document.visibilityState === "visible" && void check();
  window.addEventListener("online", check);
  document.addEventListener("visibilitychange", onVisible);
  void check();

  return () => {
    window.clearInterval(interval);
    window.removeEventListener("online", check);
    document.removeEventListener("visibilitychange", onVisible);
  };
};

