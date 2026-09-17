import * as React from "react";

// Tablet rule: portrait behaves like mobile, landscape behaves like desktop.
const TABLET_LANDSCAPE_MIN_WIDTH = 1024;
const DESKTOP_MIN_WIDTH = 1200;

function computeIsMobile() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const isLandscape = w > h;
  const isTabletLandscapeOrWider = w >= TABLET_LANDSCAPE_MIN_WIDTH && isLandscape;
  const isWideDesktop = w >= DESKTOP_MIN_WIDTH;
  return !(isTabletLandscapeOrWider || isWideDesktop);
}

export function useIsMobile() {
  // Read the viewport during the first render. Starting as `undefined` and
  // coercing it to false briefly rendered the desktop layout in native shells
  // before the effect corrected it to mobile.
  const [isMobile, setIsMobile] = React.useState<boolean>(() =>
    typeof window === "undefined" ? true : computeIsMobile(),
  );

  React.useLayoutEffect(() => {
    const onChange = () => setIsMobile(computeIsMobile());
    onChange();
    window.addEventListener("resize", onChange);
    window.addEventListener("orientationchange", onChange);
    window.visualViewport?.addEventListener("resize", onChange);
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("orientationchange", onChange);
      window.visualViewport?.removeEventListener("resize", onChange);
    };
  }, []);

  return isMobile;
}
