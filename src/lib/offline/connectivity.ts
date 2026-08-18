// ConnectivityManager — one source of truth for "can we actually reach the
// backend?". navigator.onLine only tells us the device has *a* network, so we
// combine it with a cheap reachability probe against the backend origin.

export type ConnectivityState =
  | "online" // device online and backend reachable
  | "offline" // device reports no network
  | "unreachable"; // network present but backend not answering

const PROBE_INTERVAL_MS = 60_000;
const PROBE_TIMEOUT_MS = 6_000;
const FAILURE_THRESHOLD = 2;

const backendOrigin = (): string | null => {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  return url ? url.replace(/\/$/, "") : null;
};

let state: ConnectivityState =
  typeof navigator === "undefined" || navigator.onLine ? "online" : "offline";
let consecutiveFailures = 0;
let probing = false;
let started = false;
let timer: number | undefined;

const listeners = new Set<(s: ConnectivityState) => void>();

export const getConnectivity = (): ConnectivityState => state;
export const isReachable = () => state === "online";

const setState = (next: ConnectivityState) => {
  if (next === state) return;
  state = next;
  listeners.forEach((l) => l(state));
};

export const subscribeConnectivity = (listener: (s: ConnectivityState) => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Single reachability probe. Never throws. */
export const probeConnectivity = async (): Promise<ConnectivityState> => {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    consecutiveFailures = 0;
    setState("offline");
    return state;
  }
  if (probing) return state;

  const origin = backendOrigin();
  if (!origin) {
    setState("online");
    return state;
  }

  probing = true;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    // /auth/v1/health is public, tiny and CORS-friendly.
    await fetch(`${origin}/auth/v1/health`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    consecutiveFailures = 0;
    setState("online");
  } catch {
    consecutiveFailures += 1;
    // One flaky request is not an outage — require repeated failures.
    if (consecutiveFailures >= FAILURE_THRESHOLD) setState("unreachable");
  } finally {
    window.clearTimeout(timeout);
    probing = false;
  }
  return state;
};

/** Call once at app start. Idempotent. */
export const startConnectivityMonitor = () => {
  if (started || typeof window === "undefined") return;
  started = true;

  const onOnline = () => {
    consecutiveFailures = 0;
    setState("online");
    void probeConnectivity();
  };
  const onOffline = () => {
    consecutiveFailures = 0;
    setState("offline");
  };

  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void probeConnectivity();
  });

  timer = window.setInterval(() => void probeConnectivity(), PROBE_INTERVAL_MS);
  void probeConnectivity();
};

export const stopConnectivityMonitor = () => {
  if (timer) window.clearInterval(timer);
  timer = undefined;
  started = false;
};

/**
 * Report a request outcome from anywhere in the app so connectivity reflects
 * real traffic instead of only the periodic probe.
 */
export const reportRequestFailure = () => {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    setState("offline");
    return;
  }
  consecutiveFailures += 1;
  if (consecutiveFailures >= FAILURE_THRESHOLD) setState("unreachable");
};

export const reportRequestSuccess = () => {
  consecutiveFailures = 0;
  setState("online");
};
