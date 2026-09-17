import type { Category, DifficultyLevel, EquipmentMode, Format, StrengthFocus } from "./spec.ts";
import {
  categoryExerciseViolation,
  dynamicExerciseViolation,
  focusRegion,
  humanRealismViolation,
  locationEquipmentViolation,

  focusViolation,
  microExerciseViolation,
  regionOf,
  HIGH_FATIGUE_CONDITIONING_RE,
  HIGH_IMPACT_RE,
  HOME_APPARATUS_RE,
  STATIC_HOLD_RE,
  STRETCH_RE,
  type BodyRegion,
} from "./doctrine.ts";
// ONE selection policy for the whole platform — see ../exercise-selection.ts
import {
  isSelectable,
  orderBySelectionPolicy,
  selectionTier,
} from "../exercise-selection.ts";

// STRETCH_RE stays exported from here for existing importers (enforcement).
export { STRETCH_RE };



export type PoolExercise = {
  id: string;
  name: string;
  body_part: string | null;
  target_muscle: string | null;
  secondary_muscles: string[] | null;
  equipment: string | null;
  category: string | null;
  difficulty: string | null;
  movement_pattern: string | null;
  body_region: string | null;
  gif_path: string | null;
  /** One-line technique cue built from the library description/instructions. */
  cue: string | null;
};

/**
 * Smarty Gym exercise library mapping. This project's `exercises` table uses
 * `target` and `gif_url` and has no `movement_pattern`, `body_region` or
 * `is_active` columns, so the rows are normalised into the doctrine shape.
 */
const SELECT =
  "id,name,body_part,target,secondary_muscles,equipment,category,difficulty,gif_url,description,instructions";

type LibraryRow = {
  id: string;
  name: string;
  body_part: string | null;
  target: string | null;
  secondary_muscles: string[] | null;
  equipment: string | null;
  category: string | null;
  difficulty: string | null;
  gif_url: string | null;
  description: string | null;
  instructions: string[] | null;
};

/** Shortest useful technique cue for the prompt: one sentence, never a paragraph. */
function buildCue(row: LibraryRow): string | null {
  const from = (row.instructions ?? []).find((s) => s && s.trim().length > 20)
    ?? (row.description ?? "").split(/(?<=\.)\s+/).find((s) => s.trim().length > 20);
  if (!from) return null;
  const cue = from.replace(/\s+/g, " ").trim();
  return cue.length > 120 ? `${cue.slice(0, 117)}...` : cue;
}

function toPoolExercise(row: LibraryRow): PoolExercise {
  return {
    id: row.id,
    name: row.name,
    body_part: row.body_part,
    target_muscle: row.target,
    secondary_muscles: row.secondary_muscles ?? [],
    equipment: row.equipment,
    category: row.category,
    difficulty: row.difficulty,
    movement_pattern: null,
    body_region: null,
    gif_path: row.gif_url,
    cue: buildCue(row),
  };
}


/** Loads the whole exercises table, paginated 1000 rows at a time. */
// deno-lint-ignore no-explicit-any
export async function loadAllExercises(supabase: any): Promise<PoolExercise[]> {
  const rows: PoolExercise[] = [];
  for (let page = 0; page < 10; page++) {
    const from = page * 1000;
    const { data, error } = await supabase
      .from("exercises")
      .select(SELECT)
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    const batch = ((data ?? []) as LibraryRow[]).map(toPoolExercise);
    rows.push(...batch);
    if (batch.length < 1000) break;
  }
  return rows;
}

const text = (e: PoolExercise) =>
  `${e.name} ${e.target_muscle ?? ""} ${e.body_part ?? ""} ${e.category ?? ""} ${e.equipment ?? ""}`.toLowerCase();

// All category vocabulary bans, focus legality, static-hold and home-apparatus
// rules live in ./doctrine so the pool filter, the enforcement pass, the
// validator and the tests read one definition. Nothing is duplicated here.


export type PoolFilter = {
  category: Category;
  equipmentMode: EquipmentMode;
  /** Today's format — needed for the dynamic-format equipment doctrine. */
  format?: Format | null;


  selectedEquipment: string[];
  customEquipment?: string[];
  level: DifficultyLevel;
  focus?: StrengthFocus | null;
  /** Library ids the athlete banned — removed before the model sees anything. */
  dislikedIds?: string[];
  /** Library ids the athlete loves — kept in the sample and surfaced to the model. */
  favoriteIds?: string[];
  /** Free-text movements the athlete asked to avoid in today's note. */
  bannedTerms?: string[];
  /** Where the athlete trains today — filters impractical apparatus / impact. */
  location?: string | null;
  /** Athlete age — past 70 impact work leaves the vocabulary entirely. */
  age?: number | null;
};

const NOTE_STOPWORDS = new Set([
  "the","a","an","any","my","me","to","do","doing","today","please","really","much","some",
  "and","or","of","for","with","that","this","them","it","at","all","too","very","exercise",
  "exercises","movement","movements","work","workout","today's","want","like","likes","dislike",
  "dislikes","prefer","more","less","not","no","dont","don","t",
]);

/**
 * Pulls the movements an athlete asked to avoid out of their free-text note
 * ("no burpees", "avoid bicep curls", "without jumping") so the engine can
 * remove them from the vocabulary instead of hoping the model complies.
 */
export function parseNoteExclusions(note: string): string[] {
  const terms: string[] = [];
  const re =
    /\b(?:no|not|avoid|without|skip|hate|hates|exclude|except)\b\s+([a-z\s-]{3,40})|\b(?:i\s+)?(?:don'?t|do not|dont)\s+(?:like|want|do)\s+([a-z\s-]{3,40})/gi;
  for (const m of note.toLowerCase().matchAll(re)) {
    const phrase = (m[1] ?? m[2] ?? "")
      .split(/\b(?:but|and then|because|please|,|\.|;)\b/)[0]!
      .trim();
    for (const word of phrase.split(/\s+/).slice(0, 3)) {
      const w = word.replace(/[^a-z-]/g, "");
      if (w.length > 3 && !NOTE_STOPWORDS.has(w)) terms.push(w.replace(/s$/, ""));
    }
  }
  return [...new Set(terms)].slice(0, 12);
}



/** Apparatus and impact that do not exist in a living room or hotel room. */
const SMALL_SPACE_BAN_RE =
  /\b(sled|treadmill|elliptical|stepmill|ergometer|rowing machine|skierg|stationary bike|smith|leverage|cable|machine|rope climb|prowler|tire|sprint|shuttle run|running)\b/i;

const HOTEL_BAN_RE =
  /\b(jump|jumping|plyo|box jump|burpee|hop|bound|slam|sprint|clean|snatch|jerk|drop)\b/i;

const OUTDOOR_BAN_RE =
  /\b(machine|cable|smith|leverage|treadmill|elliptical|stepmill|ergometer|rowing machine|skierg|stationary bike|lat pulldown|pec deck|leg press|leg extension|leg curl machine)\b/i;

/**
 * Keeps only what the athlete can realistically do at today's location.
 * HARD filter: forbidden apparatus is never restored to reach an exercise
 * count — a smaller legal pool is always preferred to an illegal one.
 * "Anywhere" is a real constraint, not a blank cheque: it means a session the
 * athlete can run wherever they are, so fixed gym stations are removed too.
 */
export function filterByLocation(pool: PoolExercise[], location?: string | null): PoolExercise[] {
  const l = (location ?? "").toLowerCase();
  if (l === "home") return pool.filter((e) => !SMALL_SPACE_BAN_RE.test(text(e)));
  if (l === "hotel")
    return pool.filter((e) => !SMALL_SPACE_BAN_RE.test(text(e)) && !HOTEL_BAN_RE.test(text(e)));
  if (l === "outdoors")
    return pool.filter(
      (e) => !OUTDOOR_BAN_RE.test(text(e)) && !locationEquipmentViolation(e, "outdoors"),
    );
  if (l === "anywhere")
    return pool.filter(
      (e) => !OUTDOOR_BAN_RE.test(text(e)) && !locationEquipmentViolation(e, "anywhere"),
    );

  return pool;
}



const isBodyweight = (e: PoolExercise) => (e.equipment ?? "").toLowerCase().includes("body weight");

const EQUIPMENT_LABELS: Record<string, string[]> = {
  // Bodyweight covers the simple props a living room already has.
  bodyweight: ["body weight", "bodyweight", "weighted", "stability ball", "bosu ball", "roller"],
  dumbbells: ["dumbbell", "medicine ball"],
  kettlebells: ["kettlebell"],
  barbell: ["barbell", "ez barbell", "olympic barbell", "trap bar", "weight plate", "hammer"],
  bands: ["band", "resistance band", "elastic band", "rope"],
  trx: ["assisted", "suspension", "trx"],
  machines: [
    "cable",
    "leverage machine",
    "smith machine",
    "elliptical machine",
    "skierg machine",
    "sled machine",
    "stationary bike",
    "stepmill machine",
    "upper body ergometer",
  ],
};

/** Library equipment strings that carry no apparatus of their own. */
const NEUTRAL_EQUIPMENT = new Set(["", "none", "n/a", "no equipment", "mat", "pilates mat"]);

/**
 * Requires every apparatus named by the library row to be explicitly selected.
 * Combined values ("dumbbell, bench", "barbell / rack") are split so a row is
 * legal when EVERY listed apparatus is covered by the athlete's selection.
 */
export function matchesSelectedEquipment(
  e: PoolExercise,
  selected: string[],
  custom: string[] = [],
): boolean {
  if (selected.includes("fullgym")) return true;
  const raw = (e.equipment ?? "").toLowerCase().trim();
  if (!raw) return false;
  if (NEUTRAL_EQUIPMENT.has(raw)) return selected.includes("bodyweight");

  const labels = selected.flatMap((id) => EQUIPMENT_LABELS[id] ?? []);
  const customTerms = selected.includes("other") ? custom.filter((t) => t.length > 2) : [];

  const parts = raw
    .split(/\s*(?:,|\/|\+|\band\b)\s*/)
    .map((p) => p.replace(/\(.*?\)/g, "").trim())
    .filter(Boolean);
  const pieces = parts.length ? parts : [raw];

  return pieces.every((piece) => {
    if (NEUTRAL_EQUIPMENT.has(piece)) return true;
    if (labels.some((label) => piece === label || piece.startsWith(`${label} `) || piece.includes(label)))
      return true;
    return customTerms.some((term) => piece.includes(term) || term.includes(piece));
  });
}


/** Keeps only the free-text apparatus that really exists in the exercise library. */
export function resolveCustomEquipment(all: PoolExercise[], raw: string): string[] {
  const terms = raw
    .toLowerCase()
    .split(/[,;\n]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2);
  if (!terms.length) return [];
  const labels = new Set(all.map((e) => (e.equipment ?? "").toLowerCase().trim()).filter(Boolean));
  return terms.filter((t) => [...labels].some((l) => l.includes(t) || t.includes(l)));
}

/**
 * Applies the documented filter order: category ban -> equipment -> difficulty
 * -> guardrails. The result is the only vocabulary the model ever sees.
 *
 * Difficulty widening (§16) is judged on the FINAL pool, not on the difficulty
 * step alone: an advanced tier that looks big enough before the format and
 * focus filters can still collapse below a workable session afterwards. In
 * that case the tier is refilled from EASIER material only — never harder.
 */
export function filterPool(all: PoolExercise[], f: PoolFilter): PoolExercise[] {
  const strict = filterPoolAtLevel(all, f);
  if (strict.length >= 12 || f.level === "all") return strict;
  const easier: DifficultyLevel[] =
    f.level === "advanced" ? ["intermediate", "beginner"] : f.level === "intermediate" ? ["beginner"] : [];
  if (!easier.length) return strict;
  const seen = new Set(strict.map((e) => e.id));
  const widened = strict.slice();
  for (const lvl of easier) {
    for (const e of filterPoolAtLevel(all, { ...f, level: lvl })) {
      if (!seen.has(e.id)) {
        seen.add(e.id);
        widened.push(e);
      }
    }
    if (widened.length >= 12) break;
  }
  return widened;
}

function filterPoolAtLevel(all: PoolExercise[], f: PoolFilter): PoolExercise[] {
  let pool = all.slice();


  // 0. HUMAN REALISM — before anything else. Circus gymnastics, levers,
  //    Turkish get-ups, pistol squats and technical Olympic lifting are never
  //    handed to a normal adult client, in any category or format.
  pool = pool.filter((e) => !humanRealismViolation(e));

  // 1. Category vocabulary legality (doctrine §3/§7/§8/§14) — one definition,
  //    applied before anything else.
  pool = pool.filter((e) => !categoryExerciseViolation(e, f.category));

  // MICRO WORKOUT: hard equipment-free rule. Bodyweight and everyday indoor
  // environment only (floor, wall, chair, desk, sofa) — never training
  // apparatus. The athlete's normal equipment preferences do not apply here.
  const isMicro = f.category === "MICRO-WORKOUTS";
  if (isMicro) pool = pool.filter((e) => isBodyweight(e) && !microExerciseViolation(e));


  // 2. Exact equipment allowlist. Never widen a user's choices to all equipment.
  if (!isMicro) {
    pool = pool.filter((e) =>
      matchesSelectedEquipment(e, f.selectedEquipment, f.customEquipment ?? []),
    );
    if (f.equipmentMode === "BODYWEIGHT")
      pool = pool.filter((e) => isBodyweight(e) && !HOME_APPARATUS_RE.test(text(e)));
  }

  // 2b. CATEGORY + FORMAT equipment legality (doctrine §10-§13, §24). Selected
  //     equipment is not enough: a dynamic conditioning format may never carry
  //     barbell, rack, bench, cable, Smith or selectorized machine work.
  if (f.format)
    pool = pool.filter((e) => !dynamicExerciseViolation(e, f.category, f.format!));

  // 3. Difficulty (§16). The requested tier is programmed as-is. A thin tier is
  //    only ever filled from EASIER material: Beginner never inherits Advanced
  //    or Intermediate movements, Intermediate may borrow Beginner variations
  //    and Advanced may borrow Intermediate ones. Difficulty is expressed as
  //    variation complexity, volume and loading — never as harder vocabulary
  //    handed to an athlete who did not ask for it.
  if (f.level !== "all") {
    const at = (lvl: string) => pool.filter((e) => (e.difficulty ?? "").toLowerCase() === lvl);
    const strict = at(f.level);
    const easier: string[] =
      f.level === "advanced" ? ["intermediate", "beginner"] : f.level === "intermediate" ? ["beginner"] : [];
    if (strict.length >= 12 || !easier.length) {
      if (strict.length) pool = strict;
    } else {
      const widened = [...strict, ...easier.flatMap(at)];
      if (widened.length) pool = widened;
    }
  }

  // 3b. CARDIO stays aerobic (§4). High-fatigue conditioning vocabulary is
  //     legal but never dominant: the pool keeps a small minority of it so the
  //     session is built from repeatable aerobic work.
  if (f.category === "CARDIO") {
    const hot = pool.filter((e) => HIGH_FATIGUE_CONDITIONING_RE.test(e.name));
    const rest = pool.filter((e) => !HIGH_FATIGUE_CONDITIONING_RE.test(e.name));
    if (rest.length >= 12)
      pool = [...rest, ...hot.slice(0, Math.max(1, Math.ceil(rest.length * 0.05)))];
  }

  // 4. Static-hold guardrail for momentum / conditioning categories.
  const momentum: Category[] = ["CARDIO", "CALORIE BURNING", "METABOLIC", "CHALLENGE"];
  if (momentum.includes(f.category)) pool = pool.filter((e) => !STATIC_HOLD_RE.test(e.name));

  // 5. Body focus (§15) — a HARD filter for EVERY category that carries one.
  //    The focus is never dropped. When a narrow focus (e.g. SHOULDERS) leaves
  //    too little vocabulary to build a real session, it is widened ONLY to the
  //    same body region (upper / lower / core) so the session still trains what
  //    the athlete asked for, with neighbouring support work allowed.
  if (f.focus) {
    const strictFocus = pool.filter((e) => !focusViolation(e, f.focus!));
    if (strictFocus.length >= 10) {
      pool = strictFocus;
    } else {
      const region = focusRegion(f.focus);
      const regional =
        region === "full"
          ? pool
          : pool.filter((e) => {
              const r = regionOf(e);
              return r === region || r === "full";
            });
      const widened = [
        ...strictFocus,
        ...regional.filter((e) => !strictFocus.some((s) => s.id === e.id)),
      ];
      pool = widened.length >= strictFocus.length ? widened : strictFocus;
    }
  }




  // 6. Hard ban: exercises the athlete picked as dislikes, plus their variations.
  if (f.dislikedIds?.length) {
    const banned = new Set(f.dislikedIds);
    const stems = new Set(
      all.filter((e) => banned.has(e.id)).map((e) => nameStem(e.name)).filter((s) => s.length > 3),
    );
    pool = pool.filter((e) => !banned.has(e.id) && !stems.has(nameStem(e.name)));
  }

  // 6b. Location practicality — no machines in a hotel room, no jumping upstairs.
  pool = filterByLocation(pool, f.location);

  // 6c. Biometrics — past 70 impact work leaves the vocabulary entirely rather
  //     than relying on the model to avoid it.
  if (typeof f.age === "number" && f.age >= 70) {
    const impactFree = pool.filter((e) => !HIGH_IMPACT_RE.test(e.name));
    if (impactFree.length >= 12) pool = impactFree;
  }

  // 7. Hard ban from today's note ("no burpees", "avoid bicep curls").
  if (f.bannedTerms?.length) {
    pool = pool.filter((e) => !f.bannedTerms!.some((t) => text(e).includes(t)));
  }

  // 7b. Coach's permanent bans — e.g. loaded squats/presses on a bosu.
  pool = pool.filter((e) => isSelectable(e.name));





  return pool;
}

/** "barbell full squat" -> "squat": the last two words carry the movement. */
export function nameStem(name: string): string {
  const words = name.toLowerCase().replace(/[^a-z\s-]/g, "").split(/\s+/).filter(Boolean);
  return words.slice(-2).join(" ");
}

// ---------------------------------------------------------------------------
// Preparation pools — Activation and Cool Down always come from the library so
// every section is playable (each line carries an {{exercise:}} token).
// ---------------------------------------------------------------------------

/** Movement-prep vocabulary: dynamic mobility, activation and patterning. */
export const ACTIVATION_OK_RE =
  /\b(bridge|bird dog|dead bug|clamshell|circle|circles|leg swing|swing leg|march|walkout|inchworm|cat|scapular|wall slide|pull-?apart|hip opener|ankle|good morning|dynamic|rotation|twist|reach|crawl|glute|abduction|adduction|shoulder|hip|thoracic|lunge|squat|stretch|mobility|activation|band)\b/i;

/** Never movement prep — load, impact, skill or maximal strength. */
export const PREP_BAN_RE =
  /\b(barbell|dumbbell|kettlebell|machine|cable|smith|ez[\s-]?bar|olympic|sled|weighted|leverage|trap bar|hammer|deadlift|bench press|back squat|front squat|overhead press|push press|clean|snatch|jerk|thruster|push-?up|pushup|pull-?up|chin-?up|muscle-?up|burpee|box jump|jump|jumping|sprint|dip|plyo|planche|nordic|pistol|archer|one-?arm|one arm|single-?arm|single arm|lever|flag|handstand|hand stand|sit-?up|crunch)\b/i;

/** Static flexibility and breathing vocabulary for the Cool Down. */
export const COOLDOWN_OK_RE =
  /\b(stretch|stretching|cat-?cow|cobra|sphinx|child'?s pose|pigeon|butterfly|seated|supine|lying|standing|forward bend|split|straddle|twist|breathing|hang)\b/i;

const isBand = (e: PoolExercise) => (e.equipment ?? "").toLowerCase().includes("band");

/** Prep sections may always use bodyweight; bands only when the athlete has them. */
function prepEquipmentOk(e: PoolExercise, selectedEquipment: string[]): boolean {
  if (isBodyweight(e)) return true;
  return isBand(e) && selectedEquipment.includes("bands");
}

function prepFilter(
  all: PoolExercise[],
  selectedEquipment: string[],
  dislikedIds: string[],
  match: RegExp,
  strict: boolean,
): PoolExercise[] {
  const banned = new Set(dislikedIds);
  return all.filter((e) => {
    if (banned.has(e.id)) return false;
    if (!prepEquipmentOk(e, selectedEquipment)) return false;
    if (PREP_BAN_RE.test(text(e))) return false;
    if (HOME_APPARATUS_RE.test(text(e))) return false;
    if ((e.difficulty ?? "").toLowerCase() === "advanced") return false;
    if (strict && !match.test(e.name)) return false;
    return true;
  });
}

/**
 * The only vocabulary allowed in 🔥 Activation. Built from the whole library,
 * independent of the session pool, so the section is never empty.
 *
 * Doctrine 14: activation prepares the ACTUAL demand of the Main Workout. When
 * a focus (or an explicit region) is known, the pool is biased to that region
 * so a lower-body strength day never opens with arm-band drills.
 */
export function buildActivationPool(
  all: PoolExercise[],
  opts: {
    selectedEquipment: string[];
    dislikedIds?: string[];
    focus?: StrengthFocus | null;
    region?: BodyRegion;
  },
): PoolExercise[] {
  const disliked = opts.dislikedIds ?? [];
  const strict = prepFilter(all, opts.selectedEquipment, disliked, ACTIVATION_OK_RE, true);
  const base =
    strict.length >= 8
      ? strict
      : prepFilter(all, opts.selectedEquipment, disliked, ACTIVATION_OK_RE, false);

  const region = opts.region ?? focusRegion(opts.focus ?? null);
  if (region === "full") return base;
  const relevant = base.filter((e) => {
    const r = regionOf(e);
    return r === region || r === "full" || (region === "lower" && r === "core");
  });
  return relevant.length >= 6 ? relevant : base;
}


/** The only vocabulary allowed in 🧘 Cool Down: static stretches and breathing. */
export function buildCooldownPool(
  all: PoolExercise[],
  opts: { selectedEquipment: string[]; dislikedIds?: string[] },
): PoolExercise[] {
  const disliked = opts.dislikedIds ?? [];
  const strict = prepFilter(all, opts.selectedEquipment, disliked, COOLDOWN_OK_RE, true).filter(
    (e) => STRETCH_RE.test(e.name) || COOLDOWN_OK_RE.test(e.name),
  );
  if (strict.length >= 6) return strict;
  return prepFilter(all, opts.selectedEquipment, disliked, COOLDOWN_OK_RE, false);
}

/** Deterministic, rotating selection so two sessions rarely open the same way. */
export function pickPrep(pool: PoolExercise[], count: number, seed: number): PoolExercise[] {
  if (!pool.length) return [];
  const byPart = new Map<string, PoolExercise[]>();
  for (const e of pool) {
    const key = e.body_part ?? "other";
    if (!byPart.has(key)) byPart.set(key, []);
    byPart.get(key)!.push(e);
  }
  const parts = [...byPart.keys()];
  const out: PoolExercise[] = [];
  let s = Math.abs(seed) || 7;
  let guard = 0;
  while (out.length < count && guard < count * 20) {
    guard += 1;
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const part = parts[s % parts.length]!;
    const list = byPart.get(part)!;
    if (!list.length) {
      if (parts.every((p) => !byPart.get(p)!.length)) break;
      continue;
    }
    const next = list.splice(s % list.length, 1)[0]!;
    if (!out.some((e) => e.id === next.id)) out.push(next);
  }
  return out;
}


function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Balanced sample so every body part is represented in the prompt vocabulary.
 * Favourite ids are always carried through, whatever the sample size, and the
 * coach's PRIORITY vocabulary is sorted to the front of every body part so the
 * model sees the preferred stations and movements first.
 */
export function samplePool(
  pool: PoolExercise[],
  max = 260,
  favoriteIds: string[] = [],
  recentIds: string[] = [],
  category?: string | null,
): PoolExercise[] {
  if (recentIds.length && pool.length > max) {
    const recent = new Set(recentIds);
    const fresh = pool.filter((e) => !recent.has(e.id) || favoriteIds.includes(e.id));
    if (fresh.length >= Math.max(60, Math.floor(max * 0.6))) pool = fresh;
  }
  if (pool.length <= max) return pool;
  const favourites = favoriteIds.length
    ? pool.filter((e) => favoriteIds.includes(e.id))
    : [];
  const rest = pool.filter((e) => !favourites.includes(e));
  const byPart = new Map<string, PoolExercise[]>();
  for (const e of rest) {
    const key = e.body_part ?? "other";
    if (!byPart.has(key)) byPart.set(key, []);
    byPart.get(key)!.push(e);
  }
  const budget = Math.max(0, max - favourites.length);
  const per = Math.max(8, Math.ceil(budget / Math.max(1, byPart.size)));
  const out: PoolExercise[] = [];
  // Shared selection policy: reference-list movements first, simplest variation
  // of each movement first, never-promoted equipment last.
  const rank = (e: PoolExercise) => 3 - selectionTier(e.name, category);
  for (const list of byPart.values()) {
    out.push(...orderBySelectionPolicy(shuffle(list), category).slice(0, per));
  }

  const sampled = shuffle(out).slice(0, budget);
  sampled.sort((a, b) => rank(b) - rank(a));
  return [...favourites, ...sampled];
}
