import { SyncStatusPill } from "@/components/offline/SyncStatusPill";

/**
 * Kept for backwards compatibility. The old full-width banner blocked the
 * header, so it now renders the small non-blocking status pill instead.
 */
export function OfflineBanner(_props: { showReconnectedMessage?: boolean } = {}) {
  return <SyncStatusPill />;
}
