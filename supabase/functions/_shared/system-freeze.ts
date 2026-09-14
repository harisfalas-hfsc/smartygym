// Global background freeze switch.
//
// When the admin freezes the system, every automated background job
// (scheduled crons AND event-driven senders such as the welcome email or the
// email queue worker) must become a no-op. Nothing is lost: the cron schedules
// are snapshotted and restored on unfreeze, and queued items simply stay queued.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const FREEZE_SETTING_KEY = "background_frozen";
export const FREEZE_SNAPSHOT_KEY = "background_freeze_snapshot";

let cached: { value: boolean; at: number } | null = null;
const CACHE_MS = 15_000;

/**
 * Returns true when background automation is frozen.
 * Fails open (returns false) so a settings outage never silently kills the system.
 */
export async function isBackgroundFrozen(client?: any): Promise<boolean> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;

  try {
    const supabase =
      client ??
      createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

    const { data, error } = await supabase
      .from("system_settings")
      .select("setting_value")
      .eq("setting_key", FREEZE_SETTING_KEY)
      .maybeSingle();

    if (error) {
      console.warn(`[FREEZE] Could not read freeze flag: ${error.message}`);
      return false;
    }

    const raw = data?.setting_value;
    const value = raw === true || raw === "true" || raw?.enabled === true;
    cached = { value, at: Date.now() };
    return value;
  } catch (err) {
    console.warn("[FREEZE] Freeze check failed:", err);
    return false;
  }
}

/**
 * Standard "skipped because frozen" response. Returns 200 so pg_cron / triggers
 * do not treat a frozen system as a failure and start retrying.
 */
export function frozenResponse(
  corsHeaders: Record<string, string>,
  label = "background task",
): Response {
  console.log(`[FREEZE] Skipping ${label} — system is frozen`);
  return new Response(
    JSON.stringify({ success: true, skipped: true, reason: "system_frozen" }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

/**
 * Convenience guard: returns a Response to short-circuit with, or null to continue.
 */
export async function freezeGuard(
  corsHeaders: Record<string, string>,
  label?: string,
): Promise<Response | null> {
  return (await isBackgroundFrozen()) ? frozenResponse(corsHeaders, label) : null;
}
