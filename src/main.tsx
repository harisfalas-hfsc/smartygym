import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { configureStatusBar } from "./utils/native";
import { registerAppServiceWorker } from "./utils/registerServiceWorker";
import { Capacitor } from "@capacitor/core";
import { getNetworkStatus, initOfflineSessionTracking, initializeConnectivity, restoreCachedSessionOffline } from "./lib/offline";

// Configure native status bar on app launch
configureStatusBar();

// Suppress the browser's PWA "Install this app" prompt.
// SmartyGym ships as a native app on Google Play (iOS coming) so we don't want
// browsers to nag users to install the web app on top of that.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
  });
}


const clearLovableDeploymentPinCookie = () => {
  if (typeof document === "undefined") return;

  const expires = "expires=Thu, 01 Jan 1970 00:00:00 GMT";
  const base = "__dpl=; Path=/; Max-Age=0; " + expires + "; SameSite=Lax; Secure";
  document.cookie = base;

  const hostname = window.location.hostname;
  const parts = hostname.split(".");

  for (let index = 0; index <= parts.length - 2; index += 1) {
    const domain = parts.slice(index).join(".");
    document.cookie = `${base}; Domain=${domain}`;
    document.cookie = `${base}; Domain=.${domain}`;
  }
};


// Lovable hosting may set a short-lived deployment pin cookie during publish
// transitions. If a browser keeps an old pin, refreshes can keep loading an
// older deployment until cookies are cleared. Remove it on every app start.
clearLovableDeploymentPinCookie();

// Capacitor loads the bundled `dist` shell and therefore needs no service
// worker. Never delete Cache Storage here: Android/iOS WebView wrappers may
// rely on it to boot the published PWA while offline.
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
