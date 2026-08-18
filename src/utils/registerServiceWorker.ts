// Guarded service worker registration. Refuses to register in Lovable preview,
// dev mode, iframes, or when ?sw=off is set. In refused contexts it actively
// unregisters any existing /sw.js to avoid stale workers.

const APP_SW_URL = "/sw.js";

const shouldSkipRegistration = (): boolean => {
  if (typeof window === "undefined") return true;
  if (!("serviceWorker" in navigator)) return true;
  if (!import.meta.env.PROD) return true;

  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }

  const url = new URL(window.location.href);
  if (url.searchParams.get("sw") === "off") return true;

  const host = window.location.hostname;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return true;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return true;
  if (host === "lovable.app" || host.endsWith(".lovable.app")) {
    // Only skip on preview subdomains, not the published app.
    if (host.includes("id-preview--") || host.includes("preview--")) return true;
  }
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return true;

  return false;
};

const unregisterAppWorkers = async () => {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs.map(async (reg) => {
        const scriptURL = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || "";
        if (scriptURL.endsWith("/sw.js") || scriptURL.endsWith("/service-worker.js")) {
          await reg.unregister();
        }
      })
    );
  } catch {
    // ignore
  }
};

type UpdateListener = () => void;
const updateListeners = new Set<UpdateListener>();
let waitingWorker: ServiceWorker | null = null;

export const onServiceWorkerUpdate = (listener: UpdateListener) => {
  updateListeners.add(listener);
  if (waitingWorker) listener();
  return () => {
    updateListeners.delete(listener);
  };
};

export const applyServiceWorkerUpdate = () => {
  if (waitingWorker) {
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  }
  window.location.reload();
};

const watchForUpdates = (reg: ServiceWorkerRegistration) => {
  const notify = (worker: ServiceWorker | null) => {
    if (!worker) return;
    waitingWorker = worker;
    updateListeners.forEach((listener) => listener());
  };

  if (reg.waiting && navigator.serviceWorker.controller) notify(reg.waiting);

  reg.addEventListener("updatefound", () => {
    const installing = reg.installing;
    if (!installing) return;
    installing.addEventListener("statechange", () => {
      if (installing.state === "installed" && navigator.serviceWorker.controller) {
        notify(installing);
      }
    });
  });
};

export const registerAppServiceWorker = () => {
  if (shouldSkipRegistration()) {
    void unregisterAppWorkers();
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(APP_SW_URL, { scope: "/" })
      .then((reg) => {
        if (reg) watchForUpdates(reg);
      })
      .catch((err) => {
        console.warn("[sw] registration failed", err);
      });
  });
};