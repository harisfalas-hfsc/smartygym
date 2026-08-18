// Central, observable synchronisation diagnostics. Deliberately tiny: the UI
// reads it for a non-blocking status pill, admins read it for debugging.
import { readOffline, saveOffline } from "./db";

export type SyncPhase = "idle" | "syncing" | "error";

export interface SyncDiagnostics {
  phase: SyncPhase;
  lastSuccessAt: number | null;
  lastAttemptAt: number | null;
  lastError: string | null;
  pendingOperations: number;
  failedOperations: number;
  completedTasks: string[];
  cacheVersion: number;
  databaseVersion: number;
}

export const DATABASE_VERSION = 2;
export const CACHE_VERSION = 2;

const DIAG_KEY = "sync:diagnostics";

let diagnostics: SyncDiagnostics = {
  phase: "idle",
  lastSuccessAt: null,
  lastAttemptAt: null,
  lastError: null,
  pendingOperations: 0,
  failedOperations: 0,
  completedTasks: [],
  cacheVersion: CACHE_VERSION,
  databaseVersion: DATABASE_VERSION,
};

const listeners = new Set<(d: SyncDiagnostics) => void>();

export const getSyncDiagnostics = () => diagnostics;

export const subscribeSyncDiagnostics = (listener: (d: SyncDiagnostics) => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const updateSyncDiagnostics = (patch: Partial<SyncDiagnostics>, userId?: string | null) => {
  diagnostics = { ...diagnostics, ...patch };
  listeners.forEach((l) => l(diagnostics));
  if (userId) void saveOffline(DIAG_KEY, diagnostics, userId);
};

/** Restore the last known diagnostics for a user (survives restarts). */
export const loadSyncDiagnostics = async (userId: string) => {
  const stored = await readOffline<SyncDiagnostics>(DIAG_KEY, userId);
  if (stored?.data) updateSyncDiagnostics({ ...stored.data, phase: "idle" });
  return diagnostics;
};

// ---- manual "Sync now" -----------------------------------------------------
type SyncRequestHandler = () => void;
let handler: SyncRequestHandler | null = null;

/** The bootstrap registers itself here so any UI can request a sync. */
export const registerSyncHandler = (fn: SyncRequestHandler) => {
  handler = fn;
  return () => {
    if (handler === fn) handler = null;
  };
};

export const requestSyncNow = () => handler?.();
