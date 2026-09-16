import { buildWorkoutPrompt, type AthleteContext } from "./prompt.server.ts";
import { enforceWorkout, estimateWorkMinutes } from "./enforce.server.ts";
import { validateWorkout } from "./validate.server.ts";
import { classifyIssues, classifyIssuesForFallback } from "./workout-validation.ts";
import { buildPackWorkout, packCopy } from "./pack.server.ts";
import { buildSessionPlan, scoreWorkout } from "./programming.ts";
import { parseWorkoutSteps } from "./parse-steps.ts";
import { dominantRegion, focusRegion, resolveLocation } from "./doctrine.ts";

import {
  buildActivationPool,
  buildCooldownPool,
  filterPool,
  parseNoteExclusions,

  loadAllExercises,
  resolveCustomEquipment,
  samplePool,
  type PoolExercise,
} from "./pool.server.ts";

import {
  BANNED_NAME_WORDS,
  CATEGORY_FORMATS,
  starsToLevel,
  type Category,
  type EquipmentMode,
  type Format,
  type StrengthFocus,
} from "./spec.ts";

const MODELS = ["google/gemini-3.1-pro-preview", "google/gemini-3.8-flash"];

export type GenerateInput = {
  category: Category;
  format?: Format | null;
  equipmentMode: EquipmentMode;
  customEquipment?: string[];
  customEquipmentRaw?: string;
  selectedEquipment: string[];
  stars: number;
  minutes: number;
  focus?: StrengthFocus | null;
  note?: string;
  location?: string;
  mood?: string;
  /** Library ids picked as favourites / dislikes in the training profile. */
  favoriteIds?: string[];
  dislikedIds?: string[];
  /** Library ids programmed in the athlete's last few sessions — used for variety. */
  recentIds?: string[];

  athlete?: AthleteContext;
};

export type GeneratedWorkout = {
  name: string;
  description_html: string;
  main_workout: string;
  instructions_html: string;
  tips_html: string;
  warnings: string[];
  needs_review: boolean;
};

function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

export function pickFormat(category: Category, requested?: Format | null): Format {
  const allowed = CATEGORY_FORMATS[category];
  if (requested && allowed.includes(requested)) return requested;
  return allowed[Math.floor(Math.random() * allowed.length)]!;
}

const ROMAN_RE = /^(?:i{1,3}|iv|vi{0,3}|ix|xi{0,2})$/i;
const CODE_RE = /\b[A-Z]{2,4}[-\s]?\d+\b/;

export function isValidName(name: string, used: string[]): boolean {
  const trimmed = name.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 4) return false;
  if (/\d/.test(trimmed)) return false;
  if (CODE_RE.test(trimmed)) return false;
  if (words.some((w) => ROMAN_RE.test(w))) return false;
  const lower = trimmed.toLowerCase();
  if (BANNED_NAME_WORDS.some((w) => lower.includes(w))) return false;
  if (used.some((u) => u.toLowerCase() === lower)) return false;
  return true;
}

function extractJson(text: string): Record<string, unknown> {
  let raw = text.trim();
  raw = raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Smarty Coach returned an unreadable workout.");
  return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
}

/**
 * Lovable AI Gateway call. Kept deliberately simple (plain fetch) so the
 * engine runs unchanged inside a Deno edge function.
 */
async function askModel(system: string, user: string): Promise<Record<string, unknown>> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("AI is not configured.");
  let res: Response | null = null;
  for (const model of MODELS) {
    res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      service_tier: "priority",
      temperature: 0.85,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    });
    // Only an unknown/unavailable model justifies trying the next one.
    if (res.ok || (res.status !== 400 && res.status !== 404)) break;
  }
  if (!res || !res.ok) {
    const body = res ? await res.text() : "no response";
    throw new Error(`AI gateway ${res?.status ?? 0}: ${body.slice(0, 300)}`);
  }
  const json = await res.json();
  const text = String(json?.choices?.[0]?.message?.content ?? "");
  return extractJson(text);
}

export async function generateWorkoutContent(
  supabase: Parameters<typeof loadAllExercises>[0],
  input: GenerateInput,
  usedNames: string[],
): Promise<GeneratedWorkout & { format: Format; pool: PoolExercise[]; duration: string }> {
  const level = starsToLevel(input.stars);
  const format = pickFormat(input.category, input.format ?? null);
  const all = await loadAllExercises(supabase);
  const customEquipment = input.customEquipmentRaw
    ? resolveCustomEquipment(all, input.customEquipmentRaw)
    : (input.customEquipment ?? []);
  const favoriteIds = input.favoriteIds ?? [];
  const dislikedIds = input.dislikedIds ?? [];
  const bannedTerms = input.note ? parseNoteExclusions(input.note) : [];
  // §18 — "Anywhere" is a real practicality filter (portable equipment only),
  // unless the athlete explicitly ticked fixed-station gym equipment.
  const location = resolveLocation(input.location ?? null, input.selectedEquipment);
  const pool = filterPool(all, {
    category: input.category,
    format,
    equipmentMode: input.equipmentMode,
    selectedEquipment: input.selectedEquipment,
    customEquipment,
    level,
    focus: input.focus ?? null,
    dislikedIds,
    favoriteIds,
    bannedTerms,
    location,
    age: input.athlete?.age ?? null,
  });


  if (pool.length < 12) {
    throw new Error("Not enough exercises match those settings. Try different equipment.");
  }

  const duration = durationLabel(input.minutes);
  const recentIds = input.recentIds ?? [];
  const promptPool = samplePool(pool, 260, favoriteIds, recentIds);

  const plan = buildSessionPlan({
    category: input.category,
    format,
    level,
    stars: input.stars,
    minutes: input.minutes,
    mood: input.mood ?? null,
    location: input.location ?? null,
    focus: input.focus ?? null,
    equipmentCount: Math.max(1, input.selectedEquipment.length),
  });

  // Activation and Cool Down get their own library-backed vocabulary so both
  // sections always carry real exercise links and show up in the player.
  // §21 — activation vocabulary is narrowed to the demand of the work that is
  // about to be programmed: the focus when one was chosen, otherwise the
  // dominant region of the approved session pool.
  // Fix 3 — activation must prepare what the Main Workout actually trains:
  // the focus region when one was chosen, otherwise the dominant body region /
  // movement pattern of the exercises this session may actually draw from.
  const focusReg = focusRegion(input.focus ?? null);
  const activationRegion = focusReg === "full" ? dominantRegion(pool) : focusReg;
  const activationPool = buildActivationPool(all, {
    selectedEquipment: input.selectedEquipment,
    dislikedIds,
    focus: input.focus ?? null,
    region: activationRegion,
  });


  const cooldownPool = buildCooldownPool(all, {
    selectedEquipment: input.selectedEquipment,
    dislikedIds,
  });
  const prepIds = [...activationPool.map((e) => e.id), ...cooldownPool.map((e) => e.id)];
  const seed = `${input.category}${input.minutes}${pool.length}`.length + Date.now() % 100000;

  // Smarty Gym has no admin-editable extra coach rules; the doctrine is the rule book.
  const extraRules = "";

  const enforceOpts = {
    category: input.category,
    format,
    level,
    targetMinutes: input.minutes,
    activationPool,
    cooldownPool,
    seed,
    requireFinisher: Boolean(plan.finisher),
    finisherMin: Math.max(1, plan.finisherCount[0]),
    requireActivation: plan.activationCount > 0,
    requireCooldown: plan.cooldownCount > 0,
    mainMin: plan.mainCount[0],
  };


  const validateOpts = {
    library: all,
    pool,
    category: input.category,
    format,
    level,
    targetMinutes: input.minutes,
    equipmentMode: input.equipmentMode,
    selectedEquipment: input.selectedEquipment,
    customEquipment,
    focus: input.focus ?? null,
    dislikedIds,
    location,
    mood: input.mood ?? null,
    age: input.athlete?.age ?? null,



    prepIds,
    requireFinisher: Boolean(plan.finisher),
    finisherMin: Math.max(1, plan.finisherCount[0]),
    requireActivation: plan.activationCount > 0,
    requireCooldown: plan.cooldownCount > 0,
    mainMin: plan.mainCount[0],
  };



  const fallbackName = () =>
    `${input.category.split(" ")[0]!.toLowerCase()} ${level} session`.replace(/\b\w/g, (c) =>
      c.toUpperCase(),
    );

  const libraryById = new Map(all.map((e) => [e.id, e]));
  type Candidate = GeneratedWorkout & { score: number };
  let best: Candidate | null = null;
  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    let payload: Record<string, unknown>;
    try {
      const { system, user } = buildWorkoutPrompt({
        category: input.category,
        format,
        equipmentMode: input.equipmentMode,
        selectedEquipment: input.selectedEquipment,
        ...(customEquipment.length ? { customEquipment } : {}),
        level,
        stars: input.stars,
        duration,
        focus: input.focus ?? null,
        ...(input.note ? { note: input.note } : {}),
        ...(input.athlete ? { athlete: input.athlete } : {}),
        pool: promptPool,
        activationPool,
        cooldownPool,
        bannedNames: usedNames,
        plan,
      });

      payload = await askModel(
        extraRules ? `${system}\n\nADDITIONAL COACH RULES (highest priority)\n${extraRules}` : system,
        attempt === 0
          ? user
          : `${user}\n\nPREVIOUS ATTEMPT REJECTED: ${lastError}\nFix it and return valid JSON.`,
      );
    } catch (err) {
      lastError = err instanceof Error ? err.message : "model call failed";
      continue;
    }

    const html = String(payload["main_workout"] ?? "");
    const enforced = enforceWorkout(html, pool, enforceOpts);

    // Only structural faults block delivery — drift becomes a caution note.
    const enforcedSplit = classifyIssues(enforced.errors);
    if (enforcedSplit.structural.length) {
      lastError = enforcedSplit.structural.join(" ");
      continue;
    }

    // Deterministic validation — the last word on ids, equipment and dosing.
    const validated = validateWorkout(enforced.html, validateOpts);
    const validatedSplit = classifyIssues(validated.errors);
    if (validatedSplit.structural.length) {
      lastError = validatedSplit.structural.slice(0, 6).join(" ");
      continue;
    }

    let name = String(payload["name"] ?? "").trim();
    const warnings = [
      ...enforced.warnings,
      ...validated.warnings,
      ...enforcedSplit.soft,
      ...validatedSplit.soft,
    ];
    if (!isValidName(name, usedNames)) {
      name = fallbackName();
      warnings.push("Workout name was replaced by a compliant fallback.");
    }

    // Deterministic quality score — the coaching standard, not just legality.
    const quality = scoreWorkout(parseWorkoutSteps(enforced.html), plan, {
      library: libraryById,
      favoriteIds,
      dislikedIds,
      recentIds,
      estimatedMinutes: estimateWorkMinutes(enforced.html),
    });

    const candidate: Candidate = {
      name,
      description_html: String(payload["description"] ?? ""),
      main_workout: enforced.html,
      instructions_html: String(payload["instructions"] ?? ""),
      tips_html: String(payload["tips"] ?? ""),
      warnings: [...warnings, ...(quality.score < 85 ? quality.issues : [])],
      needs_review: warnings.length > 0 || quality.score < 75,
      score: quality.score,
    };
    if (!best || candidate.score > best.score) best = candidate;

    if (candidate.score < 80 && attempt < 2) {
      lastError = `Session quality ${candidate.score}/100. Fix: ${quality.issues.slice(0, 4).join(" ")}`;
      continue;
    }

    return { ...best, format, pool, duration };
  }

  if (best) return { ...best, format, pool, duration };

  // ---- Reliability fallback: deterministic template engine ---------------------
  const pack = buildPackWorkout(pool, all, {
    category: input.category,
    format,
    level,
    minutes: input.minutes,
    focus: input.focus ?? null,
    favoriteIds,
    activationPool,
    cooldownPool,
    seed,
  });
  const enforcedPack = enforceWorkout(pack.html, pool, enforceOpts);

  const packValidation = validateWorkout(enforcedPack.html, validateOpts);
  const packSplit = classifyIssuesForFallback([
    ...enforcedPack.errors,
    ...packValidation.errors,
  ]);
  if (packSplit.structural.length) {
    console.error("[create-custom-workout] pack structural failure", {
      poolSize: pool.length,
      activationPool: activationPool.length,
      cooldownPool: cooldownPool.length,
      structural: packSplit.structural,
      lastError,
    });
    throw new Error(
      `Smarty Coach could not build a compliant workout (${lastError}). Please try again.`,
    );
  }

  const copy = packCopy({
    category: input.category,
    format,
    level,
    minutes: input.minutes,
    focus: input.focus ?? null,
  });
  const name = isValidName(pack.name, usedNames) ? pack.name : fallbackName();

  return {
    name,
    ...copy,
    main_workout: enforcedPack.html,
    warnings: [
      `Built by the template engine after the AI attempts failed (${lastError}).`,
      ...enforcedPack.warnings,
      ...packValidation.warnings,
      ...packSplit.soft,
    ],
    needs_review: true,
    format,
    pool,
    duration,
  };
}


export { estimateWorkMinutes };
