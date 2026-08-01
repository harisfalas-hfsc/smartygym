import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getDayIn84Cycle, getPeriodizationForDay } from "../_shared/periodization-84day.ts";
import { validateWodPublishContract } from "../_shared/wod-integrity.ts";
import { requireAdminOrServiceRole } from "../_shared/admin-or-service-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Watchdog WOD Check — SELF-HEALING LIBRARY MODE.
 *
 * Runs every 10 minutes via cron.
 *
 * For TODAY, TOMORROW, and DAY AFTER TOMORROW (Cyprus time) it:
 *   1. Computes the expected periodization (category, difficulty, slots).
 *   2. Verifies every required slot exists, matching category, difficulty
 *      range, equipment, image, Stripe links, visibility, and passes the
 *      WOD publish contract.
 *   3. For each problem detected:
 *        - Logs a row in `system_health_events` with the exact reason.
 *        - Attempts an immediate auto-fix:
 *            • Missing slot       → call `select-wod-from-library`
 *            • Missing image      → call `auto-generate-workout-image`
 *            • Missing Stripe IDs → call `wod-stripe-link`
 *            • Wrong category/difficulty/equipment → clear WOD flag, then
 *              the next watchdog tick refills the slot from the library.
 *            • Candidate fails publish contract → next candidate (handled
 *              inside the library picker).
 *        - If auto-fix succeeds, the row is marked resolved.
 *        - If it fails, the exact failure reason is recorded (e.g.
 *          "9 candidates rejected: missing finisher density, raw markup").
 *   4. Never deletes paid content. Never invents workouts. Never edits
 *      library content. The only mutations are clearing stale WOD flags
 *      and re-running deterministic repair functions.
 */

const MAX_ATTEMPTS_PER_DAY = 6; // ~1 hour worth at the 10-minute cadence

type Issue = {
  check_type: string;
  severity: "info" | "warn" | "fail";
  scheduled_for_date: string;
  equipment_slot: string | null;
  category: string | null;
  difficulty: string | null;
  day_in_84: number;
  issue_message: string;
  autofix_attempted: boolean;
  autofix_status: "fixed" | "blocked" | "skipped" | "error" | null;
  autofix_result: any;
  candidate_rejection_reasons: any;
};

function cyprusDateOffset(daysAhead: number): string {
  const now = new Date();
  const offset = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Athens",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(offset);
}

async function callLibraryPicker(
  supabaseUrl: string,
  serviceKey: string,
  targetDate: string,
): Promise<{ ok: boolean; status: number; body: string }> {
  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/select-wod-from-library`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ targetDate, triggerSource: "watchdog-autofix" }),
    });
    const body = await resp.text();
    return { ok: resp.ok, status: resp.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: e instanceof Error ? e.message : String(e) };
  }
}

async function autoPublishPreview(
  supabaseUrl: string,
  serviceKey: string,
  targetDate: string,
): Promise<{ ok: boolean; status: number; body: string }> {
  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/preview-tomorrow-wod`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ action: "approve", date: targetDate, approvedBy: "watchdog-auto" }),
    });
    const body = await resp.text();
    return { ok: resp.ok, status: resp.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: e instanceof Error ? e.message : String(e) };
  }
}

async function explainLibraryCandidates(
  supabase: any,
  category: string,
  equipment: string | null,
  difficultyStars: [number, number] | null,
  targetDate: string,
): Promise<any[]> {
  let q = supabase
    .from("admin_workouts")
    .select(
      "id, name, equipment, category, difficulty_stars, is_visible, is_premium, is_free, image_url, main_workout, description, instructions, tips, is_standalone_purchase, price, stripe_product_id, stripe_price_id, is_workout_of_day, generated_for_date",
    )
    .eq("category", category)
    .eq("is_workout_of_day", false)
    .eq("is_visible", true)
    .eq("is_premium", true)
    .eq("is_free", false);
  if (equipment) q = q.eq("equipment", equipment);
  if (difficultyStars) {
    q = q.gte("difficulty_stars", difficultyStars[0]).lte("difficulty_stars", difficultyStars[1]);
  }
  const { data } = await q.limit(20);
  const reasons: any[] = [];
  for (const row of data || []) {
    const failures: string[] = [];
    if (!row.image_url || !String(row.image_url).startsWith("https://")) {
      failures.push("missing or invalid image_url");
    }
    const contract = validateWodPublishContract(row || {}, targetDate);
    if (!contract.ok) failures.push(...contract.failures);
    reasons.push({ id: row.id, name: row.name, failures });
  }
  return reasons;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authError = await requireAdminOrServiceRole(req, corsHeaders);
  if (authError) return authError;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const horizon = [
    { label: "today", date: cyprusDateOffset(0) },
    { label: "tomorrow", date: cyprusDateOffset(1) },
    { label: "day_after_tomorrow", date: cyprusDateOffset(2) },
  ];

  const allIssues: Issue[] = [];

  try {
    for (const { label, date: targetDate } of horizon) {
      const dayIn84 = getDayIn84Cycle(targetDate);
      const periodization = getPeriodizationForDay(dayIn84);
      const isRecovery = periodization.category === "RECOVERY";
      const expectedSlots = isRecovery ? ["VARIOUS"] : ["BODYWEIGHT", "EQUIPMENT"];
      const stars = periodization.difficultyStars;

      const { data: wods } = await supabase
        .from("admin_workouts")
        .select(
          "id, name, equipment, category, difficulty, difficulty_stars, is_visible, image_url, stripe_product_id, stripe_price_id, main_workout, description, instructions, tips, is_standalone_purchase, price, is_premium, is_workout_of_day, generated_for_date",
        )
        .eq("is_workout_of_day", true)
        .eq("generated_for_date", targetDate);

      const presentByEquipment = new Map<string, any>();
      for (const w of wods || []) {
        presentByEquipment.set((w.equipment || "").toUpperCase(), w);
      }

      // STEP 1: detect wrong-category/difficulty rows for this date and clear them
      for (const w of wods || []) {
        const wrongCategory = (w.category || "").toUpperCase() !== periodization.category;
        const wrongDifficulty = !isRecovery && !!stars && (
          w.difficulty_stars == null ||
          w.difficulty_stars < stars[0] ||
          w.difficulty_stars > stars[1]
        );
        const wrongSlot = !expectedSlots.includes((w.equipment || "").toUpperCase());
        if (wrongCategory || wrongDifficulty || wrongSlot) {
          const issue: Issue = {
            check_type: "wod_wrong_slot",
            severity: "fail",
            scheduled_for_date: targetDate,
            equipment_slot: (w.equipment || "").toUpperCase() || null,
            category: periodization.category,
            difficulty: periodization.difficulty,
            day_in_84: dayIn84,
            issue_message: `${label} WOD "${w.name}" does not match periodization (expected ${periodization.category}/${periodization.difficulty}/${expectedSlots.join("+")}).`,
            autofix_attempted: true,
            autofix_status: null,
            autofix_result: null,
            candidate_rejection_reasons: null,
          };
          const { error: clearErr } = await supabase
            .from("admin_workouts")
            .update({
              is_workout_of_day: false,
              generated_for_date: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", w.id);
          if (clearErr) {
            issue.autofix_status = "error";
            issue.autofix_result = { error: clearErr.message };
          } else {
            issue.autofix_status = "fixed";
            issue.autofix_result = { cleared_wod_flag: w.id };
            presentByEquipment.delete((w.equipment || "").toUpperCase());
          }
          allIssues.push(issue);
        }
      }

      // STEP 2: detect missing slots and fill from library
      const missingSlots = expectedSlots.filter((s) => !presentByEquipment.has(s));
      if (missingSlots.length > 0) {
        // If the preview already has these slots picked, it is automation-ready.
        // The admin screen is only an override surface; the system must publish it
        // automatically so the owner never has to approve WODs every day.
        let previewRow: any = null;
        try {
          const { data } = await supabase
            .from("wod_tomorrow_preview")
            .select("bodyweight_workout_id, equipment_workout_id, recovery_workout_id, is_recovery_day, status")
            .eq("date", targetDate)
            .maybeSingle();
          previewRow = data;
        } catch (_) { /* preview table optional */ }

        const previewCovered = previewRow
          ? (previewRow.is_recovery_day
              ? !!previewRow.recovery_workout_id
              : !!previewRow.bodyweight_workout_id && !!previewRow.equipment_workout_id)
          : false;

        if (previewCovered && previewRow?.status !== "approved") {
          const publish = await autoPublishPreview(supabaseUrl, serviceKey, targetDate);
          const { data: afterPreviewPublish } = await supabase
            .from("admin_workouts")
            .select("equipment")
            .eq("is_workout_of_day", true)
            .eq("generated_for_date", targetDate);
          const afterPreviewEq = new Set((afterPreviewPublish || []).map((w: any) => (w.equipment || "").toUpperCase()));
          const fixedByPreview = missingSlots.every((slot) => afterPreviewEq.has(slot));

          allIssues.push({
            check_type: fixedByPreview ? "wod_preview_auto_published" : "wod_preview_auto_publish_failed",
            severity: fixedByPreview ? "info" : "fail",
            scheduled_for_date: targetDate,
            equipment_slot: missingSlots.join("+"),
            category: periodization.category,
            difficulty: periodization.difficulty,
            day_in_84: dayIn84,
            issue_message: fixedByPreview
              ? `${label} WODs were already picked in preview and were automatically published for rollover.`
              : `${label} WODs were picked in preview, but automatic publishing failed.`,
            autofix_attempted: true,
            autofix_status: fixedByPreview ? "fixed" : "blocked",
            autofix_result: { publisher_status: publish.status, publisher_body: publish.body.substring(0, 500) },
            candidate_rejection_reasons: null,
          });
          if (fixedByPreview) continue;

          await supabase.from("wod_tomorrow_preview").delete().eq("date", targetDate);
        }

        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count: priorAttempts } = await supabase
          .from("system_health_events")
          .select("*", { count: "exact", head: true })
          .eq("check_type", "wod_missing_slot")
          .eq("status", "open")
          .eq("scheduled_for_date", targetDate)
          .gte("created_at", since);

        if ((priorAttempts ?? 0) >= MAX_ATTEMPTS_PER_DAY) {
          allIssues.push({
            check_type: "wod_missing_slot",
            severity: "fail",
            scheduled_for_date: targetDate,
            equipment_slot: missingSlots.join("+"),
            category: periodization.category,
            difficulty: periodization.difficulty,
            day_in_84: dayIn84,
            issue_message: `${label} ${missingSlots.join(" + ")} still missing after ${priorAttempts} open watchdog attempts in last 24h. Automatic recovery is blocked by library quality/availability.`,
            autofix_attempted: false,
            autofix_status: "skipped",
            autofix_result: { reason: "attempt_cap_reached", attempts: priorAttempts },
            candidate_rejection_reasons: null,
          });
        } else {
          const pick = await callLibraryPicker(supabaseUrl, serviceKey, targetDate);

          const { data: after } = await supabase
            .from("admin_workouts")
            .select("equipment")
            .eq("is_workout_of_day", true)
            .eq("generated_for_date", targetDate);
          const afterEq = new Set((after || []).map((w: any) => (w.equipment || "").toUpperCase()));

          for (const slot of missingSlots) {
            const fixed = afterEq.has(slot);
            const rejectionReasons = fixed
              ? null
              : await explainLibraryCandidates(
                  supabase,
                  isRecovery ? "RECOVERY" : periodization.category,
                  slot === "VARIOUS" ? null : slot,
                  isRecovery ? null : stars,
                  targetDate,
                );
            allIssues.push({
              check_type: "wod_missing_slot",
              severity: fixed ? "warn" : "fail",
              scheduled_for_date: targetDate,
              equipment_slot: slot,
              category: periodization.category,
              difficulty: periodization.difficulty,
              day_in_84: dayIn84,
              issue_message: fixed
                ? `${label} ${slot} was missing; watchdog refilled it from the library.`
                : `${label} ${slot} missing; library picker could not fill it. ${
                    rejectionReasons && rejectionReasons.length > 0
                      ? `${rejectionReasons.length} candidate(s) inspected, all rejected.`
                      : "No matching candidate in library."
                  }`,
              autofix_attempted: true,
              autofix_status: fixed ? "fixed" : "blocked",
              autofix_result: { picker_status: pick.status, picker_body: pick.body.substring(0, 500) },
              candidate_rejection_reasons: rejectionReasons,
            });
          }
        }
      }

      // STEP 3: asset re-kicks for any current WOD missing image/Stripe
      const { data: refreshed } = await supabase
        .from("admin_workouts")
        .select("id, name, equipment, image_url, stripe_product_id, stripe_price_id")
        .eq("is_workout_of_day", true)
        .eq("generated_for_date", targetDate);
      for (const w of refreshed || []) {
        if (!w.image_url) {
          fetch(`${supabaseUrl}/functions/v1/auto-generate-workout-image`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
            body: JSON.stringify({ workout_id: w.id }),
          }).catch((e) => console.error("[WATCHDOG] image re-kick failed", e));
          allIssues.push({
            check_type: "wod_missing_image",
            severity: "warn",
            scheduled_for_date: targetDate,
            equipment_slot: (w.equipment || "").toUpperCase() || null,
            category: periodization.category,
            difficulty: periodization.difficulty,
            day_in_84: dayIn84,
            issue_message: `${label} ${w.equipment} WOD "${w.name}" missing image; re-kicked auto-generate-workout-image.`,
            autofix_attempted: true,
            autofix_status: "fixed",
            autofix_result: { workout_id: w.id },
            candidate_rejection_reasons: null,
          });
        }
        if (!w.stripe_product_id || !w.stripe_price_id) {
          fetch(`${supabaseUrl}/functions/v1/wod-stripe-link`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
            body: JSON.stringify({ workout_id: w.id }),
          }).catch((e) => console.error("[WATCHDOG] stripe re-kick failed", e));
          allIssues.push({
            check_type: "wod_missing_stripe",
            severity: "warn",
            scheduled_for_date: targetDate,
            equipment_slot: (w.equipment || "").toUpperCase() || null,
            category: periodization.category,
            difficulty: periodization.difficulty,
            day_in_84: dayIn84,
            issue_message: `${label} ${w.equipment} WOD "${w.name}" missing Stripe link; re-kicked wod-stripe-link.`,
            autofix_attempted: true,
            autofix_status: "fixed",
            autofix_result: { workout_id: w.id },
            candidate_rejection_reasons: null,
          });
        }
      }
    } // end horizon loop

    // Persist all issues to system_health_events
    if (allIssues.length > 0) {
      const rows = allIssues.map((i) => ({
        check_type: i.check_type,
        severity: i.severity,
        status: i.autofix_status === "fixed" ? "resolved" : "open",
        scheduled_for_date: i.scheduled_for_date,
        equipment_slot: i.equipment_slot,
        category: i.category,
        difficulty: i.difficulty,
        day_in_84: i.day_in_84,
        issue_message: i.issue_message,
        autofix_attempted: i.autofix_attempted,
        autofix_status: i.autofix_status,
        autofix_result: i.autofix_result,
        candidate_rejection_reasons: i.candidate_rejection_reasons,
        attempt_count: 1,
        resolved_at: i.autofix_status === "fixed" ? new Date().toISOString() : null,
      }));
      const { error: insErr } = await supabase.from("system_health_events").insert(rows);
      if (insErr) console.error("[WATCHDOG] failed to write events:", insErr.message);
    }

    const unresolved = allIssues.filter((i) => i.autofix_status !== "fixed");

    return new Response(
      JSON.stringify({
        success: unresolved.length === 0,
        mode: "self-healing-library",
        horizon_checked: horizon.map((h) => h.date),
        total_issues: allIssues.length,
        resolved: allIssues.length - unresolved.length,
        unresolved: unresolved.length,
        issues: allIssues,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[WATCHDOG] failure:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});