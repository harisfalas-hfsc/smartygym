// Background repair of the existing workout library.
//
// No new coaching rules live here. Deterministic fixes are pure text surgery on
// the stored HTML; anything deeper is regenerated through the SAME shared
// engine the generators use (generateWorkoutContent), and every result is
// re-judged by the SAME auditWorkout used by the read-only audit.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

import { requireAdminOrServiceRole } from "../_shared/admin-or-service-auth.ts";
import { loadAllExercises, type PoolExercise } from "../_shared/workout-engine/pool.server.ts";
import {
  auditWorkout,
  normalizeCategory,
  normalizeFormat,
  parseTargetMinutes,
  type AuditRow,
  type WorkoutRow,
} from "../_shared/workout-engine/compliance.ts";
import { generateWorkoutContent } from "../_shared/workout-engine/generate.server.ts";
import { microMinutes } from "../_shared/workout-engine/programming.ts";
import { findTokens } from "../_shared/workout-engine/tokens.ts";
import { categoryAllowsFinisher } from "../_shared/workout-engine/doctrine.ts";
import {
  CATEGORY_FORMATS,
  STRENGTH_FOCUS,
  type EquipmentMode,
  type StrengthFocus,
} from "../_shared/workout-engine/spec.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const WORKOUT_COLUMNS =
  "id,name,category,format,difficulty_stars,equipment,duration,focus,main_workout";

/** Wall-clock budget for one pass; the cron tick picks the job up again. */
const PASS_MS = 95_000;
/** Hard caps per pass so one invocation can never run away. */
const MAX_ITEMS_PER_PASS = 25;
const MAX_AI_PER_PASS = 2;
/** Lease length — a crashed pass frees the job automatically. */
const LEASE_MS = 180_000;

type Db = ReturnType<typeof createClient>;

function log(step: string, details?: unknown) {
  console.log(`[REPAIR] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
}

/** 402 / 403 / out-of-credit conditions must stop the whole job, not one item. */
function terminalAiFailure(message: string): string | null {
  const m = message.toLowerCase();
  if (m.includes("402") || m.includes("credit")) return "AI credits are exhausted.";
  if (m.includes("403")) return "AI access is blocked for this workspace.";
  if (m.includes("401") || m.includes("not configured")) return "AI is not configured.";
  return null;
}

// ---------------------------------------------------------------- tier 1 ----

/** Rename every token to its exact library name. */
function fixNames(html: string, libraryById: Map<string, PoolExercise>): string {
  let out = html;
  for (const token of findTokens(html)) {
    const lib = libraryById.get(token.id);
    if (!lib) continue;
    if (lib.name.toLowerCase().trim() === token.name.toLowerCase().trim()) continue;
    out = out.split(token.raw).join(`{{exercise:${token.id}:${lib.name}}}`);
  }
  return out;
}

/** Soft Tissue Preparation never carries exercise links — unwrap them to text. */
function fixSoftTissue(html: string): string {
  const cut = html.indexOf("🔥");
  if (cut <= 0) return html;
  const head = html.slice(0, cut);
  const tail = html.slice(cut);
  const cleanHead = head.replace(/\{\{exercise:[A-Za-z0-9_-]+:([^}]*)\}\}/g, (_m, name) =>
    String(name),
  );
  return cleanHead + tail;
}

/** Start of the HTML element that carries `index`. */
function blockStart(html: string, index: number): number {
  const open = html.lastIndexOf("<", index);
  return open === -1 ? index : open;
}

/** Remove a Finisher block from a category that must never carry one. */
function removeFinisher(html: string): string {
  const flash = html.indexOf("⚡");
  if (flash === -1) return html;
  const start = blockStart(html, flash);
  const cool = html.indexOf("🧘", flash);
  const end = cool === -1 ? html.length : blockStart(html, cool);
  return (html.slice(0, start) + html.slice(end)).trim();
}

type DeterministicResult = { html: string; format: string | null; changed: boolean };

function deterministicRepair(
  row: WorkoutRow,
  audit: AuditRow,
  libraryById: Map<string, PoolExercise>,
): DeterministicResult {
  const codes = new Set([...audit.errors, ...audit.warnings].map((i) => i.code));
  const category = normalizeCategory(row.category);
  let html = row.main_workout ?? "";
  let format: string | null = null;

  if (codes.has("NAME_MISMATCH")) html = fixNames(html, libraryById);
  if (codes.has("SOFT_TISSUE_TOKENS")) html = fixSoftTissue(html);
  if (codes.has("ILLEGAL_FINISHER") && category && !categoryAllowsFinisher(category)) {
    html = removeFinisher(html);
  }
  if (codes.has("FORMAT_ILLEGAL") && category) {
    const current = normalizeFormat(row.format);
    const legal = CATEGORY_FORMATS[category];
    if (!current || !legal.includes(current)) format = legal[0] ?? null;
  }

  const changed = html !== (row.main_workout ?? "") || format !== null;
  return { html, format, changed };
}

// ---------------------------------------------------------------- tier 2/3 --

async function regenerate(
  db: Db,
  row: WorkoutRow,
  usedNames: string[],
): Promise<string> {
  const category = normalizeCategory(row.category);
  if (!category) throw new Error(`Unknown category "${row.category}"`);
  const isMicro = category === "MICRO-WORKOUTS";
  const equipmentMode: EquipmentMode =
    isMicro || String(row.equipment ?? "").toUpperCase().includes("BODYWEIGHT")
      ? "BODYWEIGHT"
      : "EQUIPMENT";
  const stars = Math.max(1, Math.min(6, Number(row.difficulty_stars) || 3));
  const baseMinutes = parseTargetMinutes(row.duration) ?? (isMicro ? 10 : 30);
  const minutes = isMicro ? microMinutes(baseMinutes) : baseMinutes;
  const requested = normalizeFormat(row.format);
  const format = requested && CATEGORY_FORMATS[category].includes(requested) ? requested : null;
  const rawFocus = String(row.focus ?? "").toUpperCase().trim();
  const focus = (STRENGTH_FOCUS as readonly string[]).includes(rawFocus)
    ? (rawFocus as StrengthFocus)
    : null;

  const built = await generateWorkoutContent(
    // deno-lint-ignore no-explicit-any
    db as any,
    {
      category,
      format,
      equipmentMode,
      selectedEquipment: equipmentMode === "BODYWEIGHT" ? ["bodyweight"] : ["fullgym"],
      stars,
      minutes,
      focus,
      athlete: {
        name: null,
        fitness_level: null,
        primary_goal: null,
        secondary_goal: null,
        location: "anywhere",
        mood: "normal",
      },
    },
    usedNames,
  );
  return built.main_workout;
}

// ------------------------------------------------------------------ pass ----

type Counters = {
  auto_fixed: number;
  ai_fixed: number;
  unchanged: number;
  needs_review: number;
};

async function saveAudit(db: Db, audit: AuditRow) {
  await db.from("workout_compliance_audit").upsert(
    {
      workout_id: audit.workout_id,
      name: audit.name,
      category: audit.category,
      format: audit.format,
      status: audit.status,
      repair_tier: audit.repair_tier,
      errors: audit.errors,
      warnings: audit.warnings,
      work_minutes: audit.work_minutes,
      session_minutes: audit.session_minutes,
      target_minutes: audit.target_minutes,
      audited_at: new Date().toISOString(),
    },
    { onConflict: "workout_id" },
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const unauthorized = await requireAdminOrServiceRole(req, corsHeaders);
  if (unauthorized) return unauthorized;

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    const body = (await req.json().catch(() => ({}))) as { action?: string };
    const action = String(body.action ?? "tick");

    // --- control actions -----------------------------------------------
    if (action === "start") {
      const { data: active } = await db
        .from("workout_repair_jobs")
        .select("id")
        .in("status", ["running", "paused"])
        .limit(1);
      if (active?.length) return json({ ok: false, error: "A repair job already exists." }, 409);

      const { data: failing } = await db
        .from("workout_compliance_audit")
        .select("workout_id,repair_tier,status")
        .in("status", ["fail", "warn"])
        .order("repair_tier", { ascending: true })
        .limit(2000);
      const queue = (failing ?? [])
        .filter((r: { repair_tier: number; status: string }) =>
          r.status === "fail" || r.repair_tier > 0
        )
        .map((r: { workout_id: string }) => r.workout_id);
      if (!queue.length) return json({ ok: false, error: "Nothing to repair." }, 400);

      const { data: job, error } = await db
        .from("workout_repair_jobs")
        .insert({ status: "running", queue, total: queue.length })
        .select()
        .single();
      if (error) throw new Error(error.message);
      log("job started", { total: queue.length });
      return json({ ok: true, job });
    }

    const { data: jobs } = await db
      .from("workout_repair_jobs")
      .select("*")
      .in("status", ["running", "paused"])
      .order("created_at", { ascending: false })
      .limit(1);
    // deno-lint-ignore no-explicit-any
    const job = (jobs?.[0] ?? null) as any;

    if (action === "status") return json({ ok: true, job });
    if (!job) return json({ ok: true, job: null, idle: true });

    if (action === "pause") {
      await db.from("workout_repair_jobs")
        .update({ status: "paused", pause_reason: "Paused by the administrator." })
        .eq("id", job.id);
      return json({ ok: true });
    }
    if (action === "resume") {
      await db.from("workout_repair_jobs")
        .update({ status: "running", pause_reason: null, locked_until: null })
        .eq("id", job.id);
      return json({ ok: true });
    }
    if (action === "cancel") {
      await db.from("workout_repair_jobs").update({ status: "cancelled" }).eq("id", job.id);
      return json({ ok: true });
    }

    // --- worker tick -----------------------------------------------------
    if (job.status !== "running") return json({ ok: true, skipped: "paused" });
    const now = Date.now();
    if (job.locked_until && new Date(job.locked_until).getTime() > now) {
      return json({ ok: true, skipped: "locked" });
    }
    const lease = new Date(now + LEASE_MS).toISOString();
    const { data: leased } = await db
      .from("workout_repair_jobs")
      .update({ locked_until: lease })
      .eq("id", job.id)
      .eq("status", "running")
      .or(`locked_until.is.null,locked_until.lt.${new Date(now).toISOString()}`)
      .select("id");
    if (!leased?.length) return json({ ok: true, skipped: "locked" });

    const queue: string[] = job.queue ?? [];
    const counters: Counters = {
      auto_fixed: job.auto_fixed ?? 0,
      ai_fixed: job.ai_fixed ?? 0,
      unchanged: job.unchanged ?? 0,
      needs_review: job.needs_review ?? 0,
    };
    const failures: Array<{ id: string; name: string; reason: string }> = job.failures ?? [];

    const library: PoolExercise[] = await loadAllExercises(db);
    const libraryById = new Map(library.map((e) => [e.id, e]));
    const { data: nameRows } = await db.from("admin_workouts").select("name");
    const usedNames = (nameRows ?? [])
      .map((w: { name: string | null }) => w.name)
      .filter(Boolean) as string[];

    let cursor: number = job.cursor ?? 0;
    let aiCalls = 0;
    let processed = 0;
    let pauseReason: string | null = null;
    const started = Date.now();

    while (
      cursor < queue.length &&
      processed < MAX_ITEMS_PER_PASS &&
      Date.now() - started < PASS_MS
    ) {
      const workoutId = queue[cursor]!;
      const { data: rowData } = await db
        .from("admin_workouts")
        .select(WORKOUT_COLUMNS)
        .eq("id", workoutId)
        .maybeSingle();
      const row = rowData as WorkoutRow | null;
      if (!row) {
        cursor++;
        processed++;
        counters.unchanged++;
        continue;
      }

      const before = auditWorkout(row, libraryById);
      if (before.status === "pass") {
        await saveAudit(db, before);
        counters.unchanged++;
        cursor++;
        processed++;
        continue;
      }

      // Tier 1 — free, deterministic.
      const fixed = deterministicRepair(row, before, libraryById);
      if (fixed.changed) {
        const candidate: WorkoutRow = {
          ...row,
          main_workout: fixed.html,
          format: fixed.format ?? row.format,
        };
        const after = auditWorkout(candidate, libraryById);
        if (after.status !== "fail") {
          await db.from("workout_content_backup").insert({
            workout_id: row.id,
            main_workout: row.main_workout,
            reason: "tier-1 auto repair",
            job_id: job.id,
          });
          await db.from("admin_workouts").update({
            main_workout: fixed.html,
            ...(fixed.format ? { format: fixed.format } : {}),
          }).eq("id", row.id);
          await saveAudit(db, after);
          counters.auto_fixed++;
          cursor++;
          processed++;
          continue;
        }
      }

      // Tier 2 / 3 — regeneration on the shared engine.
      if (aiCalls >= MAX_AI_PER_PASS) break;
      aiCalls++;
      try {
        const html = await regenerate(db, row, usedNames);
        const candidate: WorkoutRow = { ...row, main_workout: html };
        const after = auditWorkout(candidate, libraryById);
        if (after.status !== "fail") {
          await db.from("workout_content_backup").insert({
            workout_id: row.id,
            main_workout: row.main_workout,
            reason: "ai repair",
            job_id: job.id,
          });
          await db.from("admin_workouts").update({ main_workout: html }).eq("id", row.id);
          await saveAudit(db, after);
          counters.ai_fixed++;
        } else {
          await saveAudit(db, before);
          counters.needs_review++;
          failures.push({
            id: row.id,
            name: row.name ?? row.id,
            reason: after.errors.slice(0, 3).map((e) => e.message).join(" "),
          });
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        const terminal = terminalAiFailure(message);
        if (terminal) {
          pauseReason = terminal;
          break;
        }
        counters.needs_review++;
        failures.push({ id: row.id, name: row.name ?? row.id, reason: message.slice(0, 200) });
      }
      cursor++;
      processed++;
    }

    const done = cursor >= queue.length;
    const status = pauseReason ? "paused" : done ? "completed" : "running";
    await db.from("workout_repair_jobs").update({
      cursor,
      ...counters,
      failures: failures.slice(-200),
      status,
      pause_reason: pauseReason,
      locked_until: null,
    }).eq("id", job.id);

    log("pass", { cursor, total: queue.length, processed, aiCalls, status });
    return json({ ok: true, cursor, total: queue.length, processed, status, counters });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[REPAIR] pass failed", message);
    return json({ ok: false, error: message }, 500);
  }
});
