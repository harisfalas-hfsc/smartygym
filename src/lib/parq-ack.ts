/**
 * PAR-Q waiver acknowledgement for the current browsing session.
 *
 * One confirmation covers the whole session so the athlete is not asked again
 * on every workout page refresh.
 */
const KEY = "smartygym:parq-ack";

export function hasParqAck(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setParqAck(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, "1");
  } catch {
    /* private mode — the dialog simply asks again */
  }
}

export function clearParqAck(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
