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

const getLoadedAppBundle = (): string | null => {
  const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]'));
  return scripts.map((script) => script.src).find((src) => src.includes("/assets/index-")) ?? null;
};

const getPublishedAppBundle = (html: string): string | null => {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const scripts = Array.from(parsed.querySelectorAll<HTMLScriptElement>('script[type="module"][src]'));
  const source = scripts.map((script) => script.getAttribute("src")).find((src) => src?.includes("/assets/index-"));
  return source ? new URL(source, window.location.origin).href : null;
};

/** Reload an already-open web app as soon as a newer published bundle is available. */
export const startDeploymentUpdateWatcher = (): (() => void) => {
  if (typeof window === "undefined" || window.location.hostname === "localhost") return () => undefined;

  const loadedBundle = getLoadedAppBundle();
  if (!loadedBundle) return () => undefined;

  let checking = false;
  const checkForUpdate = async () => {
    if (checking || !navigator.onLine) return;
    checking = true;

    try {
      const response = await fetch(`${window.location.pathname}?__smarty_version=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (!response.ok) return;

      const publishedBundle = getPublishedAppBundle(await response.text());
      if (publishedBundle && publishedBundle !== loadedBundle) {
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.set("__smarty_refresh", Date.now().toString());
        window.location.replace(nextUrl.href);
      }
    } catch {
      // A temporary network failure should never interrupt the current screen.
    } finally {
      checking = false;
    }
  };

  const interval = window.setInterval(() => void checkForUpdate(), 10_000);
  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") void checkForUpdate();
  };
  const onOnline = () => void checkForUpdate();

  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("online", onOnline);
  void checkForUpdate();

  return () => {
    window.clearInterval(interval);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("online", onOnline);
  };
};
