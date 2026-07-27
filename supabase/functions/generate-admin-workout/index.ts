// Generate ONE custom admin workout from wizard metadata.
// Mirrors generate-category-difficulty-batch but accepts arbitrary
// (category, equipment, difficulty_stars, format, duration, focus, access)
// from the admin Content Creation Wizard.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  processContentSectionAware,
  fetchAndBuildExerciseReference,
  guaranteeAllExercisesLinked,
  rejectNonLibraryExercises,
  logUnmatchedExercises,
  repairStaticHoldPrescriptions,
  removeStaticHoldsFromMomentumSections,
} from "../_shared/exercise-matching.ts";
import { normalizeWorkoutHtml, validateWorkoutHtml } from "../_shared/html-normalizer.ts";
import { validateWodSections } from "../_shared/section-validator.ts";
import { requireAdminOrServiceRole } from "../_shared/admin-or-service-auth.ts";
import { sanitizeProtocolBlocks, validateProtocolBlocks } from "../_shared/protocol-sanitizer.ts";
import { applyWodQualityGate } from "../_shared/wod-quality-gate.ts";
import { validateGeneratedWorkoutContract } from "../_shared/generated-workout-contract.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function log(step: string, details?: any) {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[WIZARD-GEN] ${step}${d}`);
}

interface WizardBody {
  category: string;
  equipment: "BODYWEIGHT" | "EQUIPMENT" | string;
  difficulty_stars: number;       // 0..6
  format?: string;                 // TABATA / CIRCUIT / AMRAP / FOR TIME / EMOM / REPS & SETS / MIX
  duration?: string;               // e.g. "30 min" or "5 min"
  focus?: string;                  // STRENGTH only
  access?: "free" | "premium" | "standalone";
  price?: string | number;         // standalone only
  tier_required?: string;          // premium only
}

const CATEGORY_PREFIX: Record<string, string> = {
  STRENGTH: "S",
  "CALORIE BURNING": "CB",
  METABOLIC: "ME",
  CARDIO: "C",
  "MOBILITY & STABILITY": "M",
  CHALLENGE: "CH",
  PILATES: "PIL",
  RECOVERY: "REC",
  "MICRO-WORKOUTS": "MW",
};

function difficultyLabel(stars: number): "Beginner" | "Intermediate" | "Advanced" | "All Levels" {
  if (stars <= 0) return "All Levels";
  if (stars <= 2) return "Beginner";
  if (stars <= 4) return "Intermediate";
  return "Advanced";
}

function categoryGuidance(category: string, equipment: string, focus?: string): string {
  const eq = equipment === "BODYWEIGHT";
  switch (category) {
    case "STRENGTH":
      return `STRENGTH (focus: ${focus || "FULL BODY"}). Heavy compound lifts with reps & sets prescriptions. Long rest (90-180s). ${eq ? "Bodyweight progressions only." : "Use barbell/DB/KB/cable as appropriate."}`;
    case "CALORIE BURNING":
      return eq
        ? "High-output bodyweight conditioning: burpees, jump squats, mountain climbers, plyo push-ups, jumping lunges."
        : "High-output conditioning with implements: KB swings, DB thrusters, rowing intervals, sled push, battle ropes.";
    case "METABOLIC":
      return eq
        ? "Full-body metabolic circuits — push/pull/squat/hinge bodyweight movements with minimal rest."
        : "Full-body metabolic circuits combining strength + conditioning: DB/KB/barbell complexes, thrusters, devil press.";
    case "CARDIO":
      return eq
        ? "Sustained heart-rate work: jumping jacks, skater jumps, high knees, mountain climbers, burpees."
        : "Cardiovascular conditioning: rower, assault bike, jump rope, KB swings, ski erg, sled work.";
    case "MOBILITY & STABILITY":
      return eq
        ? "Controlled bodyweight mobility & stability ONLY: CARs, balance holds, bird dog, side bridge, cat-cow, ankle/wrist circles, slow breathing. HARD BAN: jumps, burpees, plyometrics, heavy strength, push-ups, crunches, sit-ups, dynamic leg-raise core."
        : "Controlled equipment-assisted mobility & stability ONLY: bands, balance board, foam roller, ex-ball, rope-assisted stretches. HARD BAN: KB power work, heavy strength, conditioning, crunches, sit-ups.";
    case "CHALLENGE":
      return eq
        ? "Test-style bodyweight challenge: AMRAP/For-Time pieces with multiple rounds, varied high-output movement patterns. HARD BAN in Main Workout and Finisher: stretching, mobility, yoga poses, static flexibility drills, or recovery exercises. Challenge means benchmark intensity, capacity, time pressure, reps, rounds, and discomfort tolerance — not stretching."
        : "Test-style challenge with implements: rounds-for-time, complex chippers, mixed modality. HARD BAN in Main Workout and Finisher: stretching, mobility, yoga poses, static flexibility drills, or recovery exercises. Use loaded conditioning, carries, swings, thrusters, rowing/bike/jump rope, squats, hinges, pushes, pulls, and core under fatigue.";
    case "PILATES":
      return "Pilates studio standard: mat, reformer, magic circle, Pilates ball, light dumbbells, resistance bands ONLY. FORBIDDEN: kettlebells, barbells, heavy DBs, machines, cables, plyometrics, conditioning movements. Focus on controlled spinal articulation, deep core, breath-led tempo, REPS & SETS prescriptions.";
    case "RECOVERY":
      return "Recovery protocol: PNF stretching, CARs (controlled articular rotations), nasal breathing/box breathing, gentle mobility. No plyometrics, no conditioning, no heavy lifting, no crunches/sit-ups.";
    case "MICRO-WORKOUTS":
      return "MICRO-WORKOUT (5 minutes total). Equipment allowed: bodyweight ONLY plus chair / sofa / desk / stairs / wall — items found at home or office. FORBIDDEN: dumbbells, kettlebells, barbells, bands, machines, air bike, rower, jump rope, treadmill, sled. Movements must be doable in office clothes in a small space. Total time 5 minutes including warm-up + main + cooldown.";
    default:
      return `General ${category} workout. Use library exercises appropriate for the category and equipment.`;
  }
}

function formatGuidanceFor(format: string): string {
  switch (format) {
    case "AMRAP":
      return `AMRAP block: header "Main Workout (AMRAP)" — state the time cap in a separate paragraph, then list 4-6 exercises with rep targets BEFORE each exercise token.`;
    case "EMOM":
      return `EMOM block: header "Main Workout (EMOM)" — label every minute and put reps/time BEFORE each exercise token.`;
    case "CIRCUIT":
      return `CIRCUIT block: header "Main Workout (CIRCUIT)" — state rounds/rest in a separate paragraph, then list 5-7 stations with reps/time BEFORE each exercise token.`;
    case "TABATA":
      return `TABATA block: header "Main Workout (TABATA)" — 8 rounds × 20s work / 10s rest, with "20 sec" BEFORE every exercise token.`;
    case "FOR TIME":
      return `FOR TIME block: header "Main Workout (For Time)" — chipper or rounds-for-time with reps BEFORE every exercise token.`;
    case "REPS & SETS":
      return `REPS & SETS block: each exercise starts with sets × reps, then exercise token, then readable tempo/rest (e.g. "4 sets × 8 reps {{exercise:ID:Name}} — tempo 3-sec lower, 1-sec pause, explosive lift, 1-sec reset; rest 90 sec").`;
    case "MIX":
      return `MIX block: combine a properly prescribed REPS & SETS strength portion with a properly prescribed metabolic finisher. Every exercise token needs reps/time/sets BEFORE it.`;
    default:
      return `List each exercise with explicit prescription (reps/time/sets) BEFORE the exercise token.`;
  }
}

function buildPrompt(args: {
  body: WizardBody;
  referenceList: string;
  bannedNames: string[];
}): string {
  const { body, referenceList, bannedNames } = args;
  const { category, equipment, difficulty_stars, format = "MIX", duration = "30 min", focus } = body;
  const difficulty = difficultyLabel(difficulty_stars);
  const isMicro = category === "MICRO-WORKOUTS";
  const isControlledRepsSets = ["STRENGTH", "MOBILITY & STABILITY", "PILATES"].includes(category);
  const bannedBlock = bannedNames.length
    ? `\n⛔ BANNED NAMES — already in library; DO NOT reuse or trivially vary:\n${bannedNames.slice(0, 200).map(n => `   ❌ "${n}"`).join("\n")}\n`
    : "";

  const sectionRules = isMicro
    ? `MICRO-WORKOUT 5-MINUTE STRUCTURE (TOTAL = 5 MIN):
1. 🔥 Activation 1' — 1-2 library exercises with markup, 20-30s each.
2. 💪 Main Workout 3' — 3-4 library exercises with markup, body-only or chair/desk/wall/stairs.
3. 🧘 Cool Down 1' — 1-2 library stretches with markup.
NO Soft Tissue section (no time). NO Finisher section (no time).
Duration headers MUST sum to exactly 5'.`
    : `MANDATORY 5-SECTION STRUCTURE (icons in this exact order):
1. 🧽 Soft Tissue Preparation — FOAM ROLLING ONLY (no library markup). Lines start with "Foam roll", "Lacrosse ball", "Trigger point", etc.
2. 🔥 Activation — library exercises with markup.
3. 💪 Main Workout — library exercises with markup (minimum 4).
4. ⚡ Finisher — library exercises with markup (MINIMUM 3, duration 10+ minutes).
5. 🧘 Cool Down — library stretches & breathing with markup.`;

  return `You are Haris Falas, Sports Scientist (CSCS), creating a custom ${difficulty.toUpperCase()} ${category} workout for SmartyGym.

WORKOUT SPEC:
- Category: ${category}
- Equipment: ${equipment === "BODYWEIGHT" ? "BODYWEIGHT ONLY (home/office friendly)" : "GYM EQUIPMENT (barbell/DB/KB/cable/machines/bands as appropriate)"}
- Difficulty: ${difficulty} (${difficulty_stars} stars out of 6)
- Format: ${format}
- Total Duration: ${duration}
${focus ? `- Strength Focus: ${focus}\n` : ""}
CATEGORY COACHING RULES:
${categoryGuidance(category, equipment, focus)}

NAMING:
- 2-4 word creative name, premium signature feel.
- AVOID overused: Inferno, Blaze, Fire, Burn, Fury, Storm, Thunder, Power, Beast, Warrior, Elite, Ultimate, Extreme, Foundation, Torch, Melt, Engine, Drive, Catalyst, Flow, Restore, Gauntlet, Summit, Crucible.
- Must hint at the category${focus ? ` and focus (${focus})` : ""}.
- STRICTLY FORBIDDEN: internal-style codes or suffixes like "CAL-813", "STR-204", "BW1230", "V2", "#3", roman numerals (II, III, IV…), any digits, or any 3-letter uppercase abbreviations followed by a number. Names must read like a human-written workout title, not a database ID. If the candidate name collides with an existing one, rephrase it using the workout format word (Circuit, AMRAP, EMOM, Ladder, Intervals, Tabata, For Time, Pyramid, etc.) — e.g. "Kinetic Cascade Circuit" or "Kinetic Cascade AMRAP".${bannedBlock}

EXERCISE LIBRARY (USE EXCLUSIVELY — library-first):
${referenceList}

Every exercise reference in main_workout MUST use the markup {{exercise:ID:Name}}.
Never invent exercises. Never use plain names.

${sectionRules}

SECTION TITLE FORMAT: <p class="tiptap-paragraph">🔥 <strong><u>Activation 5'</u></strong></p>
ONLY ONE icon per section.

EXERCISE LINES — bullet lists ONLY, prescription FIRST:
<ul class="tiptap-bullet-list"><li class="tiptap-list-item"><p class="tiptap-paragraph">12 reps {{exercise:ID:Name}}</p></li></ul>

NON-NEGOTIABLE PRESCRIPTION RULES:
- Every Main Workout and Finisher exercise line MUST put the measurable dose BEFORE the {{exercise:...}} token.
- Correct REPS & SETS: "4 sets × 6 reps {{exercise:0043:barbell full squat}} — tempo 3-sec lower, 1-sec pause, explosive lift, 1-sec reset; rest 150 sec".
- WRONG and forbidden: "{{exercise:0043:barbell full squat}} 41X1" because 41X1 is tempo shorthand, not sets/reps.
- Do NOT print compact tempo codes in final content (20X0, 31X1, 41X1, 21X1). Convert them to readable coaching language.
- Conditioning examples: "15 reps {{exercise:1160:burpee}}", "40 sec {{exercise:0630:mountain climber}}", "200m {{exercise:0685:run}}".
- Never list naked exercises. Never write an exercise token alone and explain reps later.
- ABSOLUTELY FORBIDDEN: putting tempo or rest on a SEPARATE bullet/line after the exercise. Tempo + rest MUST be inline on the SAME <li> as the exercise token, e.g. "5 sets × 5 reps {{exercise:ID:Name}} — tempo 3-sec lower, 2-sec pause, explosive lift, 1-sec reset; rest 100 sec". Never produce a bullet whose entire content is a tempo code, "rest Ns", or "tempo X, rest Y".

SECTION SEPARATORS: ONE empty paragraph between sections only: <p class="tiptap-paragraph"></p>

MAIN WORKOUT TITLE: "Main Workout (${format})" — no duration inside protocol headers.
${isMicro ? "" : isControlledRepsSets ? "FINISHER TITLE: \"Finisher (REPS & SETS)\" — short controlled accessory/core finisher with sets × reps before every exercise token." : "FINISHER TITLE: \"Finisher (For Time)\" or \"Finisher (AMRAP)\" — no duration inside protocol headers. Put time cap/rounds in the paragraph below the header."}

FORMAT GUIDANCE:
${formatGuidanceFor(format)}

PRESCRIPTION RULE: every Main Workout and Finisher exercise line MUST include reps/time/distance/sets BEFORE the exercise token.

RESPONSE FORMAT (JSON ONLY — NO MARKDOWN):
{
  "name": "2-4 word creative name (unique)",
  "description": "<p class=\\"tiptap-paragraph\\">2-3 sentence description tied to ${category}.</p>",
  "main_workout": "Full structured HTML following the rules above with library-first markup",
  "instructions": "<p class=\\"tiptap-paragraph\\">How to perform this workout</p>",
  "tips": "<p class=\\"tiptap-paragraph\\">Coaching tip 1</p><p class=\\"tiptap-paragraph\\">Coaching tip 2</p><p class=\\"tiptap-paragraph\\">Coaching tip 3</p>"
}`;
}

interface WorkoutContent {
  name: string;
  description: string;
  main_workout: string;
  instructions: string;
  tips: string;
}

// One generate click must equal one AI request. No fallback model cascade: it
// wastes credits when validation/parsing fails downstream.
const AI_MODEL = "google/gemini-3-flash-preview";

function aiGatewayFailureMessage(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body);
    const message = parsed?.message || parsed?.title || parsed?.error;
    if (status === 402) {
      return "Lovable AI credits are exhausted. Add workspace credits, then try Generate & Review again.";
    }
    if (status === 429) {
      return "Lovable AI is rate limited right now. Wait a moment, then try Generate & Review again.";
    }
    return message ? `Lovable AI request failed (${status}): ${message}` : `Lovable AI request failed (${status})`;
  } catch {
    if (status === 402) {
      return "Lovable AI credits are exhausted. Add workspace credits, then try Generate & Review again.";
    }
    return `Lovable AI request failed (${status})`;
  }
}

function contentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part: any) => (typeof part === "string" ? part : part?.text || part?.content || ""))
      .join("\n");
  }
  return "";
}

function parseWorkoutJson(rawText: string): WorkoutContent | null {
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Partial<WorkoutContent>;
  if (!parsed.name || !parsed.description || !parsed.main_workout || !parsed.instructions || !parsed.tips) {
    return null;
  }
  return parsed as WorkoutContent;
}

async function callAI(apiKey: string, prompt: string): Promise<WorkoutContent | null> {
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: "You are an expert fitness coach. Generate workouts using the provided tool." },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
      }),
    });
    const raw = await r.text();
    if (!r.ok) {
      log("AI request failed", { model: AI_MODEL, status: r.status, body: raw.slice(0, 300) });
      throw new Error(aiGatewayFailureMessage(r.status, raw));
    }
    const d = JSON.parse(raw);
    const message = d.choices?.[0]?.message;
    const args = message?.tool_calls?.[0]?.function?.arguments;
    if (args) return JSON.parse(args) as WorkoutContent;

    const contentText = contentToText(message?.content);
    const parsed = contentText ? parseWorkoutJson(contentText) : null;
    if (!parsed) {
      log("AI response missing workout JSON", {
        model: AI_MODEL,
        finishReason: d.choices?.[0]?.finish_reason,
        preview: contentText.slice(0, 240),
      });
      return null;
    }
    return parsed;
  } catch (e: any) {
    log("AI call error", { model: AI_MODEL, err: e.message });
  }
  return null;
}

function stripWorkoutProtocolHeaderDurations(html: string): string {
  return (html || "").replace(
    /(Main Workout|Finisher)\s*\(\s*(REPS\s*(?:&|&amp;)\s*SETS|TABATA|EMOM|AMRAP|FOR\s*TIME|CIRCUIT|MIX)[^)]*\)/gi,
    (_match, label: string, proto: string) => {
      const cleanProto = proto.replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim().toUpperCase();
      return `${label} (${cleanProto})`;
    },
  );
}

// Merge orphan tempo/rest <li> items into the previous <li>.
// Matches lines whose visible text is only things like:
//   "32X1", "@ 32X1", "rest 100s", "rest 100 seconds",
//   "32X1, rest 100s", "tempo 32X1, rest 100s", "31X1 rest 90 sec"
function mergeOrphanTempoRestBullets(html: string): string {
  if (!html) return html;
  const liRegex = /<li\b[^>]*>[\s\S]*?<\/li>/gi;
  const items = html.match(liRegex);
  if (!items || items.length < 2) return html;

  const visibleText = (li: string) =>
    li.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();

  // Strict orphan pattern: tempo code and/or rest directive only, no exercise token.
  const orphanPattern = /^(?:@\s*)?(?:tempo\s*[:\-]?\s*)?(?:\d{2}[X0-9]{2})?\s*[,;]?\s*(?:rest\s*[:\-]?\s*\d+\s*(?:s|sec|secs|seconds?|m|min|mins|minutes?))?\s*$/i;
  const containsExerciseToken = (s: string) => /\{\{exercise:/i.test(s);

  let result = html;
  for (let i = 1; i < items.length; i++) {
    const cur = items[i];
    const text = visibleText(cur);
    if (!text) continue;
    if (containsExerciseToken(cur)) continue;
    if (!orphanPattern.test(text)) continue;

    const prev = items[i - 1];
    if (!containsExerciseToken(prev)) continue;

    // Inject the orphan text at the end of the previous <li>'s last <p> (or before </li>).
    const inline = " @ " + text.replace(/^@\s*/, "").replace(/^tempo\s*[:\-]?\s*/i, "");
    let mergedPrev: string;
    if (/<\/p>\s*<\/li>\s*$/i.test(prev)) {
      mergedPrev = prev.replace(/<\/p>(\s*<\/li>\s*)$/i, inline + "</p>$1");
    } else {
      mergedPrev = prev.replace(/<\/li>\s*$/i, inline + "</li>");
    }
    // Remove the orphan <li> from the html and update prev in place.
    result = result.replace(cur, "");
    result = result.replace(prev, mergedPrev);
    items[i - 1] = mergedPrev;
  }
  // Collapse any empty <ul>...</ul> left behind or stray whitespace.
  result = result.replace(/<ul[^>]*>\s*<\/ul>/gi, "");
  return result;
}

function describeTempoCode(code: string): string {
  const phases = ["lower", "pause", "lift", "reset"];
  const parts = code.toUpperCase().split("").map((char, index) => {
    const phase = phases[index] || "phase";
    if (char === "X") return `explosive ${phase}`;
    if (char === "0") return `no ${phase}`;
    return `${char}-sec ${phase}`;
  });
  return `tempo ${parts.join(", ")}`;
}

function humanizeTempoRestInExerciseLines(html: string): string {
  if (!html) return html;
  return html.replace(/<li\b[^>]*>[\s\S]*?<\/li>/gi, (li) => {
    const tokenMatch = /\{\{exercise:[^}]+\}\}/i.exec(li);
    if (!tokenMatch) return li;

    const splitAt = tokenMatch.index + tokenMatch[0].length;
    const head = li.slice(0, splitAt);
    let tail = li.slice(splitAt);

    tail = tail.replace(
      /(?:@\s*|tempo\s*[:\-]?\s*)([0-9X]{4})\b(?:\s*[,;]?\s*rest\s*[:\-]?\s*(\d+)\s*(?:s|sec|secs|seconds?))?/gi,
      (_match, code: string, restSeconds?: string) => {
        const rest = restSeconds ? `; rest ${restSeconds} sec` : "";
        return ` — ${describeTempoCode(code)}${rest}`;
      },
    );
    tail = tail.replace(
      /\b([0-9X]{4})\b\s*[,;]?\s*rest\s*[:\-]?\s*(\d+)\s*(?:s|sec|secs|seconds?)\b/gi,
      (_match, code: string, restSeconds: string) => ` — ${describeTempoCode(code)}; rest ${restSeconds} sec`,
    );

    tail = tail.replace(/\s*,\s*rest\s*[:\-]?\s*(\d+)\s*(?:s|sec|secs|seconds?)\b/gi, "; rest $1 sec");
    tail = tail.replace(/\brest\s*[:\-]?\s*(\d+)\s*(?:s|sec|secs|seconds?)\b/gi, "rest $1 sec");
    tail = tail.replace(/\s+([,;])/g, "$1").replace(/\s{2,}/g, " ");

    return head + tail;
  });
}

function repairInvalidExerciseTokens(html: string, library: any[]): string {
  if (!html) return html;
  const libById = new Map(library.map((ex: any) => [String(ex.id), ex]));
  const byName = new Map(library.map((ex: any) => [String(ex.name).toLowerCase().trim(), ex]));

  return html.replace(/\{\{(?:exercise|exrcise|excersize|excercise):([^:}]+):([^}]+)\}\}/gi, (full, rawId: string, rawName: string) => {
    const id = String(rawId).trim();
    const name = String(rawName).trim();
    const exactId = libById.get(id);
    if (exactId) return `{{exercise:${exactId.id}:${exactId.name}}}`;
    const exactName = byName.get(name.toLowerCase());
    if (exactName) return `{{exercise:${exactName.id}:${exactName.name}}}`;
    return name;
  });
}

function relinkPlainMinuteParagraphs(html: string, library: any[], logPrefix = "[WIZ-MINUTE-P]"): string {
  if (!html) return html;
  return html.replace(/<p[^>]*>([\s\S]*?\bMinute\s+\d+\s*:[\s\S]*?)<\/p>/gi, (full, inner: string) => {
    if (/\{\{exercise:/i.test(inner)) return full;
    const wrapped = `<ul class="tiptap-bullet-list"><li class="tiptap-list-item"><p class="tiptap-paragraph">${inner}</p></li></ul>`;
    const linked = guaranteeAllExercisesLinked(wrapped, library, logPrefix).processedContent;
    const repaired = rejectNonLibraryExercises(linked, library, logPrefix).processedContent;
    const content = repaired.match(/<li[^>]*>\s*<p[^>]*>([\s\S]*?)<\/p>\s*<\/li>/i)?.[1]?.trim();
    return content ? `<p class="tiptap-paragraph">${content}</p>` : full;
  });
}

function extractIconSection(html: string, startIcon: string, endIcons: string[]): string {
  const start = html.indexOf(startIcon);
  if (start === -1) return "";
  const ends = endIcons.map((icon) => html.indexOf(icon, start + startIcon.length)).filter((idx) => idx > start);
  return html.slice(start, ends.length ? Math.min(...ends) : html.length);
}

function exerciseLines(section: string): string[] {
  return section
    .split(/<li[^>]*>/i)
    .slice(1)
    .map((seg) => (seg.split(/<\/li>/i)[0] || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim())
    .filter((line) => /\{\{exercise:/i.test(line));
}

function validatePrescriptionSafety(html: string, category: string): string[] {
  const failures: string[] = [];
  const main = extractIconSection(html, "💪", ["⚡", "🧘"]);
  const finisher = extractIconSection(html, "⚡", ["🧘"]);
  const sections = [
    { label: "Main Workout", html: main },
    { label: "Finisher", html: finisher },
  ];

  for (const section of sections) {
    const isRepsSets = /REPS\s*(?:&|&amp;)\s*SETS/i.test(section.html) || /STRENGTH|PILATES|MOBILITY & STABILITY/i.test(category || "");
    for (const line of exerciseLines(section.html)) {
      const tokenIndex = line.search(/\{\{exercise:[^}]+\}\}/i);
      const before = line.slice(0, tokenIndex).trim();
      const after = line.slice(tokenIndex).trim();

      const hasDoseBefore = /(?:\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?\s*(?:reps?|sec(?:onds?)?|s\b|min(?:utes?)?|m\b|meters?|km\b|cal(?:ories)?|rounds?)\b|\d+\s*(?:sets?\s*)?(?:x|×)\s*\d+(?:\s*-\s*\d+)?|minute\s+\d+)/i.test(before);
      if (!hasDoseBefore) failures.push(`${section.label}: missing reps/time/sets before exercise token — ${line.slice(0, 160)}`);

      const tempoWithoutDose = /^\{\{exercise:[^}]+\}\}\s*(?:@\s*)?\d{2}[0-9X]{2}\b/i.test(after) && !/\d+\s*(?:sets?\s*)?(?:x|×)\s*\d+/i.test(before);
      if (tempoWithoutDose) failures.push(`${section.label}: tempo code is present without sets × reps before the exercise — ${line.slice(0, 160)}`);

      if (isRepsSets) {
        const setRep = before.match(/(\d+)\s*(?:sets?\s*)?(?:x|×)\s*(\d+)(?:\s*-\s*(\d+))?/i);
        if (!setRep) failures.push(`${section.label}: REPS & SETS line must start with sets × reps — ${line.slice(0, 160)}`);
        if (setRep) {
          const sets = Number(setRep[1]);
          const reps = Number(setRep[3] || setRep[2]);
          if (sets < 1 || sets > 6) failures.push(`${section.label}: impossible set count (${sets}) — ${line.slice(0, 160)}`);
          if (reps < 1 || reps > 25) failures.push(`${section.label}: impossible rep target (${reps}) — ${line.slice(0, 160)}`);
        }
      }
    }
  }
  return failures;
}

async function nextSerial(supabase: any, category: string): Promise<{ id: string; serial: number }> {
  const prefix = CATEGORY_PREFIX[category] || "W";
  const { data: settings } = await supabase
    .from("system_settings")
    .select("setting_value")
    .eq("setting_key", "serial_number_counters")
    .single();

  let nextN = 1;
  if (settings?.setting_value?.workouts?.[category]) {
    nextN = settings.setting_value.workouts[category];
  } else {
    const { data } = await supabase
      .from("admin_workouts")
      .select("serial_number")
      .eq("category", category)
      .eq("is_workout_of_day", false)
      .order("serial_number", { ascending: false, nullsFirst: false })
      .limit(1);
    nextN = (data?.[0]?.serial_number || 0) + 1;
  }

  // bump counter
  const newCounters = {
    ...(settings?.setting_value || {}),
    workouts: {
      ...((settings?.setting_value?.workouts) || {}),
      [category]: nextN + 1,
    },
  };
  await supabase
    .from("system_settings")
    .upsert({ setting_key: "serial_number_counters", setting_value: newCounters }, { onConflict: "setting_key" });

  return { id: `${prefix}-${String(nextN).padStart(3, "0")}`, serial: nextN };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const unauthorizedResponse = await requireAdminOrServiceRole(req, corsHeaders);
  if (unauthorizedResponse) return unauthorizedResponse;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = (await req.json()) as WizardBody;
    if (!body?.category || !body?.equipment) throw new Error("category and equipment are required");

    const access = body.access || "free";
    const isMicro = body.category === "MICRO-WORKOUTS";
    const equipment = isMicro ? "BODYWEIGHT" : body.equipment;
    const duration = isMicro ? "5 min" : (body.duration || "30 min");
    const difficulty = difficultyLabel(body.difficulty_stars);
    const format = body.format || (body.category === "STRENGTH" || body.category === "PILATES" || body.category === "MOBILITY & STABILITY" ? "REPS & SETS" : "MIX");

    log("Wizard request", { category: body.category, equipment, difficulty, format, duration, access });

    // Build banned names
    const { data: allNames } = await supabase.from("admin_workouts").select("name");
    const bannedNames = (allNames || []).map((w: any) => w.name);

    // Library
    const equipFilter = equipment === "BODYWEIGHT" ? "body weight" : "non-bodyweight";
    const { exercises: library, referenceList } =
      await fetchAndBuildExerciseReference(supabase, "[WIZ]", equipFilter, difficulty.toLowerCase(), body.category);

    let lastErr = "";
    try {
        const prompt = buildPrompt({ body: { ...body, equipment, duration, format }, referenceList, bannedNames });
        const content = await callAI(lovableApiKey, prompt);
      if (!content) throw new Error("AI generation returned no usable workout JSON");

        // Sanitize internal-style codes/suffixes the model may have slipped in
        const stripInternalCodes = (n: string): string =>
          n
            .replace(/\s+\d{3,}[A-Z]*\b/gi, "")          // "813", "1230BW"
            .replace(/\s+[A-Z]{2,4}[-\s]?\d{2,}\b/g, "") // "CAL-813", "STR 204"
            .replace(/\s+(v\d+|#\d+)\b/gi, "")           // "v2", "#3"
            .replace(/\s+(II|III|IV|V|VI|VII|VIII|IX|X)\b/g, "")
            .replace(/\s+/g, " ")
            .trim();
        content.name = stripInternalCodes(content.name);

        // name collision → append the workout FORMAT word (Circuit, AMRAP, EMOM…)
        const norm = (s: string) => s.trim().toLowerCase();
        const taken = new Set(bannedNames.map((n: string) => norm(n)));
        if (taken.has(norm(content.name))) {
          const fmt = String(format || "").trim();
          const fmtWord = /amrap/i.test(fmt) ? "AMRAP"
            : /emom/i.test(fmt) ? "EMOM"
            : /tabata/i.test(fmt) ? "Tabata"
            : /for\s*time/i.test(fmt) ? "For Time"
            : /ladder/i.test(fmt) ? "Ladder"
            : /pyramid/i.test(fmt) ? "Pyramid"
            : /interval/i.test(fmt) ? "Intervals"
            : /circuit/i.test(fmt) ? "Circuit"
            : "Session";
          const categoryWord = body.category === "STRENGTH" ? "Strength"
            : body.category === "CALORIE BURNING" ? "Conditioning"
            : body.category === "METABOLIC" ? "Engine"
            : body.category === "CARDIO" ? "Cardio"
            : body.category === "MOBILITY & STABILITY" ? "Control"
            : body.category === "PILATES" ? "Pilates"
            : body.category === "RECOVERY" ? "Recovery"
            : body.category === "CHALLENGE" ? "Challenge"
            : "Training";
          const candidates = [
            `${content.name} ${fmtWord}`,
            `${content.name} ${categoryWord}`,
            `${content.name} ${categoryWord} ${fmtWord}`,
          ];
          const pick = candidates.find((c) => !taken.has(norm(c))) || `${content.name} ${fmtWord} ${categoryWord}`;
          content.name = pick;
        }

        // exercise markup cleanup
        const libById = new Map(library.map((ex: any) => [ex.id, ex]));
        const markupPattern = /\{\{(?:exercise|exrcise|excersize|excercise):([^:]+):([^}]+)\}\}/gi;
        const invalidIds: string[] = [];
        let m: RegExpExecArray | null;
        while ((m = markupPattern.exec(content.main_workout)) !== null) {
          if (!libById.has(m[1])) invalidIds.push(`${m[1]}:${m[2]}`);
        }
        if (invalidIds.length > 0) {
          let cleaned = content.main_workout;
          for (const inv of invalidIds) {
            const [id, name] = inv.split(":");
            cleaned = cleaned.replace(
              new RegExp(`\\{\\{(?:exercise|exrcise|excersize|excercise):${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:[^}]+\\}\\}`, "gi"),
              name
            );
          }
          content.main_workout = cleaned;
        }

        content.main_workout = repairInvalidExerciseTokens(content.main_workout, library);

        const matched = processContentSectionAware(content.main_workout, library, `[WIZ-MATCH]`);
        content.main_workout = matched.processedContent;
        const sweep = guaranteeAllExercisesLinked(content.main_workout, library, `[WIZ-SWEEP]`);
        content.main_workout = sweep.processedContent;
        const reject = rejectNonLibraryExercises(content.main_workout, library, `[WIZ-REJECT]`);
        content.main_workout = reject.processedContent;
        content.main_workout = relinkPlainMinuteParagraphs(content.main_workout, library);
        content.main_workout = repairStaticHoldPrescriptions(content.main_workout, `[WIZ-HOLD-RX]`).processedContent;
        content.main_workout = removeStaticHoldsFromMomentumSections(content.main_workout, `[WIZ-HOLD-PLACEMENT]`).processedContent;

        const trulyUnmatched = [...new Set(matched.unmatched)].filter(n =>
          !sweep.forcedMatches.some(f => f.original.toLowerCase() === n.toLowerCase()) &&
          !reject.substituted.some(s => s.original.toLowerCase() === n.toLowerCase())
        );
        if (trulyUnmatched.length > 0) {
          await logUnmatchedExercises(supabase as any, trulyUnmatched, "workout", `WIZ-${body.category}`, content.name, `[WIZ-MISMATCH]`);
        }

        const mergedOrphans = mergeOrphanTempoRestBullets(content.main_workout);
        content.main_workout = humanizeTempoRestInExerciseLines(mergedOrphans);
        const protocolSweep = sanitizeProtocolBlocks(stripWorkoutProtocolHeaderDurations(content.main_workout));
      if (protocolSweep.flaggedForReview.length > 0) {
        log("Protocol review warnings (continuing)", {
          issues: protocolSweep.flaggedForReview.slice(0, 6).map((i) => `${i.type}: ${i.detail}`),
        });
      }

        const mainNorm = normalizeWorkoutHtml(protocolSweep.cleaned);
        const descNorm = normalizeWorkoutHtml(content.description || "");
        const insNorm = normalizeWorkoutHtml(content.instructions || "");
        const tipsNorm = normalizeWorkoutHtml(content.tips || "");

        const reviewWarnings: string[] = [];
        const htmlValid = validateWorkoutHtml(mainNorm);
        if (!htmlValid.isValid) {
          reviewWarnings.push(...htmlValid.issues.map((issue) => `HTML: ${issue}`));
          log("HTML validation issues (continuing)", { issues: htmlValid.issues });
        }

        // Section validator only enforces 5-section for non-micro
        if (!isMicro) {
          const sectionCheck = validateWodSections(mainNorm, false, body.category);
          if (!sectionCheck.isComplete) {
            reviewWarnings.push(`Section validation: missing=[${sectionCheck.missingSections.join(", ")}], issues=[${[...sectionCheck.exerciseContentIssues, ...sectionCheck.softTissueIssues, ...sectionCheck.mobilityCompatibilityIssues].join("; ")}]`);
          }

          const protocolIssues = validateProtocolBlocks(mainNorm);
          if (protocolIssues.length > 0) {
            reviewWarnings.push(`Protocol validation: ${protocolIssues.slice(0, 4).join("; ")}`);
          }

          const qualityGate = applyWodQualityGate({
            mainWorkoutHtml: mainNorm,
            category: body.category,
            difficultyStars: body.difficulty_stars,
            format,
            isRecoveryDay: body.category === "RECOVERY",
          });
          if (!qualityGate.ok) {
            reviewWarnings.push(`Quality gate: ${qualityGate.failures.slice(0, 4).join("; ")}`);
          }
        }

        const prescriptionSafetyIssues = validatePrescriptionSafety(mainNorm, body.category);
        if (prescriptionSafetyIssues.length > 0) {
          reviewWarnings.push(`Prescription safety: ${prescriptionSafetyIssues.slice(0, 4).join("; ")}`);
        }

        // ────────────────────────────────────────────────────────────────
        // QUALITY CONTRACT (advisory): we still deliver the draft so the
        // admin can fix it in the editor instead of burning AI credits on a
        // hard regenerate. Any failures are surfaced as review warnings and
        // force needs_review = true, so a broken draft cannot be saved
        // silently — the admin sees exactly what to fix.
        // ────────────────────────────────────────────────────────────────
        const contract = validateGeneratedWorkoutContract(mainNorm, library as any, {
          isMicro,
          isRecovery: body.category === "RECOVERY",
          category: body.category,
        });
        if (!contract.ok) {
          log("⚠️ Quality contract warnings (delivering draft)", { failures: contract.failures.slice(0, 8) });
          reviewWarnings.push(
            `Quality contract: ${contract.failures.slice(0, 6).join("; ")}`,
          );
        }

        // Preview-only draft. Saving / Stripe / image / serial is the editor's job.
        const draft = {
          // id/serial intentionally omitted — the editor's open-as-new flow
          // (workout && !workout.id) will allocate them when the admin saves.
          name: content.name,
          category: body.category,
          format,
          equipment,
          difficulty,
          difficulty_stars: body.difficulty_stars,
          duration,
          description: descNorm,
          main_workout: mainNorm,
          instructions: insNorm,
          tips: tipsNorm,
          focus: body.category === "STRENGTH" ? (body.focus || "") : "",
          image_url: "",
          generate_unique_image: true,
          is_free: access === "free",
          is_premium: access === "premium",
          tier_required: access === "premium" ? (body.tier_required || "premium") : "",
          is_standalone_purchase: access === "standalone",
          price: access === "standalone" ? String(body.price ?? "") : "",
          stripe_product_id: "",
          stripe_price_id: "",
          needs_review: reviewWarnings.length > 0,
          generation_review_warnings: reviewWarnings,
        };

      log("✅ Drafted (not saved)", { name: content.name, reviewWarnings: reviewWarnings.length });
      return new Response(JSON.stringify({ ok: true, draft, needs_review: reviewWarnings.length > 0, review_warnings: reviewWarnings }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e: any) {
      lastErr = e.message || String(e);
      log("Generation failed without retry", { err: lastErr });
    }

    return new Response(JSON.stringify({ ok: false, error: lastErr || "exhausted retries" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    log("Fatal", { err: e.message });
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});