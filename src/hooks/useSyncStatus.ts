import { useEffect, useState } from "react";
import {
  getSyncDiagnostics,
  subscribeSyncDiagnostics,
  requestSyncNow,
  type SyncDiagnostics,
} from "@/lib/offline/syncStatus";
import { useOnlineStatus } from "./useOnlineStatus";

export function useSyncStatus() {
  const [diagnostics, setDiagnostics] = useState<SyncDiagnostics>(() => getSyncDiagnostics());
  const { isOnline, isServerUnreachable } = useOnlineStatus();

  useEffect(() => subscribeSyncDiagnostics(setDiagnostics), []);

  const label = !isOnline
    ? isServerUnreachable
      ? "Server unavailable"
      : "Offline"
    : diagnostics.phase === "syncing"
      ? "Syncing"
      : diagnostics.pendingOperations > 0
        ? `${diagnostics.pendingOperations} pending`
        : diagnostics.phase === "error"
          ? "Sync issue"
          : "Synced";

  return { ...diagnostics, isOnline, isServerUnreachable, label, syncNow: requestSyncNow };
}
