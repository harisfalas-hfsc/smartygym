// Offline sign-in support. We never store the raw password — only a
// PBKDF2-SHA256 verifier (random salt, high iteration count) per device.
import { readOffline, saveOffline, removeOffline } from "./db";
import type { Session } from "@supabase/supabase-js";

const DEVICE_SCOPE = "device";
const CRED_KEY = "offline-credentials";
const SESSION_KEY = "offline-session";
const ITERATIONS = 210_000;

interface StoredCredential {
  email: string;
  userId: string;
  salt: string;
  iterations: number;
  verifier: string;
  savedAt: number;
}

interface StoredSession {
  session: Session;
  savedAt: number;
}

const toBase64 = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)));

const fromBase64 = (value: string) =>
  Uint8Array.from(atob(value), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations, hash: "SHA-256" },
    keyMaterial,
    256,
  );
  return toBase64(bits);
}

export async function storeOfflineCredentials(email: string, password: string, userId: string) {
  try {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const verifier = await derive(password, salt, ITERATIONS);
    const record: StoredCredential = {
      email: email.trim().toLowerCase(),
      userId,
      salt: toBase64(salt.buffer),
      iterations: ITERATIONS,
      verifier,
      savedAt: Date.now(),
    };
    await saveOffline(CRED_KEY, record, DEVICE_SCOPE);
  } catch (e) {
    console.warn("[offline] could not store device credentials", e);
  }
}

export async function getStoredCredentialEmail(): Promise<string | null> {
  const rec = await readOffline<StoredCredential>(CRED_KEY, DEVICE_SCOPE);
  return rec?.data.email ?? null;
}

export async function verifyOfflineCredentials(email: string, password: string): Promise<boolean> {
  const rec = await readOffline<StoredCredential>(CRED_KEY, DEVICE_SCOPE);
  if (!rec) return false;
  const { salt, iterations, verifier, email: storedEmail } = rec.data;
  if (storedEmail !== email.trim().toLowerCase()) return false;
  const candidate = await derive(password, fromBase64(salt), iterations);
  return candidate === verifier;
}

export async function clearStoredCredentials() {
  await removeOffline(CRED_KEY, DEVICE_SCOPE);
  await removeOffline(SESSION_KEY, DEVICE_SCOPE);
}

export async function cacheSessionForOffline(session: Session) {
  const record: StoredSession = { session, savedAt: Date.now() };
  await saveOffline(SESSION_KEY, record, DEVICE_SCOPE);
}

export async function getCachedOfflineSession(): Promise<Session | null> {
  const rec = await readOffline<StoredSession>(SESSION_KEY, DEVICE_SCOPE);
  return rec?.data.session ?? null;
}

const supabaseStorageKey = (): string | null => {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!url) return null;
  try {
    const ref = new URL(url).hostname.split(".")[0];
    return `sb-${ref}-auth-token`;
  } catch {
    return null;
  }
};

/**
 * Restores the last cached session into the Supabase client's storage so the
 * app boots signed-in (read-only) without any network round trip.
 */
export async function restoreCachedSessionOffline(): Promise<Session | null> {
  const session = await getCachedOfflineSession();
  const key = supabaseStorageKey();
  if (!session || !key) return null;
  try {
    localStorage.setItem(key, JSON.stringify(session));
    localStorage.setItem("smartygym_offline_session_restored", "true");
    return session;
  } catch {
    return null;
  }
}
