// Deterministic compliance auditor for EXISTING library workouts.
//
// It does NOT introduce any new rule. Every check below calls the same
// doctrine / selection / timing helpers the generators use, so a stored
// workout is judged by exactly today's rules.
import { findTokens, stripHtml } from "./tokens.ts";
import { parseWorkoutSteps } from "./parse-steps.ts";
import { estimateWorkMinutes, estimateSessionMinutes } from "./enforce.server.ts";
import { nameStem, type PoolExercise } from "./pool.server.ts";
import {
  cardioDominanceViolation,
  categoryAllowsFinisher,
  categoryExerciseViolation,
  categoryFormatViolation,
  durationOverflowViolation,
  durationShortfallViolation,
  dynamicExerciseViolation,
  equipmentFamilyViolation,
  focusViolation,
  humanRealismViolation,
  isRepsAndSetsOnly,
  microExerciseViolation,
  sequenceViolation,
  sessionOverflowViolation,
  workSlotPrepViolation,
} from "./doctrine.ts";
import { isSelectable, matchesCategoryPool } from "../exercise-selection.ts";
import {
  CATEGORIES,
  CATEGORY_FORMATS,
  FORMATS,
  STRENGTH_FOCUS,
  minimumWorkMinutes,
  starsToLevel,
  type Category,
  type Format,
  type StrengthFocus,
} from "./spec.ts";

export type WorkoutRow = {
  id: string;
  name: string | null;
  category: string | null;
  format: string | null;
  difficulty_stars: number | null;
  equipment: string | null;
  duration: string | null;
  focus: string | null;
  main_workout: string | null;
};

export type Issue = { code: string; severity: "error" | "warning"; message: string; section?: string };

export type AuditRow = {
  workout_id: string;
  name: string;
  category: string;
  format: string | null;
  status: "pass" | "warn" | "fail";
  repair_tier: 0 | 1 | 2 | 3;
  errors: Issue[];
  warnings: Issue[];
  work_minutes: number;
  session_minutes: number;
  target_minutes: number | null;
};

/** Auto-fixable without AI: metadata / formatting / linking only. */
const AUTO_CODES = new Set([
  "NAME_MISMATCH",
  "SOFT_TISSUE_TOKENS",
  "FORMAT_ILLEGAL",
  "MISSING_WRAPPER",
  "MISSING_SECTION",
]);

export function normalizeCategory(raw: string | null): Category | null {
  const upper = String(raw ?? "").toUpperCase().trim();
  if ((CATEGORIES as readonly string[]).includes(upper)) return upper as Category;
  if (upper.includes("MICRO")) return "MICRO-WORKOUTS";
  if (upper.includes("MOBILITY")) return "MOBILITY & STABILITY";
  if (upper.includes("HYPERTROPH") || upper.includes("MUSCLE")) return "MUSCLE BUILDING";
  if (upper.includes("CALORIE")) return "CALORIE BURNING";
  return null;
}

export function normalizeFormat(raw: string | null): Format | null {
  const upper = String(raw ?? "").toUpperCase().replace(/&AMP;/g, "&").replace(/\s+/g, " ").trim();
  if (!upper) return null;
  if ((FORMATS as readonly string[]).includes(upper)) return upper as Format;
  if (upper.includes("REPS")) return "REPS & SETS";
  if (upper.includes("TIME")) return "FOR TIME";
  return null;
}

export function parseTargetMinutes(raw: string | null): number | null {
  const text = String(raw ?? "").toLowerCase();
  if (!text || text.includes("various")) return null;
  const hours = text.match(/(\d+)\s*h/);
  const mins = text.match(/(\d+)\s*(?:m|min)/);
  let total = 0;
  if (hours) total += Number(hours[1]) * 60;
  if (mins) total += Number(mins[1]);
  if (!total) {
    const bare = text.match(/(\d+)/);
    total = bare ? Number(bare[1]) : 0;
  }
  if (!total) return null;
  return Math.max(3, Math.min(180, total));
}

export function auditWorkout(
  row: WorkoutRow,
  libraryById: Map<string, PoolExercise>,
): AuditRow {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const err = (code: string, message: string, section?: string) =>
    errors.push({ code, severity: "error", message, section });
  const warn = (code: string, message: string, section?: string) =>
    warnings.push({ code, severity: "warning", message, section });

  const html = row.main_workout ?? "";
  const category = normalizeCategory(row.category);
  const format = normalizeFormat(row.format);
  const target = parseTargetMinutes(row.duration);
  const level = starsToLevel(Number(row.difficulty_stars) || 0);
  const focus = (STRENGTH_FOCUS as readonly string[]).includes(
    String(row.focus ?? "").toUpperCase().trim(),
  )
    ? (String(row.focus).toUpperCase().trim() as StrengthFocus)
    : null;

  const base = {
    workout_id: row.id,
    name: row.name ?? row.id,
    category: category ?? String(row.category ?? ""),
    format,
    work_minutes: 0,
    session_minutes: 0,
    target_minutes: target,
  };

  if (!html.trim()) {
    err("EMPTY_CONTENT", "The workout has no content.");
    return { ...base, status: "fail", repair_tier: 3, errors, warnings };
  }
  if (!category) {
    err("UNKNOWN_CATEGORY", `Category "${row.category}" is not one of the current categories.`);
    return { ...base, status: "fail", repair_tier: 3, errors, warnings };
  }

  // 1. Structure — the strict five-section shape.
  const wants = [
    { icon: "🧽", label: "Soft Tissue Preparation", required: category !== "MICRO-WORKOUTS" },
    { icon: "🔥", label: "Activation", required: category !== "MICRO-WORKOUTS" },
    { icon: "💪", label: "Main Workout", required: true },
    { icon: "🧘", label: "Cool Down", required: category !== "MICRO-WORKOUTS" },
  ];
  for (const s of wants) {
    if (s.required && !html.includes(s.icon)) {
      err("MISSING_SECTION", `The ${s.label} section is missing.`, s.label);
    }
  }
  if (categoryAllowsFinisher(category) && !html.includes("⚡")) {
    warn("MISSING_FINISHER", "No Finisher section.", "Finisher");
  } else if (!categoryAllowsFinisher(category) && html.includes("⚡")) {
    err("ILLEGAL_FINISHER", `${category} sessions never carry a Finisher.`, "Finisher");
  }

  // 2. Format legality for the category.
  if (!format) {
    err("FORMAT_ILLEGAL", `Format "${row.format ?? "none"}" is not a recognised format.`);
  } else {
    const fIssue = categoryFormatViolation(category, format);
    if (fIssue) err("FORMAT_ILLEGAL", fIssue);
    else if (!CATEGORY_FORMATS[category].includes(format)) {
      err("FORMAT_ILLEGAL", `${format} is not legal for ${category}.`);
    }
  }

  // 2b. Protocol declared INSIDE the section headers must obey the same table.
  //     "Finisher (For Time)" inside a STRENGTH session is a hard error even
  //     when the workout's format column says REPS & SETS.
  for (const [label, re] of [
    ["Main Workout", /💪[\s\S]{0,200}?Main\s*Workout\s*\(([^)<]+)\)/i],
    ["Finisher", /⚡[\s\S]{0,200}?Finisher\s*\(([^)<]+)\)/i],
  ] as const) {
    const m = html.replace(/<[^>]+>/g, "").match(re);
    if (!m) continue;
    const declared = normalizeFormat(m[1]);
    if (!declared) continue;
    const issue = categoryFormatViolation(category, declared);
    if (issue || !CATEGORY_FORMATS[category].includes(declared)) {
      err(
        "SECTION_FORMAT_ILLEGAL",
        `The ${label} is written as ${declared}, which is not legal for ${category}. ${category} sections must be ${CATEGORY_FORMATS[category].join(" / ")}.`,
        label,
      );
    }
  }

  // 2c. Body structure, not just the heading. In REPS & SETS-only categories a
  //     section may not be written as timed rounds, and every exercise line in
  //     Main Workout / Finisher must declare sets and reps.
  if (isRepsAndSetsOnly(category)) {
    const plain = html.replace(/<[^>]+>/g, " ");
    const mainIdx = plain.indexOf("💪");
    const finIdx = plain.indexOf("⚡");
    const coolIdx = plain.indexOf("🧘");
    const slice = (from: number, to: number) =>
      from === -1 ? "" : plain.slice(from, to === -1 ? plain.length : to);
    const sections: Array<[string, string]> = [
      ["Main Workout", slice(mainIdx, finIdx === -1 ? coolIdx : finIdx)],
      ["Finisher", slice(finIdx, coolIdx)],
    ];
    for (const [label, body] of sections) {
      if (!body) continue;
      if (/\brounds?\s+for\s+time\b|\bfor\s+time\b|\bAMRAP\b|\bEMOM\b|\bTabata\b|\btime\s*cap\b/i.test(body)) {
        err(
          "SECTION_TIMED_STRUCTURE",
          `The ${label} is written as a timed / round-based block. ${category} work must be prescribed as sets and reps.`,
          label,
        );
      }
      // The prescription is written BEFORE the token, so inspect the text that
      // precedes each token occurrence. Sets × reps is the norm; a plain rep
      // count or a timed hold (mobility, micro-workouts) is equally measurable.
      const chunks = body.split(/\{\{exercise:/);
      let unprescribed = 0;
      for (let i = 1; i < chunks.length; i++) {
        const before = chunks[i - 1]!.slice(-120);
        const after = (chunks[i]!.split("}}")[1] ?? "").slice(0, 60);
        const dose = (t: string) =>
          /\d+\s*sets?\s*[x×]\s*\d+/i.test(t) ||
          /\d+\s*[x×]\s*\d+/i.test(t) ||
          /\d+\s*reps?\b/i.test(t) ||
          /\d+\s*(?:sec(?:onds?)?|min(?:utes?)?|breaths?)\b/i.test(t);
        const measurable = dose(before) || dose(after);

        if (!measurable) unprescribed++;
      }
      if (unprescribed) {
        err(
          "SECTION_MISSING_SETS_REPS",
          `${label} has ${unprescribed} exercise line(s) without a measurable prescription (sets × reps, reps, or a timed hold).`,
          label,
        );
      }

    }
  }

  // 3. Library linking.
  const tokens = findTokens(html);
  if (!tokens.length) {
    err("NO_LIBRARY_EXERCISES", "The workout contains no linked library exercises.");
    return { ...base, status: "fail", repair_tier: 3, errors, warnings };
  }
  for (const token of tokens) {
    const libRow = libraryById.get(token.id);
    if (!libRow) {
      err("UNKNOWN_EXERCISE", `"${token.name || token.id}" is not in the exercise library.`);
      continue;
    }
    if (libRow.name.toLowerCase().trim() !== token.name.toLowerCase().trim()) {
      warn("NAME_MISMATCH", `"${token.name}" does not match the library name "${libRow.name}".`);
    }
  }

  const steps = parseWorkoutSteps(html);
  const main = steps.filter((s) => s.section === "Main Workout");
  const finisher = steps.filter((s) => s.section === "Finisher");
  const activation = steps.filter((s) => s.section === "Activation" || s.section === "Warm-up");
  const cooldown = steps.filter((s) => s.section === "Cool-down");
  const rowsOf = (ids: string[]) =>
    ids.map((id) => libraryById.get(id)).filter(Boolean) as PoolExercise[];
  const workSteps = [...main, ...finisher];
  const allSteps = [...main, ...finisher, ...activation, ...cooldown];
  const workRows = rowsOf(workSteps.map((s) => s.exerciseId));
  const isBodyweight = String(row.equipment ?? "").toUpperCase().includes("BODYWEIGHT");

  // 4. Exercise selection policy — the shared single source of truth.
  // Global bans and human-realism rules apply to every playable section. A
  // prohibited movement cannot hide in Activation or Cool Down.
  const globallySeen = new Set<string>();
  for (const step of allSteps) {
    const libRow = libraryById.get(step.exerciseId);
    if (!libRow || globallySeen.has(libRow.id)) continue;
    globallySeen.add(libRow.id);
    if (!isSelectable(libRow.name)) {
      err("BANNED_EXERCISE", `"${libRow.name}" is banned by the current selection rules.`, step.section);
    }
    const real = humanRealismViolation(libRow);
    if (real) err("UNREALISTIC_EXERCISE", real, step.section);
  }

  // Category, format, equipment and focus legality apply to training work.
  const seen = new Set<string>();
  for (const step of workSteps) {
    const libRow = libraryById.get(step.exerciseId);
    if (!libRow) continue;
    if (seen.has(libRow.id)) continue;
    seen.add(libRow.id);
    const section = step.section;
    const cat = categoryExerciseViolation(libRow, category);
    if (cat) err("CATEGORY_EXERCISE", cat, section);
    const prep = workSlotPrepViolation(libRow, category);
    if (prep) err("WORK_SLOT_PREP", prep, section);
    if (category === "MICRO-WORKOUTS" && microExerciseViolation(libRow)) {
      err("MICRO_EQUIPMENT", `"${libRow.name}" needs equipment, which a micro-workout never uses.`, section);
    }
    if (format) {
      const dyn = dynamicExerciseViolation(libRow, category, format);
      if (dyn) err("FORMAT_EXERCISE", dyn, section);
    }
    if (isBodyweight && !(libRow.equipment ?? "").toLowerCase().includes("body weight")) {
      err("EQUIPMENT_MISMATCH", `"${libRow.name}" is not a bodyweight exercise.`, section);
    }
    if (focus) {
      const fv = focusViolation(libRow, focus);
      if (fv) err("FOCUS_MISMATCH", `"${libRow.name}" does not train the ${focus} focus.`, section);
    }
    if (
      ["PILATES", "RECOVERY", "MOBILITY & STABILITY"].includes(category) &&
      !matchesCategoryPool(libRow.name, category)
    ) {
      err("OUT_OF_POOL", `"${libRow.name}" sits outside the approved ${category} pool.`, section);
    }
  }

  // 5. Session-level doctrine.
  if (workRows.length && format) {
    const fam = equipmentFamilyViolation(workRows, category, format);
    if (fam) err("EQUIPMENT_FAMILIES", fam, "Main Workout");
    const seq = sequenceViolation(rowsOf(main.map((s) => s.exerciseId)), format);
    if (seq) err("SEQUENCING", seq, "Main Workout");
  }
  const cardio = cardioDominanceViolation(rowsOf(main.map((s) => s.exerciseId)), category);
  if (cardio) err("CARDIO_DOMINANCE", cardio, "Main Workout");

  // 6. Density and dose hygiene.
  const mainMin = category === "MICRO-WORKOUTS" ? 3 : 4;
  if (main.length < 3) err("MAIN_TOO_THIN", `Main Workout has only ${main.length} exercises.`, "Main Workout");
  else if (main.length < mainMin) warn("MAIN_BELOW_TARGET", `Main Workout is below the ${mainMin}-exercise target.`, "Main Workout");
  if (category !== "MICRO-WORKOUTS") {
    if (activation.length < 3) warn("ACTIVATION_THIN", `Activation has only ${activation.length} drills.`, "Activation");
    if (cooldown.length < 3) warn("COOLDOWN_THIN", `Cool Down has only ${cooldown.length} stretches.`, "Cool-down");
  }
  for (const step of workSteps) {
    if (!/\d/.test(step.prescription)) {
      err("MISSING_DOSE", `"${step.name}" has no prescribed sets/reps/time.`, step.section);
    }
  }
  const uniqueWork = new Set(workSteps.map((s) => s.exerciseId)).size;
  if (workSteps.length >= 6 && uniqueWork < Math.ceil(workSteps.length * 0.5)) {
    warn("REPETITIVE", "The session repeats the same exercises too often.", "Main Workout");
  }

  // 7. Soft tissue stays token-free.
  const softTissue = html.includes("🧽") ? (html.split("🔥")[0] ?? "") : "";
  if (findTokens(softTissue).length && stripHtml(softTissue).length) {
    warn("SOFT_TISSUE_TOKENS", "Soft Tissue Preparation contains exercise links.", "Soft Tissue Preparation");
  }

  // 8. Timing integrity.
  const workMinutes = estimateWorkMinutes(html);
  const sessionMinutes = estimateSessionMinutes(html);
  if (target && format) {
    const floor = minimumWorkMinutes(level, category, format);
    const shortfall = durationShortfallViolation(workMinutes, target);
    if (shortfall) err("DURATION_SHORTFALL", shortfall);
    else if (target >= floor && workMinutes + 8 < target) {
      warn("SHORT_SESSION", `Prescribed work (~${workMinutes} min) is short of the advertised ${target} min.`);
    }
    const overflow = durationOverflowViolation(workMinutes, target);
    if (overflow) err("DURATION_OVERFLOW", overflow);
    const sessOverflow = sessionOverflowViolation(sessionMinutes, target);
    if (sessOverflow) err("SESSION_OVERFLOW", sessOverflow);
  } else if (!target) {
    warn("NO_DURATION", `Duration "${row.duration ?? "none"}" is not a real time value.`);
  }

  // Repair tier.
  let tier: 0 | 1 | 2 | 3 = 0;
  if (errors.length) {
    const codes = new Set(errors.map((e) => e.code));
    const structural = codes.has("NO_LIBRARY_EXERCISES") || codes.has("MAIN_TOO_THIN") ||
      codes.has("EMPTY_CONTENT");
    const sections = new Set(errors.map((e) => e.section).filter(Boolean));
    if ([...codes].every((c) => AUTO_CODES.has(c))) tier = 1;
    else if (!structural && sections.size <= 1) tier = 2;
    else tier = 3;
  } else if (warnings.some((w) => AUTO_CODES.has(w.code))) {
    tier = 1;
  }

  const status: "pass" | "warn" | "fail" = errors.length ? "fail" : warnings.length ? "warn" : "pass";
  return {
    ...base,
    status,
    repair_tier: tier,
    errors,
    warnings,
    work_minutes: workMinutes,
    session_minutes: sessionMinutes,
  };
}

export { nameStem };
