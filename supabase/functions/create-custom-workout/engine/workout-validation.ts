/**
 * Delivery guarantee — soft vs structural faults.
 *
 * A paid or requested workout must ALWAYS be delivered. Cosmetic drift
 * (volume estimates, naming, repetition, quality score) never blocks a
 * delivery; it is attached to the workout as a caution note instead.
 * Only structural faults — a missing block, a wrong number of exercises,
 * an exercise outside the library or outside the athlete's equipment —
 * may trigger a repair pass.
 */

/**
 * Duration faults. A session that does not fit the advertised time is NOT
 * cosmetic — the athlete bought 40 minutes, not 66 — so these block a
 * candidate and force a regeneration. They are listed separately because the
 * very last deterministic fallback may still ship with a caution rather than
 * leave the athlete with nothing at all.
 */
const DURATION_PATTERNS: RegExp[] = [
  /materially exceeds/i,
  /materially short/i,
  /falls far short/i,
  /far beyond the requested/i,
  /is too long/i,
];

export function isDurationIssue(message: string): boolean {
  return DURATION_PATTERNS.some((re) => re.test(message));
}

/** Messages that describe drift, not a broken session. */
const SOFT_PATTERNS: RegExp[] = [
  /session quality/i,
  /did not match the library entry/i,
  /name was replaced/i,
  /repeats the same/i,
  /appeared in a recent session/i,
  /below the .* target/i,
];

export function isSoftIssue(message: string): boolean {
  return SOFT_PATTERNS.some((re) => re.test(message));
}

export type IssueSplit = { structural: string[]; soft: string[] };

/** Splits validation/enforcement messages into blocking and non-blocking sets. */
export function classifyIssues(messages: readonly string[]): IssueSplit {
  const structural: string[] = [];
  const soft: string[] = [];
  for (const raw of messages) {
    const message = String(raw ?? "").trim();
    if (!message) continue;
    (isSoftIssue(message) ? soft : structural).push(message);
  }
  return { structural, soft };
}

/**
 * Last-resort split used by the deterministic fallback only: duration faults
 * become cautions so a paid request is still delivered, while every real
 * structural fault still blocks.
 */
export function classifyIssuesForFallback(messages: readonly string[]): IssueSplit {
  const { structural, soft } = classifyIssues(messages);
  return {
    structural: structural.filter((m) => !isDurationIssue(m)),
    soft: [...soft, ...structural.filter(isDurationIssue)],
  };
}

/** True when nothing structural is wrong — the workout may be delivered. */
export function isDeliverable(messages: readonly string[]): boolean {
  return classifyIssues(messages).structural.length === 0;
}

/** Plain-language caution note shown to the athlete for soft drift. */
export function cautionNote(soft: readonly string[]): string | null {
  if (!soft.length) return null;
  return "Smarty Coach adjusted a few details of this session so it still fits your time and your level.";
}

// ---------------------------------------------------------------------------
// Contradictory answers — resolved by priority, never by failing
// ---------------------------------------------------------------------------

/**
 * Priority, highest first:
 * injuries / medical limits > available equipment > experience level >
 * training goal > preferred exercises > disliked exercises.
 */
export type ConflictInput = {
  limitations?: string[];
  equipment?: string[];
  location?: string;
  level?: string;
  goal?: string;
  minutes?: number;
  favorites?: string[];
  dislikes?: string[];
};

export type ConflictResolution = {
  equipment: string[];
  level: string | undefined;
  goal: string | undefined;
  minutes: number | undefined;
  favorites: string[];
  dislikes: string[];
  /** Plain-language notes for the athlete. */
  notes: string[];
};

const HIGH_IMPACT_GOALS = new Set(["challenge", "calorie", "metabolic", "cardio"]);
const OUTDOOR_PORTABLE = new Set(["bodyweight", "dumbbells", "kettlebell", "bands", "jump-rope", "other"]);

export function resolveRequestConflicts(input: ConflictInput): ConflictResolution {
  const notes: string[] = [];
  const limitations = (input.limitations ?? []).map((l) => l.toLowerCase());
  let equipment = [...new Set((input.equipment ?? []).filter(Boolean))];
  let level = input.level;
  let goal = input.goal;
  let minutes = input.minutes;
  const favorites = [...new Set(input.favorites ?? [])];
  let dislikes = [...new Set(input.dislikes ?? [])];

  // 1. Injuries / medical limits win over everything.
  const hasLimits = limitations.length > 0;
  if (hasLimits && goal && HIGH_IMPACT_GOALS.has(goal) && limitations.some((l) => /knee|back|hip|ankle|shoulder|heart|pregnan/.test(l))) {
    goal = "strength";
    notes.push("We swapped the high-impact goal for a controlled strength session because of the limitations in your profile.");
  }
  if (hasLimits && level === "advanced") {
    level = "intermediate";
    notes.push("We eased the difficulty one level to respect the limitations you told us about.");
  }

  // 2. Equipment reality — an outdoor session can only use portable kit.
  if ((input.location ?? "") === "outdoor") {
    const filtered = equipment.filter((e) => OUTDOOR_PORTABLE.has(e));
    if (filtered.length !== equipment.length) {
      notes.push("Outdoors we only planned around equipment you can carry with you.");
      equipment = filtered;
    }
  }
  if (!equipment.length) {
    equipment = ["bodyweight"];
    if ((input.equipment ?? []).length) notes.push("We built a bodyweight session because none of the selected equipment fitted this setup.");
  }

  // 3. Time sanity.
  if (typeof minutes === "number" && Number.isFinite(minutes)) {
    const clamped = Math.max(10, Math.min(90, Math.round(minutes)));
    if (clamped !== minutes) {
      notes.push(`We set the session to ${clamped} minutes of training.`);
      minutes = clamped;
    }
  }

  // 4. Preferences are the lowest priority — a liked exercise never overrides
  // equipment or medical limits, and a disliked one is dropped when it is also
  // a favourite (the like wins, per priority order).
  if (favorites.length && dislikes.length) {
    const overlap = dislikes.filter((d) => favorites.includes(d));
    if (overlap.length) {
      dislikes = dislikes.filter((d) => !favorites.includes(d));
      notes.push("A few exercises were both liked and disliked — we kept them in.");
    }
  }

  return {
    equipment,
    level,
    goal,
    minutes,
    favorites,
    dislikes,
    notes,
  };
}

// ---------------------------------------------------------------------------
// Retry policy
// ---------------------------------------------------------------------------

export const MAX_GENERATION_ATTEMPTS = 5;

/** Exponential backoff in milliseconds for attempt number (1-based). */
export function retryDelayMs(attempt: number): number {
  const n = Math.max(1, Math.min(MAX_GENERATION_ATTEMPTS, attempt));
  return Math.round(2 * 60 * 1000 * Math.pow(2, n - 1)); // 2m, 4m, 8m, 16m, 32m
}

export type FailureKind = "technical" | "ai_balance" | "outage";

/** Classifies a raw error message into the alerting bucket. */
export function classifyFailureKind(message: string): FailureKind {
  const m = String(message ?? "").toLowerCase();
  if (/402|payment required|credit|balance|quota exceeded|insufficient funds/.test(m)) return "ai_balance";
  if (/403|429|rate limit|5\d\d\b|timeout|timed out|fetch failed|network|econn|unavailable|gateway/.test(m))
    return "outage";
  return "technical";
}

/** Every email for a session is keyed off the session id so retries never duplicate. */
export function generationIdempotencyKey(sessionId: string, templateName: string, recipient = ""): string {
  return [sessionId, templateName, recipient].filter(Boolean).join(":");
}

/** The only message an athlete ever sees for a generation failure. */
export const CUSTOMER_FAILURE_MESSAGE =
  "We hit a temporary snag building your workout. Your payment and your answers are safe, we are already on it, and you will get your workout shortly — nothing for you to do.";
