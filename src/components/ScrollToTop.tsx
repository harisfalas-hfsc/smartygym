import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const positions = new Map<string, number>();

export const ScrollToTop = () => {
  const location = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    const currentKey = location.key;
    const target = navigationType === "POP" ? positions.get(currentKey) ?? 0 : 0;
    let attempts = 0;
    let timer = 0;

    const restore = () => {
      window.scrollTo(0, target);
      attempts += 1;
      if (navigationType === "POP" && Math.abs(window.scrollY - target) > 2 && attempts < 50) {
        timer = window.setTimeout(restore, 100);
      }
    };

    timer = window.setTimeout(restore, 0);
    return () => {
      positions.set(currentKey, window.scrollY);
      window.clearTimeout(timer);
    };
  }, [location.key, navigationType]);

  return null;
};
