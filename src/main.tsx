import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { configureStatusBar } from "./utils/native";
import { registerAppServiceWorker } from "./utils/registerServiceWorker";
import { Capacitor } from "@capacitor/core";

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

// In a true Capacitor native shell we don't want a web SW — the native
// container handles caching. Everywhere else (browser + WebView APK wrappers
// like AppMySite) we register the guarded service worker for fast repeat
// loads + offline support. The guard inside registerAppServiceWorker handles
// dev, iframe, and Lovable preview hosts.
if (Capacitor.isNativePlatform()) {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister());
    });
  }
  if ("caches" in window) {
    caches.keys().then((names) => names.forEach((n) => caches.delete(n)));
  }
} else {
  registerAppServiceWorker();
}

createRoot(document.getElementById("root")!).render(<App />);
