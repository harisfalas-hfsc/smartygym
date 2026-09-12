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
    let frame = 0;

    const restore = () => {
      window.scrollTo(0, target);
      attempts += 1;
      if (navigationType === "POP" && Math.abs(window.scrollY - target) > 2 && attempts < 30) {
        frame = window.requestAnimationFrame(restore);
      }
    };

    frame = window.requestAnimationFrame(restore);
    return () => {
      positions.set(currentKey, window.scrollY);
      window.cancelAnimationFrame(frame);
    };
  }, [location.key, navigationType]);

  return null;
};
