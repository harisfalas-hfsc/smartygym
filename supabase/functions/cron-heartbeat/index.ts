import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getAdminNotificationEmail } from "../_shared/admin-settings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Cron Heartbeat
 *
 * Runs daily at 12:00 UTC. Reads cron_job_metadata + the live scheduler and
 * sends ONE daily summary email covering the last 24 hours: which jobs ran
 * successfully, which failed, and which are overdue. Throttled to at most
 * one email per UTC day.
 *
 * Heuristic for "overdue":
 *   - We approximate the expected interval between runs from the cron expression.
 *   - A job is overdue if last_run_at is older than (expected_interval * 2 + 30 min grace).
 *   - Jobs that have never run yet are flagged if metadata is older than 24h.
 */

const PROJECT_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
const DAILY_ALERT_JOB_NAME = "cron-heartbeat-alert";

type CronRow = {
  job_name: string;
  display_name: string;
  schedule: string;
  edge_function_name: string | null;
  is_critical: boolean;
  is_active: boolean;
  last_run_at: string | null;
  last_run_status: string | null;
  consecutive_failures: number;
  created_at: string;
};

type CronSnapshotRow = {
  job_name: string;
  display_name: string;
  registered_schedule: string;
  live_schedule: string | null;
  edge_function_name: string | null;
  is_critical: boolean;
  is_active: boolean;
  metadata_last_run_at: string | null;
  metadata_last_run_status: string | null;
  consecutive_failures: number;
  created_at: string;
  live_job_exists: boolean;
  live_job_active: boolean;
  scheduler_last_run_at: string | null;
  scheduler_last_status: string | null;
  scheduler_last_message: string | null;
};

function snapshotToCronRow(row: CronSnapshotRow): CronRow {
  return {
    job_name: row.job_name,
    display_name: row.display_name,
    schedule: row.live_schedule || row.registered_schedule,
    edge_function_name: row.edge_function_name,
    is_critical: row.is_critical,
    is_active: row.is_active,
    last_run_at: row.scheduler_last_run_at || row.metadata_last_run_at,
    last_run_status: row.scheduler_last_status || row.metadata_last_run_status,
    consecutive_failures: row.consecutive_failures,
    created_at: row.created_at,
  };
}

/** Roughly estimate the expected interval (in minutes) between runs from a cron expression. */
function estimateIntervalMinutes(cron: string): number {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return 24 * 60; // unknown -> 1 day
  const [minute, hour, dom, month, dow] = parts;

  // Daily at fixed time
  if (minute !== "*" && !minute.startsWith("*/") && hour !== "*" && !hour.startsWith("*/")
      && dom === "*" && month === "*" && dow === "*") {
    return 24 * 60;
  }
  // Yearly
  if (month !== "*") return 365 * 24 * 60;
  // Monthly
  if (dom !== "*" && !dom.startsWith("*/")) return 30 * 24 * 60;
  // Weekly
  if (dow !== "*" && !dow.startsWith("*/")) return 7 * 24 * 60;
  // Hourly step
  if (hour.startsWith("*/")) return parseInt(hour.slice(2), 10) * 60;
  // Minute step (every N minutes)
  if (minute.startsWith("*/")) return parseInt(minute.slice(2), 10);
  // Every minute
  if (minute === "*") return 1;
  // Hourly at fixed minute
  if (minute !== "*" && hour === "*") return 60;
  return 24 * 60;
}

/**
 * Freeze awareness. While the admin Freeze System switch is on, every scheduled
 * job is intentionally disabled — nothing is "overdue". After an unfreeze, each
 * job needs one full interval before it can legitimately have run again, so
 * missed runs from the freeze window must not be reported as failures.
 */
interface FreezeInfo { frozen: boolean; restoredAtMs: number | null }

async function loadFreezeInfo(supabase: ReturnType<typeof createClient>): Promise<FreezeInfo> {
  try {
    const { data } = await supabase
      .from("system_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["background_frozen", "background_freeze_snapshot"]);
    const rows = data ?? [];
    const frozenRaw = rows.find((r: any) => r.setting_key === "background_frozen")?.setting_value;
    const frozen = frozenRaw === true || frozenRaw === "true";
    const snapshot = rows.find((r: any) => r.setting_key === "background_freeze_snapshot")?.setting_value as any;
    const restoredAt = snapshot?.restored_at ? new Date(snapshot.restored_at).getTime() : null;
    return { frozen, restoredAtMs: Number.isFinite(restoredAt as number) ? restoredAt : null };
  } catch (_e) {
    return { frozen: false, restoredAtMs: null };
  }
}

function isOverdue(job: CronRow, nowMs: number): { overdue: boolean; reason: string; thresholdMinutes: number } {
  const intervalMin = estimateIntervalMinutes(job.schedule);
  // grace = 2x interval + 30 min. Only cap daily jobs at 25h so weekly/yearly
  // jobs are not falsely flagged between legitimate scheduled runs.
  let graceMin = intervalMin * 2 + 30;
  if (intervalMin === 24 * 60) graceMin = 25 * 60;
  const thresholdMs = graceMin * 60 * 1000;

  if (!job.last_run_at) {
    // Never ran. Allow at least one full expected window before alerting.
    const createdMs = new Date(job.created_at).getTime();
    if (nowMs - createdMs > thresholdMs) {
      return { overdue: true, reason: "never ran since registration", thresholdMinutes: graceMin };
    }
    return { overdue: false, reason: "new job, still in grace window", thresholdMinutes: graceMin };
  }

  const lastMs = new Date(job.last_run_at).getTime();
  const ageMin = Math.round((nowMs - lastMs) / 60000);
  if (nowMs - lastMs > thresholdMs) {
    return { overdue: true, reason: `last ran ${ageMin} minutes ago (threshold ${graceMin} min)`, thresholdMinutes: graceMin };
  }
  return { overdue: false, reason: `last ran ${ageMin} minutes ago`, thresholdMinutes: graceMin };
}

function evaluateSnapshot(row: CronSnapshotRow, nowMs: number, freeze: FreezeInfo): { overdue: boolean; reason: string; thresholdMinutes: number; job: CronRow } {
  const job = snapshotToCronRow(row);
  // Retired/inactive jobs must never be reported as overdue or critical.
  if (!row.is_active) {
    return { overdue: false, reason: "inactive (retired)", thresholdMinutes: 0, job };
  }
  if (freeze.frozen) {
    return { overdue: false, reason: "system frozen by admin", thresholdMinutes: 0, job };
  }
  if (freeze.restoredAtMs) {
    const base = isOverdue(job, nowMs);
    const sinceUnfreezeMin = (nowMs - freeze.restoredAtMs) / 60000;
    const lastMs = job.last_run_at ? new Date(job.last_run_at).getTime() : 0;
    // Missed run happened while the system was frozen and the job has not had a
    // full expected window since the unfreeze — not a real failure.
    if (base.overdue && lastMs < freeze.restoredAtMs && sinceUnfreezeMin < base.thresholdMinutes) {
      return { overdue: false, reason: "catching up after unfreeze", thresholdMinutes: base.thresholdMinutes, job };
    }
  }
  if (!row.live_job_exists) {
    return { overdue: true, reason: "not registered in the live scheduler", thresholdMinutes: 0, job };
  }
  if (!row.live_job_active) {
    return { overdue: true, reason: "registered but disabled in the live scheduler", thresholdMinutes: 0, job };
  }
  if (row.scheduler_last_status && !isHealthyRunStatus(row.scheduler_last_status)) {
    return { overdue: true, reason: `scheduler reported ${row.scheduler_last_status}: ${row.scheduler_last_message || "no details"}`, thresholdMinutes: 0, job };
  }
  return { ...isOverdue(job, nowMs), job };
}

function isHealthyRunStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  const normalized = status.toLowerCase();
  return [
    "success",
    "succeeded",
    "scheduler-succeeded",
    "assumed-healthy",
    "fixed-rerouted-to-library-picker",
  ].includes(normalized) || normalized.startsWith("fixed-") || normalized.startsWith("resolved-");
}

function isFailedRunStatus(status: string | null | undefined): boolean {
  if (!status || isHealthyRunStatus(status)) return false;
  const normalized = status.toLowerCase();
  return normalized.includes("fail") || normalized.includes("error") || normalized.includes("timeout") || normalized.includes("exception");
}

type DailyReport = {
  overdue: Array<{ job: CronRow; reason: string }>;
  failed24h: Array<{ job_name: string; display_name: string; last_status: string; last_run_at: string | null; message: string | null; is_critical: boolean }>;
  healthy24h: Array<{ job_name: string; display_name: string; last_run_at: string | null }>;
  inactive: Array<{ job_name: string; display_name: string }>;
};

async function sendDailySummary(report: DailyReport, adminEmail: string) {
  if (!RESEND_KEY) {
    console.error("[cron-heartbeat] RESEND_API_KEY not set — cannot send summary");
    return;
  }
  const resend = new Resend(RESEND_KEY);
  const criticalCount = report.overdue.filter(o => o.job.is_critical).length + report.failed24h.filter(f => f.is_critical).length;
  const subject = criticalCount > 0
    ? `🚨 SmartyGym 24h cron report — ${criticalCount} critical issue(s)`
    : report.overdue.length + report.failed24h.length > 0
      ? `⚠️ SmartyGym 24h cron report — ${report.overdue.length + report.failed24h.length} issue(s)`
      : `✅ SmartyGym 24h cron report — all systems healthy`;

  const overdueRows = report.overdue.map(({ job, reason }) => `
    <tr style="background:${job.is_critical ? '#fee2e2' : '#fef3c7'}">
      <td style="padding:8px;border:1px solid #ddd">${job.is_critical ? '🚨 ' : '⚠️ '}${job.display_name}</td>
      <td style="padding:8px;border:1px solid #ddd"><code>${job.schedule}</code></td>
      <td style="padding:8px;border:1px solid #ddd">${reason}</td>
      <td style="padding:8px;border:1px solid #ddd">${job.last_run_at ?? '— never —'}</td>
    </tr>`).join("");

  const failedRows = report.failed24h.map(f => `
    <tr style="background:#fee2e2">
      <td style="padding:8px;border:1px solid #ddd">${f.is_critical ? '🚨 ' : ''}${f.display_name}</td>
      <td style="padding:8px;border:1px solid #ddd">${f.last_status}</td>
      <td style="padding:8px;border:1px solid #ddd">${f.last_run_at ?? '—'}</td>
      <td style="padding:8px;border:1px solid #ddd"><code style="font-size:11px">${(f.message ?? '').slice(0, 200)}</code></td>
    </tr>`).join("");

  const healthyRows = report.healthy24h.map(h => `
    <tr><td style="padding:6px;border:1px solid #eee">✅ ${h.display_name}</td>
        <td style="padding:6px;border:1px solid #eee">${h.last_run_at ?? '—'}</td></tr>`).join("");

  const html = `
    <h2>${subject}</h2>
    <p style="color:#555">Daily cron report covering the last 24 hours (generated ${new Date().toISOString()}).</p>

    <h3 style="color:#b91c1c">Overdue (${report.overdue.length})</h3>
    ${report.overdue.length === 0 ? '<p style="color:#16a34a">None — all jobs ran within their expected window.</p>' : `
    <table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:13px">
      <thead><tr style="background:#f3f4f6">
        <th style="padding:8px;border:1px solid #ddd;text-align:left">Job</th>
        <th style="padding:8px;border:1px solid #ddd;text-align:left">Schedule</th>
        <th style="padding:8px;border:1px solid #ddd;text-align:left">Reason</th>
        <th style="padding:8px;border:1px solid #ddd;text-align:left">Last run</th>
      </tr></thead><tbody>${overdueRows}</tbody></table>`}

    <h3 style="color:#b91c1c;margin-top:24px">Failed in last 24h (${report.failed24h.length})</h3>
    ${report.failed24h.length === 0 ? '<p style="color:#16a34a">None.</p>' : `
    <table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:13px">
      <thead><tr style="background:#f3f4f6">
        <th style="padding:8px;border:1px solid #ddd;text-align:left">Job</th>
        <th style="padding:8px;border:1px solid #ddd;text-align:left">Status</th>
        <th style="padding:8px;border:1px solid #ddd;text-align:left">Last run</th>
        <th style="padding:8px;border:1px solid #ddd;text-align:left">Message</th>
      </tr></thead><tbody>${failedRows}</tbody></table>`}

    <h3 style="margin-top:24px">Healthy in last 24h (${report.healthy24h.length})</h3>
    <table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:12px">
      <tbody>${healthyRows}</tbody>
    </table>

    ${report.inactive.length > 0 ? `<h3 style="margin-top:24px;color:#666">Inactive / disabled (${report.inactive.length})</h3>
    <ul style="font-size:12px;color:#666">${report.inactive.map(i => `<li>${i.display_name} (<code>${i.job_name}</code>)</li>`).join("")}</ul>` : ''}

    <p style="margin-top:24px;color:#666;font-size:12px">
      Manage these in Admin → Cron Jobs Manager.
    </p>
  `;

  await resend.emails.send({
    from: "SmartyGym System <notifications@smartygym.com>",
    to: [adminEmail],
    subject,
    html,
  });
  console.log(`[cron-heartbeat] daily summary sent (overdue=${report.overdue.length}, failed=${report.failed24h.length}, healthy=${report.healthy24h.length})`);
}

async function wasAlertAlreadySentToday(supabase: ReturnType<typeof createClient>, nowMs: number): Promise<boolean> {
  const startOfUtcDay = new Date(nowMs);
  startOfUtcDay.setUTCHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("cron_job_runs")
    .select("id")
    .eq("job_name", DAILY_ALERT_JOB_NAME)
    .eq("status", "success")
    .gte("started_at", startOfUtcDay.toISOString())
    .limit(1);

  if (error) {
    console.error("[cron-heartbeat] failed to check daily alert throttle", error);
    return true;
  }

  return (data ?? []).length > 0;
}

async function recordDailyAlertAttempt(
  supabase: ReturnType<typeof createClient>,
  nowMs: number,
  status: "success" | "failed",
  metadata: Record<string, unknown>,
) {
  await supabase.from("cron_job_runs").insert({
    job_name: DAILY_ALERT_JOB_NAME,
    started_at: new Date(nowMs).toISOString(),
    finished_at: new Date().toISOString(),
    duration_ms: Date.now() - nowMs,
    status,
    metadata,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const { force = false } = await req.json().catch(() => ({ force: false }));

  const supabase = createClient(PROJECT_URL, SERVICE_KEY);
  const nowMs = Date.now();
  const freeze = await loadFreezeInfo(supabase);

  await supabase.rpc("sync_cron_metadata_from_live_scheduler");

  const { data: jobs, error } = await supabase
    .rpc("get_cron_heartbeat_snapshot");

  if (error) {
    console.error("[cron-heartbeat] failed to load jobs", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Don't alert on the heartbeat itself — it would alert about its own absence
  const filtered = (jobs ?? []).filter((j: CronSnapshotRow) => j.job_name !== "cron-heartbeat-hourly");

  const overdueJobs: Array<{ job: CronRow; reason: string }> = [];
  const report = filtered.map((row: CronSnapshotRow) => {
    const r = evaluateSnapshot(row, nowMs, freeze);
    if (r.overdue) overdueJobs.push({ job: r.job, reason: r.reason });
    return {
      job_name: row.job_name,
      is_critical: row.is_critical,
      live_job_exists: row.live_job_exists,
      live_job_active: row.live_job_active,
      scheduler_last_run_at: row.scheduler_last_run_at,
      scheduler_last_status: row.scheduler_last_status,
      overdue: r.overdue,
      reason: r.reason,
    };
  });

  // Record the heartbeat itself
  await supabase.from("cron_job_runs").insert({
    job_name: "cron-heartbeat-hourly",
    started_at: new Date(nowMs).toISOString(),
    finished_at: new Date().toISOString(),
    duration_ms: Date.now() - nowMs,
    status: "success",
    metadata: { overdue_count: overdueJobs.length, total_checked: filtered.length },
  });

  await supabase
    .from("cron_job_metadata")
    .update({
      last_run_at: new Date().toISOString(),
      last_run_status: "success",
      last_run_duration_ms: Date.now() - nowMs,
      consecutive_failures: 0,
    })
    .eq("job_name", "cron-heartbeat-hourly");

  // Build the 24h daily report sections
  const cutoffMs = nowMs - 24 * 60 * 60 * 1000;
  const failed24h: DailyReport["failed24h"] = [];
  const healthy24h: DailyReport["healthy24h"] = [];
  const inactive: DailyReport["inactive"] = [];

  for (const row of (jobs ?? []) as CronSnapshotRow[]) {
    if (!row.is_active) {
      inactive.push({ job_name: row.job_name, display_name: row.display_name });
      continue;
    }
    const lastRun = row.scheduler_last_run_at || row.metadata_last_run_at;
    const lastRunMs = lastRun ? new Date(lastRun).getTime() : 0;
    const status = row.scheduler_last_status || row.metadata_last_run_status;
    if (lastRun && lastRunMs >= cutoffMs) {
      if (isFailedRunStatus(status)) {
        failed24h.push({
          job_name: row.job_name,
          display_name: row.display_name,
          last_status: status,
          last_run_at: lastRun,
          message: row.scheduler_last_message,
          is_critical: row.is_critical,
        });
      } else {
        healthy24h.push({ job_name: row.job_name, display_name: row.display_name, last_run_at: lastRun });
      }
    }
  }

  const dailyReport: DailyReport = { overdue: overdueJobs, failed24h, healthy24h, inactive };

  let alert_status: "sent" | "throttled" | "failed" = "sent";
  const alreadySentToday = await wasAlertAlreadySentToday(supabase, nowMs);
  if (alreadySentToday) {
    alert_status = "throttled";
    console.log("[cron-heartbeat] daily summary already sent today; skipping");
  } else {
    try {
      const adminEmail = await getAdminNotificationEmail(supabase);
      await sendDailySummary(dailyReport, adminEmail);
      await recordDailyAlertAttempt(supabase, nowMs, "success", {
        overdue: overdueJobs.length,
        failed24h: failed24h.length,
        healthy24h: healthy24h.length,
        sent_to: adminEmail,
      });
      alert_status = "sent";
    } catch (e) {
      console.error("[cron-heartbeat] summary send failed", e);
      await recordDailyAlertAttempt(supabase, nowMs, "failed", {
        error: e instanceof Error ? e.message : String(e),
      });
      alert_status = "failed";
    }
  }

  return new Response(JSON.stringify({
    success: true,
    total_checked: filtered.length,
    overdue_count: overdueJobs.length,
    failed_24h_count: failed24h.length,
    healthy_24h_count: healthy24h.length,
    alert_status,
    report,
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});