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

/**
 * Returns true for any iOS device, including:
 * - Native iOS app (Capacitor)
 * - Safari / Chrome on iPhone or iPad
 *
 * Used for payment kill-switch detection so the iOS toggle also hides
 * purchase CTAs when Apple reviewers visit smartygym.com from an iPhone.
 */
export const isIOSDevice = (): boolean => {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent || "";
  return /iPhone|iPad|iPod/i.test(ua);
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
  return /Android/i.test(ua);
};

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
