import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const KEYS: Record<string, string> = {
  ios: "payments_enabled_ios",
  android: "payments_enabled_android",
};

export const PAYMENTS_DISABLED_MESSAGE =
  "In-app purchases are not available. Memberships, workouts and training programs are purchased on our website. Visit smartygym.com from any computer to subscribe or buy, then sign in here with the same account and your access appears automatically.";

/**
 * Server-side enforcement of the per-platform purchase kill switch.
 * Returns a 403 Response when the calling platform has purchasing disabled,
 * otherwise null.
 */
export async function blockIfPlatformPaymentsDisabled(
  req: Request,
  corsHeaders: Record<string, string>
): Promise<Response | null> {
  const platform = (req.headers.get("x-smarty-platform") || "web").toLowerCase();
  const key = KEYS[platform];
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  // Global Free Access Mode: no checkout is allowed on ANY platform.
  const { data: freeRow } = await supabase
    .from("system_settings")
    .select("setting_value")
    .eq("setting_key", "free_access_mode")
    .maybeSingle();
  const freeAccessMode =
    freeRow?.setting_value === true || freeRow?.setting_value === "true";
  if (freeAccessMode) {
    return new Response(
      JSON.stringify({
        error:
          "All SmartyGym content is currently free for signed-in members. No purchase is required.",
        freeAccessMode: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
    );
  }

  if (!key) return null; // web always allowed

  const { data, error } = await supabase
    .from("system_settings")
    .select("setting_value")
    .eq("setting_key", key)
    .maybeSingle();

  // Fail closed: on read error or missing row, mobile purchasing stays blocked.
  const enabled =
    !error && (data?.setting_value === true || data?.setting_value === "true");
  if (enabled) return null;

  return new Response(
    JSON.stringify({ error: PAYMENTS_DISABLED_MESSAGE, paymentsDisabled: true }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
  );
}