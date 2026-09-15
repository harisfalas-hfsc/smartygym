import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PARQ_SHORT_LABELS } from "@/constants/parq";
import { hasParqAck, setParqAck } from "@/lib/parq-ack";

export type ParqWaiverReason = "none" | "missing" | "flagged";

/**
 * Reads the signed-in member's latest PAR-Q assessment and reports whether a
 * health waiver must be confirmed before opening or executing any training
 * content (listed workouts, training programs, user-created workouts).
 *
 * The waiver is required when the member has NOT completed the PAR-Q at all,
 * or has completed it with at least one YES answer.
 */
export function useParqWaiver() {
  const [flags, setFlags] = useState<string[]>([]);
  const [reason, setReason] = useState<ParqWaiverReason>("none");
  const [blocked, setBlocked] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        const { data, error } = await supabase
          .from("parq_responses")
          .select("responses, is_cleared, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error || cancelled) return;

        let nextReason: ParqWaiverReason = "none";
        let yesFlags: string[] = [];

        if (!data) {
          nextReason = "missing";
        } else {
          const responses = (data.responses ?? {}) as Record<string, string>;
          yesFlags = PARQ_SHORT_LABELS.filter(
            (_, index) => String(responses[String(index)]).toLowerCase() === "yes",
          );
          if (yesFlags.length > 0) nextReason = "flagged";
        }

        if (nextReason === "none") return;

        setFlags(yesFlags);
        setReason(nextReason);
        if (!hasParqAck()) {
          setBlocked(true);
          setDialogOpen(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const confirm = useCallback(() => {
    setParqAck();
    setDialogOpen(false);
    setBlocked(false);
  }, []);

  return {
    loading,
    flags,
    /** Why the waiver is required: no assessment on file, or a YES answer. */
    reason,
    /** True while the member must confirm the waiver before seeing the content. */
    blocked,
    dialogOpen,
    openDialog: () => setDialogOpen(true),
    closeDialog: () => setDialogOpen(false),
    confirm,
  };
}
