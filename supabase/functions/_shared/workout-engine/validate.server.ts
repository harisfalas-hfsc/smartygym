// Deterministic post-generation validator.
// Runs AFTER enforceWorkout and re-checks the finished HTML against the hard
// contract: real library ids, the exact equipment allowlist, banned exercises,
// section shape and dose hygiene. Nothing here trusts the model.
import { equipmentLegalForSession, matchesSelectedEquipment, nameStem, type PoolExercise } from "./pool.server.ts";
import { matchesCategoryPool } from "../exercise-selection.ts";
import { findTokens, isLibraryId, stripHtml } from "./tokens.ts";
import { parseWorkoutSteps } from "./parse-steps.ts";
import {
  estimateActivationMinutes,
  estimateCooldownMinutes,
  estimateSessionMinutes,
  estimateWorkMinutes,
} from "./enforce.server.ts";
import {
  activationRelevanceViolation,
  ageSafetyViolation,
  categoryAllowsFinisher,
  categoryExerciseViolation,
  cardioDominanceViolation,
  categoryFormatViolation,
  durationOverflowViolation,
  durationShortfallViolation,
  finisherSizeViolation,
  dynamicExerciseViolation,
  equipmentFamilyViolation,
  focusViolation,
  focusRegion,
  regionOf,
  humanRealismViolation,
  locationEquipmentViolation,
  moodDoseViolation,
  sequenceViolation,

  microExerciseViolation,
  activationOverflowViolation,
  cooldownOverflowViolation,
  sessionOverflowViolation,
  sessionBudgetViolation,
  workSlotPrepViolation,
} from "./doctrine.ts";

import {
  minimumWorkMinutes,
  type Category,
  type DifficultyLevel,
  type EquipmentMode,
  type Format,
  type StrengthFocus,
} from "./spec.ts";


export type ValidationResult = { errors: string[]; warnings: string[] };

export type ValidateOptions = {
  /** Full library, used to resolve ids the pool filter removed. */
  library: PoolExercise[];
  pool: PoolExercise[];
  category: Category;
  format: Format;
  level: DifficultyLevel;
  targetMinutes: number;
  equipmentMode: EquipmentMode;
  selectedEquipment: string[];
  customEquipment?: string[];
  /** Today's body-part focus — a hard legality gate on every work exercise. */
  focus?: StrengthFocus | null;
  dislikedIds?: string[];
  /** Where the athlete trains today — outdoors bans gym apparatus outright. */
  location?: string | null;
  /** Today's reported state — a low-energy day caps impact deterministically. */
  mood?: string | null;
  /** Athlete age — past 60 repeated impact is replaced, not just discouraged. */
  age?: number | null;


  /** Ids allowed in 🔥 Activation / 🧘 Cool Down (prep vocabulary, bodyweight-first). */
  prepIds?: string[];
  /** Blueprint minimum for 💪 Main Workout. */
  mainMin?: number;
  /** Blueprint decision: does this duration / category carry a ⚡ Finisher? */
  requireFinisher?: boolean;
  /** Blueprint minimum for ⚡ Finisher lines. */
  finisherMin?: number;

  /** Blueprint decision: does this session carry 🔥 Activation / 🧘 Cool Down? */
  requireActivation?: boolean;
  requireCooldown?: boolean;
};


export function validateWorkout(html: string, opts: ValidateOptions): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const poolIds = new Set(opts.pool.map((e) => e.id));
  const prepIds = new Set(opts.prepIds ?? []);
  const libraryById = new Map(opts.library.map((e) => [e.id, e]));
  // Does the legal pool hold enough strictly on-focus vocabulary to fill the
  // session? If yes, the focus is absolute; if not, §15 regional support work
  // is legitimate (see the focus check below).
  const focusVocabularySufficient = opts.focus
    ? opts.pool.filter((e) => !focusViolation(e, opts.focus!)).length >=
      (opts.mainMin ?? 4) + (opts.requireFinisher ? (opts.finisherMin ?? 3) : 0)
    : true;
  const banned = new Set(opts.dislikedIds ?? []);
  const bannedStems = new Set(
    (opts.dislikedIds ?? [])
      .map((id) => libraryById.get(id))
      .filter(Boolean)
      .map((e) => nameStem(e!.name))
      .filter((s) => s.length > 3),
  );

  // 0. Category / format legality — the doctrine decides which formats a
  //    category may ever wear, regardless of what was requested upstream.
  const formatIssue = categoryFormatViolation(opts.category, opts.format);
  if (formatIssue) errors.push(formatIssue);

  const tokens = findTokens(html);
  if (!tokens.length) {
    errors.push("The workout contains no library exercises.");
    return { errors, warnings };
  }



  // 1. Every token must be a real library id that survived the session filter.
  for (const token of tokens) {
    if (!isLibraryId(token.id) || !libraryById.has(token.id)) {
      errors.push(`Exercise "${token.name || token.id}" is not in the library.`);
      continue;
    }
    const row = libraryById.get(token.id)!;
    if (row.name.toLowerCase().trim() !== token.name.toLowerCase().trim()) {
      warnings.push(`Exercise name for ${token.id} did not match the library entry.`);
    }
    // Prep vocabulary (Activation / Cool Down) is bodyweight-first and lives
    // outside the session pool on purpose — it only has to be a legal prep id.
    const isPrep = prepIds.has(token.id);
    if (!isPrep) {
      if (!poolIds.has(token.id)) {
        errors.push(`"${row.name}" is outside the approved pool for this session.`);
      }
      // 2. Equipment allowlist — ONE shared rule with the pool filter, so the
      //    athlete's own bodyweight is legal alongside their chosen kit.
      if (
        !equipmentLegalForSession(row, {
          category: opts.category,
          equipmentMode: opts.equipmentMode,
          selectedEquipment: opts.selectedEquipment,
          customEquipment: opts.customEquipment ?? [],
        })
      ) {
        errors.push(`"${row.name}" needs ${row.equipment ?? "unlisted"} equipment, which is not available.`);
      }
      if (
        opts.equipmentMode === "BODYWEIGHT" &&
        !(row.equipment ?? "").toLowerCase().includes("body weight")
      ) {
        errors.push(`"${row.name}" is not a bodyweight exercise.`);
      }
      // 2a-bis. Human realism — no gymnastics, levers or technical Olympic work.
      const real = humanRealismViolation(row);
      if (real) errors.push(real);
      // 2a-ter. Environment realism — outdoors means portable equipment only.
      const loc = locationEquipmentViolation(row, opts.location ?? null);
      if (loc) errors.push(loc);
      // 2b. Format legality — no setup-heavy apparatus in a dynamic format.
      const dyn = dynamicExerciseViolation(row, opts.category, opts.format);
      if (dyn) errors.push(dyn);

      // 2c. Category vocabulary legality (Pilates, Mobility, Recovery, Micro,
      //     Challenge) — one shared definition with the pool filter.
      const cat = categoryExerciseViolation(row, opts.category);
      if (cat) errors.push(cat);
      if (
        ["PILATES", "RECOVERY", "MOBILITY & STABILITY"].includes(opts.category) &&
        !matchesCategoryPool(row.name, opts.category)
      ) {
        errors.push(`"${row.name}" is outside the approved ${opts.category} exercise pool.`);
      }
      if (opts.category === "MICRO-WORKOUTS" && microExerciseViolation(row)) {
        errors.push(`"${row.name}" needs equipment or a special setup, which a micro-workout never uses.`);
      }
      // 2d. Focus legality — a focus is a hard gate whenever the legal pool
      //     really can cover the session with on-focus vocabulary. When a
      //     narrow focus (e.g. CORE & GLUTES with only dumbbells) has too few
      //     legal movements, §15 allows neighbouring support work from the SAME
      //     body region — the same widening the pool filter applies — so the
      //     validator must not reject what the selection rules legitimately
      //     handed the session. Work outside the region stays an error.
      if (opts.focus) {
        const fv = focusViolation(row, opts.focus);
        if (fv) {
          const region = focusRegion(opts.focus);
          const rowRegion = regionOf(row);
          const regionalSupport =
            !focusVocabularySufficient && (rowRegion === region || rowRegion === "full" || region === "full");
          if (!regionalSupport) errors.push(`"${row.name}" does not train the ${opts.focus} focus.`);
        }
      }

    }

    // 3. Disliked exercises and their close variations.
    if (banned.has(row.id) || bannedStems.has(nameStem(row.name))) {
      errors.push(`"${row.name}" is on the athlete's excluded list.`);
    }
  }

  // 4. Section shape and dose hygiene.
  const steps = parseWorkoutSteps(html);
  const main = steps.filter((s) => s.section === "Main Workout");
  const finisher = steps.filter((s) => s.section === "Finisher");
  const activation = steps.filter((s) => s.section === "Activation" || s.section === "Warm-up");
  const cooldown = steps.filter((s) => s.section === "Cool-down");
  const requiresFinisher =
    categoryAllowsFinisher(opts.category) && (opts.requireFinisher ?? true);
  if (!categoryAllowsFinisher(opts.category) && finisher.length) {
    errors.push(`${opts.category} sessions never carry a Finisher.`);
  }

  const wantsActivation = opts.requireActivation ?? opts.category !== "MICRO-WORKOUTS";
  const wantsCooldown = opts.requireCooldown ?? opts.category !== "MICRO-WORKOUTS";
  const mainMin = opts.mainMin ?? 4;

  if (main.length < mainMin) {
    if (main.length < Math.min(3, mainMin)) errors.push(`Main Workout has only ${main.length} exercises.`);
    else warnings.push(`Main Workout is below the ${mainMin}-exercise target.`);
  }
  if (requiresFinisher && finisher.length < (opts.finisherMin ?? 3)) {
    if (!finisher.length) errors.push("Finisher section is missing.");
    else warnings.push(`Finisher has only ${finisher.length} exercises.`);
  }
  if (finisher.length) {
    const plain = html.replace(/<[^>]+>/g, " ");
    const finIdx = plain.indexOf("⚡");
    const coolIdx = plain.indexOf("🧘");
    if (finIdx !== -1) {
      const size = finisherSizeViolation(
        plain.slice(finIdx, coolIdx === -1 ? plain.length : coolIdx),
      );
      if (size) errors.push(size);
    }
  }

  if (wantsActivation && activation.length < 3) {
    warnings.push(`Activation has only ${activation.length} playable drills.`);
  }
  if (wantsCooldown && cooldown.length < 3) {
    warnings.push(`Cool Down has only ${cooldown.length} playable stretches.`);
  }


  for (const step of [...main, ...finisher]) {
    if (!/\d/.test(step.prescription)) {
      errors.push(`"${step.name}" has no prescribed dose.`);
    }
    const stepRow = libraryById.get(step.exerciseId);
    if (stepRow) {
      const prep = workSlotPrepViolation(stepRow, opts.category);
      if (prep) errors.push(prep);
    }
  }

  // 5. Repetition guard — a session should not recycle the same two movements.
  const workIds = [...main, ...finisher].map((s) => s.exerciseId);
  const unique = new Set(workIds).size;
  if (workIds.length >= 6 && unique < Math.ceil(workIds.length * 0.5)) {
    warnings.push("The session repeats the same exercises too often.");
  }

  // 6. Soft tissue section must stay token-free.
  const softTissue = html.split("🔥")[0] ?? "";
  if (findTokens(softTissue).length && stripHtml(softTissue).length) {
    warnings.push("Soft Tissue Preparation contained exercise links.");
  }

  // 6b. Activation must prepare the actual demand of the Main Workout.
  const rowsOf = (ids: string[]) =>
    ids.map((id) => libraryById.get(id)).filter(Boolean) as PoolExercise[];
  if (activation.length && main.length) {
    const relevance = activationRelevanceViolation(
      rowsOf(activation.map((s) => s.exerciseId)),
      rowsOf(main.map((s) => s.exerciseId)),
    );

    if (relevance) errors.push(relevance);
  }

  // 6c. Equipment families — the athlete must never assemble a gym mid-session.
  const workRows = rowsOf([...main, ...finisher].map((s) => s.exerciseId));
  if (workRows.length) {
    const fam = equipmentFamilyViolation(workRows, opts.category, opts.format);
    if (fam) errors.push(fam);
    // 6d. Sequencing realism — never a technical movement straight after a
    //     high-fatigue one under a running clock.
    const seq = sequenceViolation(rowsOf(main.map((s) => s.exerciseId)), opts.format);
    if (seq) errors.push(seq);
    // 6e. Cardio stays aerobic — it may never turn into a metabolic session.
    const cardio = cardioDominanceViolation(rowsOf(main.map((s) => s.exerciseId)), opts.category);
    if (cardio) errors.push(cardio);
    // 6f. Mood and biometrics change the DOSE, and the change is verified here
    //     rather than merely requested in the prompt.
    const mainRows = rowsOf([...main, ...finisher].map((s) => s.exerciseId));
    const moodIssue = moodDoseViolation(opts.mood ?? null, mainRows);
    if (moodIssue) errors.push(moodIssue);
    const ageIssue = ageSafetyViolation(opts.age ?? null, mainRows);
    if (ageIssue) errors.push(ageIssue);
  }



  // 7. Duration integrity — the advertised duration is TRAINING time
  //    (Main + Finisher). Activation and cool down are bounded allowances on
  //    top of it, and the whole session keeps a generous sanity ceiling.
  const workMinutes = estimateWorkMinutes(html);
  const floor = minimumWorkMinutes(opts.level, opts.category, opts.format);
  const shortfall = durationShortfallViolation(workMinutes, opts.targetMinutes);
  if (shortfall) errors.push(shortfall);
  else if (opts.targetMinutes >= floor && workMinutes + 8 < opts.targetMinutes) {
    warnings.push(
      `Prescribed work (~${workMinutes} min) is short of the advertised ${opts.targetMinutes} min.`,
    );
  }
  const overflow = durationOverflowViolation(workMinutes, opts.targetMinutes);
  if (overflow) errors.push(overflow);
  const activationOverflow = activationOverflowViolation(
    estimateActivationMinutes(html),
    opts.targetMinutes,
  );
  if (activationOverflow) errors.push(activationOverflow);
  const cooldownOverflow = cooldownOverflowViolation(
    estimateCooldownMinutes(html),
    opts.targetMinutes,
  );
  if (cooldownOverflow) errors.push(cooldownOverflow);
  const sessionMinutes = estimateSessionMinutes(html);
  const sessionOverflow = sessionOverflowViolation(sessionMinutes, opts.targetMinutes);
  if (sessionOverflow) errors.push(sessionOverflow);
  const budget = sessionBudgetViolation(sessionMinutes, workMinutes, opts.targetMinutes);
  if (budget) errors.push(budget);




  return { errors, warnings };
}
