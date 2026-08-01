import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getAdminNotificationEmail } from "../_shared/admin-settings.ts";
import { getDayIn84Cycle, getPeriodizationForDay } from "../_shared/periodization-84day.ts";
import { requireAdminOrServiceRole } from "../_shared/admin-or-service-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * VERIFY WOD ROLLOVER — Independent post-midnight safety net.
 *
 * Scheduled at 21:05 UTC (00:05 Cyprus summer / 23:05 winter), 5 minutes
 * after `archive-old-wods`. Verifies the rollover contract independently:
 *
 *   1. No active WOD remains for dates older than today (Cyprus).
 *   2. Today's expected WODs are present, visible, with image + Stripe.
 *   3. Tomorrow's pre-built WODs (if any) are still intact.
 *   4. If stale active WODs are found, clear ONLY their WOD flags
 *      (non-destructive — content stays in library).
 *   5. If today's WODs are missing or broken, send admin alert. Never
 *      generate, never pull from library (that's admin-only).
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authError = await requireAdminOrServiceRole(req, corsHeaders);
  if (authError) return authError;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const supabase = createClient(supabaseUrl, serviceKey);

  const issues: string[] = [];
  const fixes: string[] = [];
  const cyprusToday = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Athens", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const tomorrowDate = new Date();
  tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
  const cyprusTomorrow = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Athens", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(tomorrowDate);

  console.log(`[VERIFY-ROLLOVER] today=${cyprusToday} tomorrow=${cyprusTomorrow}`);

  try {
    // 1) Find any stale active WODs (generated_for_date < today OR null with flag still on)
    const { data: stale } = await supabase
      .from("admin_workouts")
      .select("id, name, equipment, generated_for_date")
      .eq("is_workout_of_day", true)
      .lt("generated_for_date", cyprusToday);

    if (stale && stale.length > 0) {
      issues.push(`Found ${stale.length} stale active WOD(s) older than ${cyprusToday}: ${stale.map(s => `${s.name} (${s.generated_for_date})`).join(", ")}`);
      // Non-destructive cleanup: clear only the WOD flags
      const { error: clearErr } = await supabase
        .from("admin_workouts")
        .update({ is_workout_of_day: false, generated_for_date: null, updated_at: new Date().toISOString() })
        .in("id", stale.map(s => s.id));
      if (clearErr) {
        issues.push(`Failed to auto-clear stale flags: ${clearErr.message}`);
      } else {
        fixes.push(`Auto-cleared WOD flags on ${stale.length} stale row(s); content remains in library.`);
      }
    }

    // 2) Today's expected WODs
    const dayIn84 = getDayIn84Cycle(cyprusToday);
    const periodization = getPeriodizationForDay(dayIn84);
    const isRecovery = periodization.category === "RECOVERY";
    const expectedToday = isRecovery ? ["VARIOUS"] : ["BODYWEIGHT", "EQUIPMENT"];

    const { data: todayWods } = await supabase
      .from("admin_workouts")
      .select("id, name, equipment, is_visible, image_url, stripe_product_id, stripe_price_id")
      .eq("is_workout_of_day", true)
      .eq("generated_for_date", cyprusToday);

    const presentSlots = new Set((todayWods || []).map(w => (w.equipment || "").toUpperCase()));
    for (const slot of expectedToday) {
      if (!presentSlots.has(slot)) {
        issues.push(`Missing TODAY ${slot} WOD for ${cyprusToday} (${periodization.category})`);
      }
    }
    for (const w of todayWods || []) {
      if (!w.is_visible) issues.push(`Today's ${w.equipment} WOD "${w.name}" is hidden`);
      if (!w.image_url) issues.push(`Today's ${w.equipment} WOD "${w.name}" missing image`);
      if (!w.stripe_product_id || !w.stripe_price_id) {
        issues.push(`Today's ${w.equipment} WOD "${w.name}" missing Stripe link`);
      }
    }

    // 3) Tomorrow's pre-built WODs are still intact (informational; not a hard fail)
    const { data: tomorrowWods } = await supabase
      .from("admin_workouts")
      .select("id, name, equipment")
      .eq("is_workout_of_day", true)
      .eq("generated_for_date", cyprusTomorrow);
    const tomorrowCount = tomorrowWods?.length ?? 0;

    const ok = issues.length === 0;
    const summary = ok
      ? `✅ Rollover healthy. Today: ${(todayWods || []).map(w => `${w.equipment}/${w.name}`).join(" + ")}. Tomorrow pre-built: ${tomorrowCount}.`
      : `❌ Rollover issues for ${cyprusToday}:\n- ${issues.join("\n- ")}\n${fixes.length ? "\nAuto-fixes:\n- " + fixes.join("\n- ") : ""}`;

    console.log(`[VERIFY-ROLLOVER] ${summary}`);

    // Email admin only on issues (avoid daily noise)
    if (!ok && resendKey) {
      try {
        const adminEmail = await getAdminNotificationEmail(supabase);
        if (adminEmail) {
          const resend = new Resend(resendKey);
          await resend.emails.send({
            from: "SmartyGym <noreply@smartygym.com>",
            to: [adminEmail],
            subject: `❌ WOD Rollover issue for ${cyprusToday}`,
            html: `<pre style="font-family:monospace">${summary.replace(/</g, "&lt;")}</pre>`,
          });
        }
      } catch (mailErr) {
        console.error("[VERIFY-ROLLOVER] email failed:", mailErr);
      }
    }

    return new Response(JSON.stringify({
      ok, cyprusToday, cyprusTomorrow,
      issues, fixes,
      todayCount: (todayWods || []).length,
      tomorrowCount,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[VERIFY-ROLLOVER] crash", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});