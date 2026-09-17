import { createRoot } from "react-dom/client";
import { SplashScreen } from "@capacitor/splash-screen";
import App from "./App.tsx";
import "./index.css";
import { configureStatusBar, isNativePlatform } from "./utils/native";
import { purgeAppServiceWorkers, startDeploymentUpdateWatcher } from "./utils/registerServiceWorker";

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

// Browsers can reveal the app after its first paint. Native shells must keep
// the branded web splash over the WebView until the initial page and its
// eager visual assets are ready, otherwise the WebView's empty surface flashes.
let startupSplashHidden = false;

const hideBootSplash = async () => {
  if (startupSplashHidden) return;
  startupSplashHidden = true;

  const splash = document.getElementById("boot-splash");
  if (splash) {
    splash.classList.add("is-hidden");
    window.setTimeout(() => splash.remove(), 400);
  }

  if (Capacitor.isNativePlatform()) {
    try {
      await SplashScreen.hide({ fadeOutDuration: 180 });
    } catch {
      // Older shells without the plugin still fall back to the web splash.
    }
  }
};

const hideAfterPaint = () => {
  requestAnimationFrame(() => requestAnimationFrame(() => void hideBootSplash()));
};

if (isNativePlatform()) {
  if (document.readyState === "complete") {
    hideAfterPaint();
  } else {
    window.addEventListener("load", hideAfterPaint, { once: true });
  }
} else {
  hideAfterPaint();
}

// Never trap someone behind the splash if an external asset stalls.
window.setTimeout(() => void hideBootSplash(), 8000);
