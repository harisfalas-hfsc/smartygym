import { WifiOff } from "lucide-react";
import { OFFLINE_READ_ONLY_MESSAGE, useOnlineStatus } from "@/hooks/useOnlineStatus";

/** One consistent explanation everywhere an action needs the internet. */
export const OfflineReadOnlyNotice = ({ className = "" }: { className?: string }) => {
  const { isOffline } = useOnlineStatus();
  if (!isOffline) return null;

  return (
    <div
      className={`flex items-start gap-2 rounded-lg border border-border bg-muted/60 p-3 text-sm text-muted-foreground ${className}`}
    >
      <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{OFFLINE_READ_ONLY_MESSAGE}</span>
    </div>
  );
};

/** Honest empty state: nothing saved on this device yet. */
export const OfflineNoCopyNotice = ({ className = "" }: { className?: string }) => (
  <div className={`flex items-start gap-2 rounded-lg border border-border bg-muted/60 p-4 text-sm text-muted-foreground ${className}`}>
    <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
    <span>You're offline and this device has no saved copy yet. Connect once and it will be stored here.</span>
  </div>
);
