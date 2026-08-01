import { Capacitor } from "@capacitor/core";

/**
 * Returns true only when the app is running inside the iOS Capacitor
 * native shell. Web (any browser, including Safari on iPhone), Android
 * native, and PWA installs all return false.
 *
 * Used to hide Stripe purchase CTAs in the iOS app to comply with
 * Apple App Store Guideline 3.1.1 (no external payment links for
 * digital goods on iOS).
 */
export const isIOSNative = (): boolean => {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
  } catch {
    return false;
  }
};

export const isNativeApp = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

/** Number of touch points reported by the device (0 on real desktops). */
const touchPoints = (): number => {
  if (typeof navigator === "undefined") return 0;
  return Number((navigator as Navigator).maxTouchPoints || 0);
};

/** Chromium client hints: reliable `mobile` flag, unaffected by desktop-site mode. */
const uaData = (): { mobile?: boolean; platform?: string } | null => {
  if (typeof navigator === "undefined") return null;
  const data = (navigator as unknown as { userAgentData?: { mobile?: boolean; platform?: string } })
    .userAgentData;
  return data ?? null;
};

/**
 * Returns true for any Apple mobile device, including:
 * - Native iOS app (Capacitor)
 * - Safari / Chrome / Firefox / Edge on iPhone, iPad or iPod
 * - iPad on iPadOS 13+ (reports a Mac user agent)
 * - iPhone / iPad using "Request Desktop Site" (Mac user agent + touch points)
 *
 * A genuine Mac reports 0 touch points, so it is never matched.
 */
export const isIOSDevice = (): boolean => {
  try {
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios") return true;
  } catch {
    /* ignore */
  }
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  // iPadOS 13+ and iOS desktop-site mode masquerade as macOS.
  if (/Macintosh|Mac OS X/i.test(ua) && touchPoints() > 1) return true;
  return false;
};

/**
 * Returns true for any Android device, including:
 * - Native Android app (Capacitor)
 * - Chrome / Samsung Internet / any browser on an Android phone or tablet
 *
 * Used so the Android payment kill-switch also applies to Android mobile web.
 */
export const isAndroidDevice = (): boolean => {
  try {
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") return true;
  } catch {
    /* ignore */
  }
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent || "";
  if (/Android/i.test(ua)) return true;
  // Kindle / Fire tablets and other Linux-based mobile browsers.
  if (/Silk/i.test(ua)) return true;
  if (/Linux/i.test(ua) && /Mobile/i.test(ua)) return true;
  // Chromium client hints stay truthful in "Request Desktop Site" mode.
  const data = uaData();
  if (data?.mobile === true && !/Mac|iPhone|iPad|iPod/i.test(data.platform || "")) return true;
  // Desktop-site mode on Android drops "Android" from the UA but keeps touch.
  if (data?.platform === "Android") return true;
  // Fallback for Android desktop-site mode without client hints:
  // a "X11; Linux x86_64" UA that reports touch points is a phone/tablet,
  // never a Linux desktop.
  if (/X11|Linux/i.test(ua) && !/Windows|Macintosh|CrOS/i.test(ua) && touchPoints() > 1) return true;
  return false;
};

/** True for any phone or tablet (iOS or Android), in any browser or mode. */
export const isMobileOrTabletDevice = (): boolean => isIOSDevice() || isAndroidDevice();

/**
 * Header sent with every checkout request so the edge function can enforce
 * the per-platform purchase kill switch server-side.
 */
export const platformHeader = (): Record<string, string> => {
  try {
    if (isIOSDevice()) return { "x-smarty-platform": "ios" };
    if (isAndroidDevice()) return { "x-smarty-platform": "android" };
    return { "x-smarty-platform": "web" };
  } catch {
    return { "x-smarty-platform": "web" };
  }
};
