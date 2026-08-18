import { Cloud, CloudOff, RefreshCw, ServerCrash } from "lucide-react";
import { useEffect, useState } from "react";
import { useSyncStatus } from "@/hooks/useSyncStatus";

const relative = (ts: number | null) => {
  if (!ts) return null;
  const mins = Math.round((Date.now() - ts) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
};

/**
 * Tiny, non-blocking connectivity/sync indicator.
 * It never covers navigation, never blocks input and never opens a modal.
 */
export const SyncStatusPill = () => {
  const { isOnline, isServerUnreachable, phase, lastSuccessAt, pendingOperations, label, syncNow } =
    useSyncStatus();
  const [expanded, setExpanded] = useState(false);

  // Only surface the pill when there is something worth saying.
  const noteworthy = !isOnline || phase === "syncing" || pendingOperations > 0;

  useEffect(() => {
    if (!noteworthy) setExpanded(false);
  }, [noteworthy]);

  if (!noteworthy) return null;

  const Icon = isServerUnreachable ? ServerCrash : !isOnline ? CloudOff : phase === "syncing" ? RefreshCw : Cloud;

  return (
    <div className="pointer-events-none fixed bottom-20 left-3 z-40 lg:bottom-4">
      <button
        type="button"
        onClick={() => (expanded ? syncNow() : setExpanded(true))}
        className="pointer-events-auto flex items-center gap-2 rounded-full border border-border/70 bg-background/90 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground"
        aria-label={`Connection status: ${label}`}
      >
        <Icon className={`h-3.5 w-3.5 ${phase === "syncing" ? "animate-spin" : ""}`} />
        <span>{label}</span>
        {expanded && lastSuccessAt && (
          <span className="text-[10px] opacity-70">· updated {relative(lastSuccessAt)}</span>
        )}
        {expanded && isOnline && <span className="text-[10px] opacity-70">· tap to sync</span>}
      </button>
    </div>
  );
};
