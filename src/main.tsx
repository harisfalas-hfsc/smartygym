import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { configureStatusBar } from "./utils/native";
import { purgeAppServiceWorkers, startDeploymentUpdateWatcher } from "./utils/registerServiceWorker";
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

// No offline app-shell caching anywhere: browser, installed PWA, WebView
// wrapper or native shell. Every launch loads the current deployment.
void purgeAppServiceWorkers();

// Refresh an open browser or installed web app when a new deployment lands.
startDeploymentUpdateWatcher();

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Application root element is missing");
createRoot(rootElement).render(<App />);

// Fade out the boot splash once the first frame of the app is painted.
const hideBootSplash = () => {
  const splash = document.getElementById("boot-splash");
  if (!splash) return;
  splash.classList.add("is-hidden");
  window.setTimeout(() => splash.remove(), 400);
};
requestAnimationFrame(() => requestAnimationFrame(hideBootSplash));
window.setTimeout(hideBootSplash, 8000);
