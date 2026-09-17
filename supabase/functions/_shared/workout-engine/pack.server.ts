// Deterministic template ("pack") engine.
// Builds a fully compliant session straight from the filtered pool — no model
// involved. Used as the reliability fallback when the AI cannot produce a
// workout that passes enforcement + validation.
import type { PoolExercise } from "./pool.server.ts";
import { pickPrep, STRETCH_RE } from "./pool.server.ts";
import {
  dominantRegion,
  equipmentFamilyLimit,
  equipmentFamilyOf,
  focusRegion,
  orderForSequence,
  focusViolation,
  regionOf,
} from "./doctrine.ts";
import type { Category, DifficultyLevel, Format, StrengthFocus } from "./spec.ts";

export type PackInput = {
  category: Category;
  format: Format;
  level: DifficultyLevel;
  minutes: number;
  focus?: StrengthFocus | null;
  favoriteIds?: string[];
  /** Library-backed prep vocabulary; guarantees playable Activation / Cool Down. */
  activationPool?: PoolExercise[];
  cooldownPool?: PoolExercise[];
  seed?: number;
};


export type PackResult = { html: string; name: string; blocks: string[] };

const li = (inner: string) =>
  `<ul class="tiptap-bullet-list"><li class="tiptap-list-item"><p class="tiptap-paragraph">${inner}</p></li></ul>`;
const para = (inner: string) => `<p class="tiptap-paragraph">${inner}</p>`;
const heading = (icon: string, title: string) =>
  para(`${icon} <strong><u>${title}</u></strong>`);
const token = (e: PoolExercise) => `{{exercise:${e.id}:${e.name}}}`;

const SOFT_TISSUE = [
  "60 sec Foam roll quadriceps — slow controlled passes",
  "60 sec Foam roll thoracic spine — pause on tender spots",
  "45 sec Lacrosse ball glute release — each side",
];

const COOLDOWN_FALLBACK = [
  "45 sec Standing hamstring stretch — each side, breathe out into it",
  "45 sec Chest doorway stretch — ribs down, shoulders relaxed",
  "60 sec Box breathing — 4 in, 4 hold, 4 out, 4 hold",
];

const ACTIVATION_FALLBACK = [
  "10 reps Bodyweight glute bridge — squeeze 1 sec at the top",
  "10 reps Scapular wall slide — keep ribs down",
  "8 reps each side World’s greatest stretch — slow and controlled",
  "20 sec Dead bug hold — breathe, no arching",
];

const ACTIVATION_OK_RE =
  /\b(bridge|bird dog|dead bug|clamshell|circle|swing leg|leg swing|march|walkout|cat|scapular|band pull|wall slide|hip opener|arm circle|ankle|good morning|inchworm|lunge|squat)\b/i;

const ACTIVATION_BAN_RE =
  /\b(barbell|dumbbell|kettlebell|machine|cable|smith|sled|weighted|deadlift|bench press|pull-?up|chin-?up|muscle-?up|burpee|box jump|sprint|dip|clean|snatch|jerk|thruster)\b/i;

const isBodyweight = (e: PoolExercise) => (e.equipment ?? "").toLowerCase().includes("body weight");

function shuffle<T>(arr: T[], seed = 1): T[] {
  const a = arr.slice();
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Picks `count` exercises, rotating body parts and honouring favourites first.
 *
 * `familyBudget` keeps the deterministic session runnable: bodyweight is free,
 * but only `limit` implement families may appear across the whole session
 * (§12), so the template engine never builds a block the validator rejects.
 */
export function pickBalanced(
  pool: PoolExercise[],
  count: number,
  opts: {
    favoriteIds?: string[];
    exclude?: Set<string>;
    filter?: (e: PoolExercise) => boolean;
    familyBudget?: { limit: number; used: Set<string> };
  } = {},
): PoolExercise[] {
  const exclude = opts.exclude ?? new Set<string>();
  const candidates = pool.filter((e) => !exclude.has(e.id) && (opts.filter ? opts.filter(e) : true));
  if (!candidates.length) return [];

  const budget = opts.familyBudget;
  const familyAllowed = (e: PoolExercise) => {
    if (!budget) return true;
    const fam = equipmentFamilyOf(e.equipment);
    if (fam === "bodyweight") return true;
    return budget.used.has(fam) || budget.used.size < budget.limit;
  };
  const takeFamily = (e: PoolExercise) => {
    if (!budget) return;
    const fam = equipmentFamilyOf(e.equipment);
    if (fam !== "bodyweight") budget.used.add(fam);
  };

  const favourites = (opts.favoriteIds ?? []).length
    ? candidates.filter((e) => opts.favoriteIds!.includes(e.id))
    : [];

  const byPart = new Map<string, PoolExercise[]>();
  for (const e of candidates) {
    if (favourites.includes(e)) continue;
    const key = e.body_part ?? "other";
    if (!byPart.has(key)) byPart.set(key, []);
    byPart.get(key)!.push(e);
  }

  const picked: PoolExercise[] = [];
  const seen = new Set<string>();
  for (const fav of favourites) {
    if (picked.length >= count) break;
    if (!familyAllowed(fav)) continue;
    picked.push(fav);
    takeFamily(fav);
    seen.add(fav.id);
  }

  const parts = shuffle([...byPart.keys()], candidates.length);
  let guard = 0;
  while (picked.length < count && guard < count * 12) {
    guard += 1;
    let progressed = false;
    for (const part of parts) {
      const list = byPart.get(part);
      if (!list?.length) continue;
      const next = list.shift()!;
      progressed = true;
      if (seen.has(next.id) || !familyAllowed(next)) continue;
      picked.push(next);
      takeFamily(next);
      seen.add(next.id);
      if (picked.length >= count) break;
    }
    if (!progressed || parts.every((p) => !byPart.get(p)?.length)) break;
  }
  return picked;
}

type Dose = { text: string; protocol: string | null };

function doseFor(format: Format, level: DifficultyLevel, index: number): Dose {
  const sets = level === "beginner" ? 3 : level === "advanced" ? 5 : 4;
  const reps = level === "beginner" ? 10 : level === "advanced" ? 8 : 10;
  const rest = level === "beginner" ? 90 : level === "advanced" ? 60 : 75;
  const work = level === "beginner" ? 30 : level === "advanced" ? 45 : 40;

  switch (format) {
    case "REPS & SETS":
      return {
        text: `${sets} sets × ${reps} reps`,
        protocol: `Rest ${rest} sec between sets. Controlled lowering, strong finish.`,
      };
    case "TABATA":
      return { text: "20 sec", protocol: "8 rounds of 20 sec work / 10 sec rest per station." };
    case "EMOM":
      return { text: `Minute ${index + 1}: ${reps + 2} reps`, protocol: null };
    case "AMRAP":
      return { text: `${reps + 2} reps`, protocol: null };
    case "FOR TIME":
      return { text: `${reps * 2} reps`, protocol: null };
    case "MIX":
      return index < 2
        ? { text: `${sets} sets × ${reps} reps`, protocol: null }
        : { text: `${work} sec`, protocol: null };
    case "CIRCUIT":
    default:
      return { text: `${work} sec`, protocol: null };
  }
}

/**
 * Rounds are sized so stations × rounds × (work + rest) really fills the
 * requested training time — the duration estimator multiplies every line by
 * the declared round count, so this must agree with it.
 */
export function circuitRounds(minutes: number, stations: number): number {
  const perStationSec = 60; // ~40 sec work + transition
  return Math.max(2, Math.min(8, Math.round((minutes * 60 * 0.85) / Math.max(1, stations * perStationSec))));
}

function roundsFor(format: Format, minutes: number, stations: number): string | null {
  const rounds = circuitRounds(minutes, stations);
  switch (format) {
    case "CIRCUIT":
      return `${rounds} rounds. Rest 60 sec between rounds.`;
    case "AMRAP":
      return `As many rounds as possible in ${Math.max(8, Math.round(minutes * 0.9))} minutes.`;
    case "FOR TIME":
      return `${rounds} rounds for time. Cap: ${Math.max(10, Math.round(minutes * 0.9))} minutes.`;
    case "EMOM":
      return `EMOM for ${Math.max(10, Math.round(minutes * 0.9))} minutes, cycling the list.`;
    case "TABATA":
      return `8 rounds of 20 sec work / 10 sec rest at every station.`;
    default:
      return null;
  }
}

const NAME_LEFT = ["Steady", "Honest", "Quiet", "Clean", "Solid", "Simple", "Patient", "Sharp"];
const NAME_RIGHT: Record<string, string> = {
  STRENGTH: "Lift Session",
  "CALORIE BURNING": "Sweat Session",
  METABOLIC: "Mixed Session",
  CARDIO: "Pace Session",
  "MOBILITY & STABILITY": "Mobility Session",
  CHALLENGE: "Test Session",
  PILATES: "Mat Session",
  RECOVERY: "Reset Session",
  "MICRO-WORKOUTS": "Short Session",
};

/**
 * Builds a compliant session deterministically from the pool.
 * `library` supplies activation / cool-down movements that the strict session
 * pool may have filtered out.
 */
export function buildPackWorkout(
  pool: PoolExercise[],
  library: PoolExercise[],
  input: PackInput,
): PackResult {
  const isMicro = input.category === "MICRO-WORKOUTS";
  const isRecovery = input.category === "RECOVERY";
  // HARD RULE: Micro Workout and Pilates never get a finisher.
  const noFinisher = isMicro || isRecovery || input.category === "PILATES";
  const favouriteIds = input.favoriteIds ?? [];
  const used = new Set<string>();

  // The main block is sized against the requested training time using the same
  // arithmetic the duration check uses (sets × (reps × 4 sec + 60 sec rest)),
  // so a 30-minute request never ships as a 50-minute session.
  const budgetCount = (() => {
    if (isMicro) return 4;
    const probe = doseFor(input.format, input.level, 0);
    // Round-based formats fill the clock with rounds, not with more stations.
    if (!/sets?/i.test(probe.text)) return input.minutes <= 20 ? 4 : 5;
    const sets = Number(probe.text.match(/(\d+)\s*sets?/i)?.[1] ?? 1);
    const reps = Number(probe.text.match(/(\d+)\s*reps?/i)?.[1] ?? 12);
    const secondsPerExercise = sets * (reps * 4 + 60) + 15;
    const finisherSeconds = noFinisher ? 0 : 3 * (12 * 4 + 60);
    const available = Math.max(120, input.minutes * 60 - finisherSeconds);
    return Math.max(3, Math.min(6, Math.round(available / secondsPerExercise)));
  })();
  // §15 — the chosen body focus is a hard rule for the template engine too.
  // On-focus movements first. When the library cannot cover the whole block
  // with them, the BLOCK SHRINKS rather than drifting off target; only if even
  // the minimum cannot be met does support work from the SAME body region get
  // added — never work from another region (no chest press in CORE & GLUTES).
  const focus = input.focus ?? null;
  const onFocus = focus ? pool.filter((e) => !focusViolation(e, focus)) : pool;
  const finisherSlots = noFinisher ? 0 : 3;
  const minMain = isMicro ? 3 : 4;

  let workPool = onFocus;
  let mainCount = budgetCount;
  if (focus) {
    if (onFocus.length >= minMain) {
      // Enough on-focus vocabulary for a legitimate block: stay strictly on
      // focus and let the block SHRINK (the finisher reuses main movements
      // when there is nothing left over) rather than drift off target.
      mainCount = Math.min(budgetCount, Math.max(minMain, onFocus.length - finisherSlots));
    } else {
      // Not even the minimum exists on focus — support work from the SAME body
      // region is added, never work from another region.
      const region = focusRegion(focus);
      const onFocusIds = new Set(onFocus.map((e) => e.id));
      const regional = pool.filter((e) => {
        if (onFocusIds.has(e.id)) return false;
        const r = regionOf(e);
        return region === "full" || r === region || r === "full";
      });
      workPool = [...onFocus, ...regional];
      mainCount = Math.max(minMain, Math.min(budgetCount, workPool.length - finisherSlots));
    }
  }
  if (!workPool.length) workPool = pool;
  mainCount = Math.max(3, mainCount);

  // §12 — one shared implement budget for the whole session so the finisher
  // can never push the workout over the equipment-family ceiling.
  const familyBudget = {
    limit: equipmentFamilyLimit(input.category, input.format),
    used: new Set<string>(),
  };

  // §11 — under a clock, technical work is placed before high-fatigue work.
  const mainPicks = orderForSequence(
    pickBalanced(workPool, mainCount, {
      favoriteIds: favouriteIds,
      exclude: used,
      familyBudget,
    }),
    input.format,
  );
  mainPicks.forEach((e) => used.add(e.id));

  const finisherCandidates = noFinisher
    ? []
    : pickBalanced(workPool, 3, { exclude: used, familyBudget });
  const finisherPicks = orderForSequence(
    noFinisher
      ? []
      : finisherCandidates.length >= 3
        ? finisherCandidates
        : mainPicks.slice(0, 3),
    input.format,
  );
  finisherPicks.forEach((e) => used.add(e.id));

  const seed = input.seed ?? (mainPicks[0]?.id.length ?? 5) * 31 + input.minutes;

  // §21 — activation is DERIVED from the main block that was just built: the
  // prep vocabulary is narrowed to the dominant region of the chosen main
  // exercises before anything is picked, so irrelevant prep is never offered.
  const mainRegion = dominantRegion(mainPicks);
  const derivedActivationPool = (input.activationPool ?? []).filter((e) => {
    if (mainRegion === "full") return true;
    const r = regionOf(e);
    return (
      r === mainRegion ||
      r === "full" ||
      (mainRegion === "lower" && r === "core") ||
      (mainRegion === "core" && r === "lower")
    );
  });
  const relevantActivationPool =
    derivedActivationPool.length >= 4 ? derivedActivationPool : (input.activationPool ?? []);

  const activationPicks = (relevantActivationPool.length
    ? pickPrep(relevantActivationPool, 4, seed)
    : pickBalanced(library, 4, {
        filter: (e) =>
          isBodyweight(e) &&
          ACTIVATION_OK_RE.test(e.name) &&
          !ACTIVATION_BAN_RE.test(`${e.name} ${e.equipment ?? ""}`) &&
          (e.difficulty ?? "").toLowerCase() !== "advanced",
      })) as PoolExercise[];

  const cooldownPicks = (input.cooldownPool?.length
    ? pickPrep(input.cooldownPool, 3, seed + 17)
    : pickBalanced(library, 3, {
        filter: (e) => isBodyweight(e) && STRETCH_RE.test(e.name),
      })) as PoolExercise[];

  const blocks: string[] = [];

  if (!isMicro) {
    blocks.push(heading("🧽", "Soft Tissue Preparation"));
    SOFT_TISSUE.forEach((line) => blocks.push(li(line)));
  }

  // Micro Workout is one coherent block: no activation, no cool-down section.
  if (!isMicro) {
    blocks.push(heading("🔥", "Activation 5'"));
    if (activationPicks.length >= 3) {
      activationPicks.forEach((e) => blocks.push(li(`10 reps ${token(e)} — slow and controlled`)));
    } else {
      ACTIVATION_FALLBACK.forEach((line) => blocks.push(li(line)));
    }
  }

  const protocolLine = roundsFor(input.format, input.minutes, mainPicks.length);
  blocks.push(heading("💪", `Main Workout (${input.format})`));
  if (protocolLine) blocks.push(para(protocolLine));
  mainPicks.forEach((e, i) => {
    const dose = doseFor(input.format, input.level, i);
    blocks.push(li(`${dose.text} ${token(e)}${dose.protocol ? ` — ${dose.protocol}` : ""}`));
  });

  if (finisherPicks.length) {
    blocks.push(heading("⚡", "Finisher (For Time)"));
    blocks.push(para("3 rounds for time. Move well, keep breathing, stop if form breaks."));
    finisherPicks.forEach((e) => blocks.push(li(`12 reps ${token(e)}`)));
  }

  if (!isMicro) {
  blocks.push(heading("🧘", "Cool Down"));
  if (cooldownPicks.length >= 3) {
    cooldownPicks.forEach((e) => blocks.push(li(`45 sec ${token(e)} — breathe out into the position`)));
    blocks.push(li(COOLDOWN_FALLBACK[2]!));
  } else {
    COOLDOWN_FALLBACK.forEach((line) => blocks.push(li(line)));
  }
  }


  const seedWord = NAME_LEFT[(mainPicks[0]?.id.length ?? 3) % NAME_LEFT.length]!;
  const name = `${seedWord} ${NAME_RIGHT[input.category] ?? "Session"}`;

  return { html: blocks.join(para("")), name, blocks };
}

export function packCopy(input: PackInput): {
  description_html: string;
  instructions_html: string;
  tips_html: string;
} {
  return {
    description_html: para(
      `A ${input.level === "all" ? "mixed" : input.level} ${input.category.toLowerCase()} session built to your available equipment and today's time budget. Straightforward work, no wasted minutes.`,
    ),
    instructions_html: para(
      `Work through the sections in order: soft tissue, activation, main workout, finisher, cool down. Respect the prescribed dose before each exercise and keep the rest honest.`,
    ),
    tips_html: [
      para("Set up before you start so you are not hunting for equipment mid-session."),
      para("Quality of movement beats speed — slow down before technique breaks."),
      para("Stop and reassess if you feel sharp pain, dizziness or chest tightness."),
    ].join(""),
  };
}
