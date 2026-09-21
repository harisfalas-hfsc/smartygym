import { canonicalSection, minimumWorkMinutes, SECTION_ORDER, type Category, type DifficultyLevel, type Format, type SectionName } from "./spec.ts";
import { EXERCISE_TOKEN_RE, findTokens, isLibraryId, stripHtml } from "./tokens.ts";
import { pickPrep, STRETCH_RE, type PoolExercise } from "./pool.server.ts";
import { parseStepTiming, parseWorkoutSteps } from "./parse-steps.ts";
import { categoryAllowsFinisher } from "./doctrine.ts";
import { movementKey } from "../exercise-selection.ts";


export type EnforceResult = {
  html: string;
  warnings: string[];
  errors: string[];
};

const HEADING_RE = /<p class="tiptap-paragraph">\s*(?:🧽|🔥|💪|⚡|🧘)[\s\S]*?<\/p>/g;

export type Section = { name: SectionName; heading: string; body: string };

/** Splits the generated HTML into its icon-titled sections, in document order. */
export function splitSections(html: string): Section[] {
  const out: Section[] = [];
  const matches = [...html.matchAll(new RegExp(HEADING_RE.source, "g"))];
  matches.forEach((m, i) => {
    const start = m.index ?? 0;
    const end = i + 1 < matches.length ? (matches[i + 1]!.index ?? html.length) : html.length;
    const name = canonicalSection(stripHtml(m[0]));
    if (!name) return;
    out.push({ name, heading: m[0], body: html.slice(start + m[0].length, end) });
  });
  return out;
}

export function joinSections(sections: Section[]): string {
  return sections
    .map((s) => `${s.heading}${s.body}`)
    .join('<p class="tiptap-paragraph"></p>');
}

const LIST_ITEM_RE = /<li class="tiptap-list-item">[\s\S]*?<\/li>/g;

function dropListItems(body: string, predicate: (itemHtml: string) => boolean): string {
  return body
    .replace(new RegExp(LIST_ITEM_RE.source, "g"), (item) => (predicate(item) ? "" : item))
    .replace(/<ul class="tiptap-bullet-list">\s*<\/ul>/g, "");
}

const SOFT_TISSUE_ALLOWED =
  /^(foam[\s-]?roll|foam roller|lacrosse ball|tennis ball|trigger point|self-?massage|myofascial release)/i;

/** Standard, always-identical soft tissue block. Token-free by design. */
export const SOFT_TISSUE_LINES = [
  "60 sec Foam roll quadriceps — slow controlled passes",
  "60 sec Foam roll thoracic spine — pause on tender spots",
  "45 sec Lacrosse ball glute release — each side",
  "45 sec Trigger ball plantar release — each foot",
];

const softTissueHtml = () =>
  `<ul class="tiptap-bullet-list">${SOFT_TISSUE_LINES.map(
    (l) => `<li class="tiptap-list-item"><p class="tiptap-paragraph">${l}</p></li>`,
  ).join("")}</ul>`;

const listHtml = (lines: string[]) =>
  `<ul class="tiptap-bullet-list">${lines
    .map((l) => `<li class="tiptap-list-item"><p class="tiptap-paragraph">${l}</p></li>`)
    .join("")}</ul>`;

const tokenOf = (e: PoolExercise) => `{{exercise:${e.id}:${e.name}}}`;

const BREATHING_LINE = "2 min Box breathing — 4 in, 4 hold, 4 out, 4 hold";

/**
 * Layer 1-4 of the post-generation pipeline: token repair, section hygiene,
 * category bans and prescription checks. Returns cleaned HTML plus findings.
 */
export function enforceWorkout(
  rawHtml: string,
  pool: PoolExercise[],
  opts: {
    category: Category;
    format: Format;
    level: DifficultyLevel;
    targetMinutes: number;
    /** Library-backed vocabulary for 🔥 Activation — guarantees playable slides. */
    activationPool?: PoolExercise[];
    /** Blueprint decision: does this duration / category carry a ⚡ Finisher? */
    requireFinisher?: boolean;
    /** Blueprint minimum for 💪 Main Workout. */
    mainMin?: number;
    /** Blueprint minimum for ⚡ Finisher (lifting finishers can be 1-2 lines). */
    finisherMin?: number;

    /** Blueprint decision: does this session carry 🔥 Activation / 🧘 Cool Down? */
    requireActivation?: boolean;
    requireCooldown?: boolean;
    /** Library-backed vocabulary for 🧘 Cool Down — guarantees playable slides. */
    cooldownPool?: PoolExercise[];
    seed?: number;
  },
): EnforceResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const activationPool = opts.activationPool ?? [];
  const cooldownPool = opts.cooldownPool ?? [];
  const activationIds = new Set(activationPool.map((e) => e.id));
  const cooldownIds = new Set(cooldownPool.map((e) => e.id));
  const seed = opts.seed ?? rawHtml.length;
  const known = [...pool, ...activationPool, ...cooldownPool];
  const byId = new Map(known.map((e) => [e.id, e]));
  const byName = new Map(known.map((e) => [e.name.toLowerCase().trim(), e]));


  // ---- Layer 1: token repair -------------------------------------------------
  let html = rawHtml.replace(new RegExp(EXERCISE_TOKEN_RE.source, "g"), (raw, id: string, name: string) => {
    const clean = (name ?? "").trim();
    if (isLibraryId(id) && byId.has(id)) {
      return `{{exercise:${id}:${byId.get(id)!.name}}}`;
    }
    const byExact = byName.get(clean.toLowerCase());
    if (byExact) {
      warnings.push(`Repaired exercise id for "${clean}".`);
      return `{{exercise:${byExact.id}:${byExact.name}}}`;
    }
    warnings.push(`Removed unknown exercise "${clean || id}".`);
    return `__DROP__${clean}`;
  });

  // Drop any list item that lost its exercise.
  html = dropListItems(html, (item) => item.includes("__DROP__"));
  html = html.replace(/__DROP__/g, "");

  let sections = splitSections(html);
  if (!sections.length) {
    errors.push("Workout has no recognisable sections.");
    return { html, warnings, errors };
  }

  // Variety bookkeeping shared by Main Workout and Finisher.
  const seenWorkIds = new Set<string>();
  const seenWorkFamilies = new Map<string, number>();

  sections = sections.map((section) => {
    let body = section.body;

    // ---- Layer 2: Soft Tissue hygiene ---------------------------------------
    if (section.name === "Soft Tissue Preparation") {
      body = dropListItems(body, (item) => {
        const text = stripHtml(item.replace(new RegExp(EXERCISE_TOKEN_RE.source, "g"), "$2"));
        return findTokens(item).length > 0 || !SOFT_TISSUE_ALLOWED.test(text);
      });
      if (!/<li/.test(body)) {
        body = softTissueHtml();
        warnings.push("Rebuilt Soft Tissue Preparation with compliant entries.");
      }
    }

    // ---- Layer 2b: Activation — library movement prep, always playable -------
    if (section.name === "Activation") {
      body = dropListItems(body, (item) => {
        const tokens = findTokens(item);
        if (!tokens.length) return true; // plain text is invisible to the player
        const id = tokens[0]!.id;
        if (activationIds.size && !activationIds.has(id)) {
          warnings.push(`Removed "${tokens[0]!.name}" from Activation (not movement preparation).`);
          return true;
        }
        return false;
      });
      const count = findTokens(body).length;
      if (count < 3) {
        const picks = pickPrep(activationPool, 4, seed);
        if (picks.length >= 3) {
          body = listHtml(
            picks.map((e, i) =>
              i % 2 === 0
                ? `10 reps ${tokenOf(e)} — slow and controlled`
                : `30 sec ${tokenOf(e)} — easy range, breathe`,
            ),
          );
          warnings.push("Rebuilt Activation from the library so every drill is playable.");
        }
      }
    }

    // ---- Layer 2c: Cool Down — library stretches, always playable ------------
    if (section.name === "Cool-down") {
      body = dropListItems(body, (item) => {
        const tokens = findTokens(item);
        if (!tokens.length) return true;
        const id = tokens[0]!.id;
        if (cooldownIds.size && !cooldownIds.has(id)) {
          warnings.push(`Removed "${tokens[0]!.name}" from Cool Down (not a cool-down movement).`);
          return true;
        }
        return false;
      });
      const count = findTokens(body).length;
      if (count < 3) {
        const picks = pickPrep(cooldownPool, 3, seed + 17);
        if (picks.length >= 3) {
          body = listHtml([
            ...picks.map((e) => `45 sec ${tokenOf(e)} — breathe out into the position`),
            BREATHING_LINE,
          ]);
          warnings.push("Rebuilt Cool Down from the library so every stretch is playable.");
        }
      } else if (!body.includes("Box breathing")) {
        body = body.replace(
          /<\/ul>\s*$/,
          `<li class="tiptap-list-item"><p class="tiptap-paragraph">${BREATHING_LINE}</p></li></ul>`,
        );
      }
    }





    // ---- Layer 3: category bans in work sections -----------------------------
    const isWork = section.name === "Main Workout" || section.name === "Finisher";
    if (isWork && opts.category === "CHALLENGE") {
      body = dropListItems(body, (item) => STRETCH_RE.test(stripHtml(item)));
    }

    // ---- Layer 3b: VARIETY — no repeated exercise, no third angle of the same
    //      movement across Main Workout + Finisher (§bench-press-monotony).
    if (isWork) {
      body = dropListItems(body, (item) => {
        const tokens = findTokens(item);
        if (!tokens.length) return false;
        const id = tokens[0]!.id;
        const family = movementKey(tokens[0]!.name);
        if (seenWorkIds.has(id)) {
          warnings.push(`Removed a repeated exercise ("${tokens[0]!.name}").`);
          return true;
        }
        if ((seenWorkFamilies.get(family) ?? 0) >= 2) {
          warnings.push(`Removed a third variation of the same movement ("${tokens[0]!.name}").`);
          return true;
        }
        seenWorkIds.add(id);
        seenWorkFamilies.set(family, (seenWorkFamilies.get(family) ?? 0) + 1);
        return false;
      });
    }

    // ---- Layer 4: prescription checks ---------------------------------------
    if (isWork) {
      body = dropListItems(body, (item) => {
        const text = stripHtml(item);
        const hasToken = findTokens(item).length > 0;
        if (hasToken) return false;
        return /^(tempo|rest)\b/i.test(text) || text.length === 0;
      });
      for (const item of body.match(new RegExp(LIST_ITEM_RE.source, "g")) ?? []) {
        const tokens = findTokens(item);
        if (!tokens.length) continue;
        const before = stripHtml(item.slice(0, item.indexOf(tokens[0]!.raw)));
        if (!/\d/.test(before)) {
          warnings.push(`Missing dose before "${tokens[0]!.name}".`);
        }
      }
      body = body.replace(/\b\d{2}X\d\b/g, "controlled tempo");
    }

    return { ...section, body };
  });

  // ---- Layer 4b: never ship a workout without prep / cool-down --------------
  const hasSection = (name: SectionName) => sections.some((s) => s.name === name);
  const insertSection = (section: Section) => {
    const order = SECTION_ORDER.indexOf(section.name);
    const at = sections.findIndex((s) => SECTION_ORDER.indexOf(s.name) > order);
    if (at === -1) sections.push(section);
    else sections.splice(at, 0, section);
  };

  const wantsActivation = opts.requireActivation ?? opts.category !== "MICRO-WORKOUTS";
  const wantsCooldown = opts.requireCooldown ?? opts.category !== "MICRO-WORKOUTS";

  if (opts.category !== "MICRO-WORKOUTS" && !hasSection("Soft Tissue Preparation")) {
    insertSection({
      name: "Soft Tissue Preparation",
      heading: `<p class="tiptap-paragraph">🧽 <strong><u>Soft Tissue Preparation</u></strong></p>`,
      body: softTissueHtml(),
    });
    warnings.push("Added the standard Soft Tissue Preparation block.");
  }

  if (wantsActivation && !hasSection("Activation") && !hasSection("Warm-up")) {
    const picks = pickPrep(activationPool, 4, seed);
    if (picks.length >= 3) {
      insertSection({
        name: "Activation",
        heading: `<p class="tiptap-paragraph">🔥 <strong><u>Activation 5'</u></strong></p>`,
        body: listHtml(picks.map((e) => `10 reps ${tokenOf(e)} — slow and controlled`)),
      });
      warnings.push("Added a library-backed Activation section.");
    }
  }

  if (wantsCooldown && !hasSection("Cool-down")) {
    const picks = pickPrep(cooldownPool, 3, seed + 17);
    if (picks.length >= 3) {
      insertSection({
        name: "Cool-down",
        heading: `<p class="tiptap-paragraph">🧘 <strong><u>Cool Down 5'</u></strong></p>`,
        body: listHtml([
          ...picks.map((e) => `45 sec ${tokenOf(e)} — breathe out into the position`),
          BREATHING_LINE,
        ]),
      });
      warnings.push("Added a library-backed Cool Down section.");
    }
  }

  // ---- Layer 5: structural quality gate --------------------------------------
  const counts = new Map<SectionName, number>();
  for (const s of sections) counts.set(s.name, findTokens(s.body).length);

  const activationCount = (counts.get("Activation") ?? 0) + (counts.get("Warm-up") ?? 0);
  if (wantsActivation && activationCount < 3)
    warnings.push("Activation has fewer than 3 playable drills.");
  if (wantsCooldown && (counts.get("Cool-down") ?? 0) < 3)
    warnings.push("Cool Down has fewer than 3 playable stretches.");


  // Doctrine: some categories never carry a finisher at all — if the model
  // produced one anyway, the section is dropped rather than validated.
  const finisherAllowed = categoryAllowsFinisher(opts.category);
  if (!finisherAllowed) {
    const before = sections.length;
    sections = sections.filter((s) => s.name !== "Finisher");
    if (sections.length !== before)
      warnings.push(`Removed the Finisher section — ${opts.category} never carries one.`);
    counts.delete("Finisher");
  }
  const requiresFinisher = finisherAllowed && (opts.requireFinisher ?? true);

  const mainMin = opts.mainMin ?? 4;
  const main = counts.get("Main Workout") ?? 0;
  const finisher = counts.get("Finisher") ?? 0;
  if (main < Math.min(3, mainMin)) errors.push(`Main Workout has only ${main} exercises (minimum ${mainMin}).`);
  else if (main < mainMin) warnings.push(`Main Workout is below the ${mainMin}-exercise target.`);
  const finisherMin = opts.finisherMin ?? 3;
  if (requiresFinisher && finisher < finisherMin) {
    if (finisher === 0) errors.push("Finisher section is missing.");
    else warnings.push(`Finisher has only ${finisher} exercises (minimum ${finisherMin}).`);
  }


  const finalHtml = joinSections(sections);

  // ---- Layer 6: duration integrity -------------------------------------------
  const workMinutes = estimateWorkMinutes(finalHtml);
  const floor = minimumWorkMinutes(opts.level, opts.category, opts.format);
  if (opts.targetMinutes >= floor && workMinutes + 6 < opts.targetMinutes) {
    warnings.push(
      `Prescribed work (~${workMinutes} min) is short of the advertised ${opts.targetMinutes} min.`,
    );
  }

  return { html: finalHtml, warnings, errors };
}

/** Rough work-volume estimate for Main Workout + Finisher only. */
export function estimateWorkMinutes(html: string): number {
  return estimateMinutes(html, ["Main Workout", "Finisher"], 0);
}

/** Honest cost of the preparation blocks (soft tissue + activation + warm-up). */
export function estimateActivationMinutes(html: string): number {
  return estimateMinutes(html, ["Soft Tissue Preparation", "Activation", "Warm-up"], 10);
}

/** Honest cost of the cool down block. */
export function estimateCooldownMinutes(html: string): number {
  return estimateMinutes(html, ["Cool-down"], 10);
}

/**
 * §19 — the honest cost of the COMPLETE session: soft tissue, activation, main
 * work, prescribed rest, station transitions, finisher and cool down. The
 * ADVERTISED duration covers training time only (Main + Finisher); this total
 * is checked against training time plus the prep allowances.
 */
export function estimateSessionMinutes(html: string): number {
  const all = estimateMinutes(
    html,
    ["Soft Tissue Preparation", "Activation", "Warm-up", "Main Workout", "Finisher", "Cool-down"],
    15,
  );
  return all;
}

/**
 * §19b — protocol declarations ("4 rounds", "AMRAP for 12 minutes", "EMOM for
 * 20 minutes", "Cap: 15 minutes") multiply or fix the cost of a whole block.
 * Without this a six-station circuit repeated four times was costed as one
 * pass and every conditioning session looked materially short.
 */
function protocolBudget(html: string, sections: string[]): { fixedSeconds: number | null; rounds: number } {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\{\{exercise:[^}]*\}\}/g, " ")
    .replace(/\s+/g, " ");
  // Only trust declarations when the estimate covers the training sections.
  if (!sections.includes("Main Workout")) return { fixedSeconds: null, rounds: 1 };
  const declared = text.match(
    /(?:amrap|as many rounds as possible|emom|every minute on the minute|cap)[^.;]{0,40}?(\d+)\s*(?:min|minute)/i,
  );
  if (declared) {
    const mins = Number(declared[1]);
    if (mins >= 4 && mins <= 90) return { fixedSeconds: mins * 60, rounds: 1 };
  }
  // "8 rounds of 20 sec work / 10 sec rest" is a Tabata protocol already priced
  // into each line — it must never multiply the block again.
  const rounds = text.match(/\b(\d+)\s*rounds?\b(?!\s*of\s*\d+\s*(?:sec|second))/i);
  if (rounds && !/tabata/i.test(text)) {
    const n = Number(rounds[1]);
    if (n >= 2 && n <= 10) return { fixedSeconds: null, rounds: n };
  }
  return { fixedSeconds: null, rounds: 1 };
}

function estimateMinutes(html: string, sections: string[], transitionSec: number): number {
  const steps = parseWorkoutSteps(html).filter((s) => sections.includes(s.section));
  const budget = protocolBudget(html, sections);
  let seconds = 0;
  for (const step of steps) {
    const timing = parseStepTiming(step);
    // A declared round count belongs to the main block only — the finisher
    // carries its own dose and must never be multiplied by it.
    const rounds = step.section === "Main Workout" ? budget.rounds : 1;
    if (timing.mode === "tabata") seconds += timing.rounds * (timing.work + timing.rest);
    else if (timing.mode === "timed") seconds += (timing.seconds + 20) * rounds;
    else if (!/\d+\s*sets?/i.test(step.prescription)) {
      seconds += (Number(step.prescription.match(/(\d+)\s*reps?/i)?.[1] ?? 12) * 4 + 25) * rounds;
    } else {
      const line = step.prescription;
      const sets = Number(line.match(/(\d+)\s*sets?/i)?.[1] ?? 1);
      const reps = Number(line.match(/(\d+)\s*reps?/i)?.[1] ?? 12);
      // Honour the rest actually written on the line — heavy strength rests of
      // 2-3 min cost real time and must not be counted as a flat 60 sec.
      const restMatch = line.match(/rest[^.;]*?(\d+)(?:\s*-\s*(\d+))?\s*(sec|second|s\b|min|minute)/i);
      let restSec = 60;
      if (restMatch) {
        const low = Number(restMatch[1]);
        const high = restMatch[2] ? Number(restMatch[2]) : low;
        const value = (low + high) / 2;
        restSec = /min/i.test(restMatch[3]!) ? value * 60 : value;
      }
      seconds += sets * (reps * 4 + Math.max(20, Math.min(240, restSec)));
    }
    seconds += transitionSec;
  }
  if (budget.fixedSeconds !== null) seconds = Math.max(seconds, budget.fixedSeconds);
  seconds = Math.max(seconds, declaredSectionSeconds(html, sections));
  return Math.round(seconds / 60);
}

/**
 * §19c — a section header that declares its own clock ("Main Workout (EMOM 25')",
 * "Finisher (10 minutes)", "Main Workout (AMRAP 20 min)") fixes the cost of that
 * block. Time-capped conditioning blocks do not write per-exercise rounds, so
 * without this the estimator under-counts a genuinely full session.
 */
function declaredSectionSeconds(html: string, sections: string[]): number {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\{\{exercise:[^}]*\}\}/g, " ").replace(/\s+/g, " ");
  const headers: Array<[string, RegExp]> = [
    // "Main Workout (EMOM 25')", "Main Workout (EMOM) 20'", "Main Workout (15-minute AMRAP)"
    ["Main Workout", /Main\s*Workout\b[^.]{0,40}?(\d+)[-\s]*(?:'|min\b|minute)/i],
    ["Finisher", /Finisher\b[^.]{0,40}?(\d+)[-\s]*(?:'|min\b|minute)/i],
  ];
  let total = 0;
  for (const [section, re] of headers) {
    if (!sections.includes(section)) continue;
    const m = text.match(re);
    if (!m) continue;
    const value = Number(m[1]);
    if (value >= 3 && value <= 90) total += value * 60;
  }
  // An explicit written total for the work block ("Prescribed work and recovery
  // total approximately 34 min 55 sec") is the coach's own dose statement.
  if (sections.includes("Main Workout")) {
    const stated = text.match(/total(?:s|ling)?\s+(?:approximately\s+)?(\d+)\s*min/i);
    if (stated) {
      const value = Number(stated[1]);
      if (value >= 3 && value <= 120) total = Math.max(total, value * 60);
    }
  }
  return total;
}

