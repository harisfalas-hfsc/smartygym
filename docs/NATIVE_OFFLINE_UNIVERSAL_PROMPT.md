# Universal Prompt — Make the NATIVE iOS/Android app fully offline (Capacitor)

Paste this whole document into the other project as a single instruction.
It assumes the project already has (or will get) the web/PWA offline layer
(`src/lib/offline/*` + `OfflineBootstrap`). Everything below is what makes the
**submitted native apps** behave exactly like the offline web app.

Replace `smartyXXX` / `SmartyXXX` / `com.smartyXXX.app` with the project's own
names everywhere.

---

## 0. Why the native app failed offline before

Four root causes — fix all four or it stays broken:

1. The app used `navigator.onLine`. Inside an iOS/Android WebView this value is
   unreliable (often reports `true` with no connection, or `false` on a good
   connection), so the app kept trying network calls and hung on a white screen.
2. Auth. On cold start with no network, `supabase.auth.getSession()` never
   resolves usefully, so `ProtectedRoute` bounced the user to `/auth`.
3. The native shell was pointing at the remote server (`server.url` in
   `capacitor.config.ts`) or the `dist` build was never synced, so there was no
   local HTML/JS to boot from.
4. `main.tsx` registered/cleared a service worker on native and cleared Cache
   Storage, wiping the offline data on launch.

---

## 1. Dependencies

```bash
npm i @capacitor/core @capacitor/network idb-keyval \
      @tanstack/query-async-storage-persister @tanstack/react-query-persist-client
npm i -D @capacitor/cli
npm i @capacitor/ios @capacitor/android
```

---

## 2. One connectivity source for web + PWA + iOS + Android

Create `src/lib/offline/connectivity.ts`. This is the ONLY place the app is
allowed to ask "am I online?".

```ts
import { Capacitor } from "@capacitor/core";
import { Network, type ConnectionStatus } from "@capacitor/network";

type ConnectivityListener = (online: boolean) => void;

let currentOnline = typeof navigator === "undefined" ? true : navigator.onLine;
let initialized = false;
let initializing: Promise<boolean> | null = null;
const listeners = new Set<ConnectivityListener>();

const publish = (online: boolean) => {
  currentOnline = online;
  listeners.forEach((l) => l(online));
};

const browserStatus = () => (typeof navigator === "undefined" ? true : navigator.onLine);

/** Initialize the one connectivity source shared by web, PWA, Android and iOS. */
export const initializeConnectivity = async (): Promise<boolean> => {
  if (initialized) return currentOnline;
  if (initializing) return initializing;

  initializing = (async () => {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => publish(true));
      window.addEventListener("offline", () => publish(false));
    }

    if (Capacitor.isNativePlatform()) {
      try {
        const status = await Network.getStatus();
        publish(status.connected);
        await Network.addListener("networkStatusChange", (next: ConnectionStatus) =>
          publish(next.connected),
        );
      } catch {
        publish(browserStatus());
      }
    } else {
      publish(browserStatus());
    }

    initialized = true;
    initializing = null;
    return currentOnline;
  })();

  return initializing;
};

export const getNetworkStatus = async (): Promise<boolean> => {
  if (!initialized) return initializeConnectivity();
  if (Capacitor.isNativePlatform()) {
    try {
      const status = await Network.getStatus();
      publish(status.connected);
    } catch {
      // keep last native status when the bridge is unavailable
    }
  }
  return currentOnline;
};

export const isNetworkOnline = (): boolean => currentOnline;

export const subscribeConnectivity = (listener: ConnectivityListener) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
```

Export it from `src/lib/offline/index.ts`:

```ts
export * from "./db";
export * from "./offlineFirst";
export * from "./credentials";
export * from "./mutationQueue";
export * from "./session";
export * from "./connectivity";
```

### Mandatory sweep
Search the whole `src/` tree and replace every direct connectivity read:

| Old | New |
| --- | --- |
| `navigator.onLine` (in async logic) | `await getNetworkStatus()` |
| `navigator.onLine` (in render/state) | `isNetworkOnline()` |
| `window.addEventListener("online"/"offline")` in hooks | `subscribeConnectivity(cb)` |

Rewrite `useOnlineStatus` / `useNetworkStatus` to:

```ts
const [isOnline, setIsOnline] = useState(isNetworkOnline);
useEffect(() => {
  void initializeConnectivity().then(setIsOnline);
  return subscribeConnectivity(setIsOnline);
}, []);
```

Files that must be converted (equivalents in this project):
`ProtectedRoute.tsx`, `AccessControlContext.tsx`, `useFreeAccessMode.ts`,
`UserDashboard.tsx`, `OfflineBootstrap.tsx`, `mutationQueue.ts`,
`offlineFirst.ts`, and any component showing an offline banner.

---

## 3. Boot order in `src/main.tsx`

Connectivity + cached session must be resolved BEFORE React renders, otherwise
the first render triggers network calls and route guards on native.

```tsx
import { Capacitor } from "@capacitor/core";
import {
  getNetworkStatus,
  initOfflineSessionTracking,
  initializeConnectivity,
  restoreCachedSessionOffline,
} from "./lib/offline";

// Capacitor loads the bundled `dist` shell and therefore needs no service
// worker. NEVER delete Cache Storage here — the WebView may rely on it.
if (!Capacitor.isNativePlatform()) {
  registerAppServiceWorker();
}

const boot = async () => {
  await initializeConnectivity();
  initOfflineSessionTracking();
  if (!(await getNetworkStatus())) {
    await restoreCachedSessionOffline();
  }
  const root = document.getElementById("root");
  if (!root) return;
  createRoot(root).render(<App />);
};

void boot();
```

---

## 4. Offline auth (this is what fixed the login bounce)

`src/lib/offline/credentials.ts` must provide:

- `storeOfflineCredentials(email, password, userId)` — store a **PBKDF2-SHA256**
  verifier only (random 16-byte salt, 210_000 iterations). Never the password.
- `verifyOfflineCredentials(email, password)` — offline sign-in path.
- `cacheSessionForOffline(session)` — keyed per user id.
- `restoreCachedSessionOffline()` — writes the cached session back into the
  Supabase client storage key `sb-<project-ref>-auth-token` derived from
  `VITE_SUPABASE_URL`, so the app boots signed-in with zero network calls.
- `clearStoredCredentials()` on sign-out.

Then in the guards:

```ts
// ProtectedRoute
if (!current && !(await getNetworkStatus())) {
  const restored = await restoreCachedSessionOffline();
  if (restored) { setCurrentUserId(restored.user.id); /* allow through */ }
}
```

```ts
// AccessControlContext / useFreeAccessMode
if (!(await getNetworkStatus())) {
  const cached = await readOffline("entitlements", userId);
  if (cached) return cached.data;   // never block the member offline
}
```

Rule: **offline never downgrades entitlements** — last known state wins, and
writes go to the mutation queue.

---

## 5. Data layer (must already be user-scoped)

- `src/lib/offline/db.ts` — `idb-keyval` store `smartyXXX-offline`, envelope
  `{ data, savedAt }`, keys scoped `"<userId>::<key>"`, plus `clearUserScope`.
- `src/lib/offline/offlineFirst.ts` — network → save → fallback to cache;
  offline → cache → `OfflineUnavailableError`.
- `src/lib/offline/mutationQueue.ts` — queue insert/update/upsert offline,
  `flushMutationQueue(userId)` when `getNetworkStatus()` turns true.
- `src/lib/offline/queryPersister.ts` — persist react-query to IndexedDB
  (`@tanstack/query-async-storage-persister`), key scoped by user id.
- `src/components/offline/OfflineBootstrap.tsx` — after sign-in, prefetch
  workouts/programs/exercise library/blog/tools/logbook + push remote images
  into Cache Storage; re-run on `subscribeConnectivity(online => ...)`.

Every read path used by member pages must go through `offlineFirst` /
`offlineQueryFn`, not raw `supabase.from(...)`.

---

## 6. Capacitor config — bundle the shell, do not point at the server

`capacitor.config.ts`:

```ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.smartyXXX.app',
  appName: 'SmartyXXX',
  webDir: 'dist',
  // NO `server: { url: ... }` in production. A remote url means the native app
  // needs the internet to boot and can never work offline.
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#0F172A",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
```

If a `server.url` block exists for hot reload, delete it before building any
store binary.

---

## 7. PWA/service worker config (web only, keep it compatible)

In `vite.config.ts` (`vite-plugin-pwa`, `generateSW`):

- `registerType: "autoUpdate"`, `injectRegister: null`, `filename: "sw.js"`,
  `devOptions: { enabled: false }`
- `navigateFallback: "/index.html"` with a denylist for `/~oauth`,
  `/payment-success`, `/api/`, `/functions/`
- `globPatterns: ["**/*.{html,js,css,woff,woff2,ico,png,svg,webmanifest}"]`
  so every lazy route chunk is precached for a cold offline start
- `maximumFileSizeToCacheInBytes: 10 * 1024 * 1024`
- navigations → `NetworkFirst` (`networkTimeoutSeconds: 4`); hashed assets →
  `CacheFirst`
- registration only from one guarded wrapper: never in dev, iframes, or
  `*.lovableproject.com` / `preview--*` / `id-preview--*` hosts, and never on
  `Capacitor.isNativePlatform()`.

---

## 8. Native build + verification (do this, don't assume)

```bash
npx cap add ios          # once
npx cap add android      # once
npm run build
npx cap sync
```

Confirm the shell really landed inside the native projects:

```bash
ls android/app/src/main/assets/public/index.html
ls ios/App/App/public/index.html
```

Then test on device/simulator:

1. Launch online, sign in, wait for the bootstrap prefetch to finish.
2. Force-quit the app.
3. Enable Airplane Mode.
4. Cold start → app must open, stay signed in, and show workouts, programs,
   exercise GIFs/images, blog and logbook from cache.
5. Complete a workout / toggle a favourite offline → it queues.
6. Turn network back on → queue flushes automatically.

If step 4 lands on `/auth`, offline auth restore (section 4) is not wired.
If step 4 shows a blank screen, the shell was not synced (section 6/8).

---

## 9. Release note for the store apps

Native offline only works in a **new binary**. Existing installs keep the old
behaviour. So: `git pull` → `npm install` → `npm run build` → `npx cap sync` →
test offline in Xcode / Android Studio → submit new versions to App Store and
Google Play.

Also read the Capacitor + Lovable guide before releasing:
https://lovable.dev/blog/mobile-app-development-capacitor
