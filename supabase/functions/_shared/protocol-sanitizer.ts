/**
 * Protocol block sanitizer + structural validator.
 *
 * Enforces (memory: protocol-block-formatting-standard):
 *  1. No durations after TABATA / EMOM / AMRAP / FOR TIME inside section headers.
 *  2. No stray text glued to an `{{exercise:ID:Name}}` token.
 *  3. EMOM blocks with explicit `Minute N:` labels must be sequential
 *     (1..N) with no orphan exercise after the last labelled minute.
 *  4. No naked exercise prescriptions in Main Workout / Finisher protocol blocks.
 */

export interface ProtocolIssue {
  type:
    | "duration_in_header"
    | "stray_after_token"
    | "emom_orphan_exercise"
    | "emom_minute_gap"
    | "naked_exercise_prescription"
    | "mixed_rep_time_prescription"
    | "stimulus_mismatch"
     | "bare_exercise_in_warmup_or_cooldown"
     | "emom_minute_order_repaired";
  detail: string;
  snippet?: string;
}

export interface ProtocolSanitizeResult {
  cleaned: string;
  bugsFound: ProtocolIssue[];
  fixesApplied: string[];
  flaggedForReview: ProtocolIssue[];
}

const HEADER_PROTOCOLS = ["TABATA", "EMOM", "AMRAP", "FOR\\s*TIME"];

// Known library exercises that frequently get written as plain text inside
// Activation (🔥) and Cool Down (🧘) sections. When found as bare words there,
// they should be linked via {{exercise:…}} tokens. List intentionally short
// and high-precision to avoid false positives.
const COMMON_BARE_EXERCISE_NAMES = [
  "Bird Dog",
  "Glute Bridge",
  "Jumping Jacks",
  "High Knees",
  "Butt Kicks",
  "Mountain Climber",
  "Mountain Climbers",
  "Hamstring Stretch",
  "Butterfly",
  "Lying Quad Stretch",
  "Lying Quads Stretch",
  "Cat-Cow Stretch",
  "Cat-cow",
  "Cat Cow",
  "Air Squats",
  "Push-Up",
  "Push-Ups",
  "Plank",
  "Forearm Plank",
];

// Stimulus categories: tokens whose linked exercise category does NOT match the
// surrounding sentence intent should be rejected. We can't read the exercise
// library at sanitize time, but we can flag the obvious editorial mismatch:
// any token sitting inside a paragraph that mentions breathing or meditation.
const BREATHING_CONTEXT_RE = /\b(diaphragmatic|breathing|breath\s+work|meditation|box\s*breathing|inhale|exhale)\b/i;

/**
 * Strips trailing duration tokens after a protocol keyword inside section headers.
 * Examples cleaned:
 *   "Main Workout (TABATA 24')"    -> "Main Workout (TABATA)"
 *   "Finisher (15-minute EMOM)"    -> "Finisher (EMOM)"
 *   "Finisher (EMOM 10')"          -> "Finisher (EMOM)"
 *   "Main Workout (AMRAP 12 min)"  -> "Main Workout (AMRAP)"
 */
function stripDurationFromHeaders(html: string, issues: ProtocolIssue[], fixes: string[]): string {
  let out = html;

  // Pattern A: PROTOCOL <number>['" min minutes]
  const trailingDuration = new RegExp(
    `\\b(${HEADER_PROTOCOLS.join("|")})\\s*[-–]?\\s*\\d+\\s*('|\\\"|min(?:ute)?s?)?`,
    "gi",
  );

  // Pattern B: <number>['" min minutes][-]PROTOCOL  (e.g. "15-minute EMOM")
  const leadingDuration = new RegExp(
    `\\b\\d+\\s*('|\\\"|-?\\s*min(?:ute)?s?)\\s*[-–]?\\s*(${HEADER_PROTOCOLS.join("|")})\\b`,
    "gi",
  );

  out = out.replace(trailingDuration, (match, proto) => {
    issues.push({ type: "duration_in_header", detail: match, snippet: match });
    fixes.push(`Removed duration from "${match}" → "${proto.toUpperCase()}"`);
    return proto.toUpperCase();
  });

  out = out.replace(leadingDuration, (match, _suffix, proto) => {
    issues.push({ type: "duration_in_header", detail: match, snippet: match });
    fixes.push(`Removed duration from "${match}" → "${proto.toUpperCase()}"`);
    return proto.toUpperCase();
  });

  return out;
}

/**
 * Removes pure-noise stray text that follows directly after `}}` of an exercise token.
 * Auto-removes obvious noise like "}}20 sec interval)", "}} - 30 seconds".
 * Flags ambiguous continuations (like "}} (left side)") for human review WITHOUT modifying.
 */
function cleanStrayAfterToken(
  html: string,
  issues: ProtocolIssue[],
  fixes: string[],
  flagged: ProtocolIssue[],
): string {
  // Match exercise tokens followed by text before the next HTML tag/end of line.
  // Common AI mistake: {{exercise:ID:Name}}:Name or {{exercise:ID:Name}} Name.
  // When the trailing text is just a duplicate of the token's display name, safely remove it.
  const pattern = /(\{\{exercise:[^:}]+:([^}]+)\}\})([^<\n]*?)(?=<|$)/gi;

  const isBenignTokenQualifier = (value: string): boolean => {
    const normalized = value
      .trim()
      .replace(/^[:\-–—,;\s]+/, "")
      .replace(/^\((.*)\)$/s, "$1")
      .replace(/[.,;:]$/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

    return /^(?:left|right|both|each|alternating)\s+(?:side|sides|leg|legs|arm|arms|shoulder|shoulders|hip|hips|knee|knees|ankle|ankles|wrist|wrists|foot|feet|hand|hands)$/.test(normalized)
      || /^\d+(?:\s*-\s*\d+)?\s+(?:each|per)\s+(?:side|leg|legs|arm|arms)$/.test(normalized)
      || /^(?:each|per)\s+(?:side|leg|legs|arm|arms)$/.test(normalized);
  };

  return html.replace(pattern, (match, token, exerciseName, trailing) => {
    const trimmed = trailing.trim();
    if (trimmed.length === 0) return match; // pure whitespace, fine

    const normalize = (s: string) => s
      .replace(/^[:\-–—\s]+/, "")
      .replace(/[\-–—.,;:()\[\]{}]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    const trailingNormalized = normalize(trimmed);
    const exerciseNormalized = normalize(exerciseName || "");
    if (exerciseNormalized && trailingNormalized.startsWith(exerciseNormalized)) {
      issues.push({
        type: "stray_after_token",
        detail: trimmed.slice(0, 120),
        snippet: `${token}${trimmed.slice(0, 120)}`,
      });
      fixes.push(`Removed duplicated exercise text after token: "${trimmed.slice(0, 60)}"`);
      return token;
    }

    // Specific generator/linker artifact seen with versioned library names such as
    // `{{exercise:0735:sit-up v. 2}}-up v. 2-up v. 2...`: the replacement matched
    // only the `sit` prefix and left the `-up v. 2` suffix repeated after the token.
    // Keep the valid library token and remove only repeated suffix fragments.
    const exerciseWords = exerciseNormalized.split(" ").filter(Boolean);
    const suffixPattern = exerciseWords.length >= 2
      ? exerciseWords.slice(1).join("\\s+")
      : "";
    const repeatedExerciseSuffix = suffixPattern
      ? new RegExp(`^(?:${suffixPattern}\\s*){1,}$`, "i").test(trailingNormalized)
      : false;
    const repeatedVersionSuffix = /^up\s+v\s+2(?:\s+up\s+v\s+2)*$/i.test(trailingNormalized);
    if (repeatedExerciseSuffix || repeatedVersionSuffix) {
      issues.push({
        type: "stray_after_token",
        detail: trimmed.slice(0, 120),
        snippet: `${token}${trimmed.slice(0, 120)}`,
      });
      fixes.push(`Removed duplicated exercise suffix after token: "${trimmed.slice(0, 60)}"`);
      return token;
    }

    if (isBenignTokenQualifier(trimmed)) {
      return match;
    }

    // Heuristic: if it starts with a digit, "sec", "interval", or an orphan ")",
    // treat as auto-removable noise.
    const noisePattern = /^(\d|\)|sec\b|interval\b|-?\s*\d+\s*sec|,\s*and\s)/i;
    if (noisePattern.test(trimmed)) {
      issues.push({
        type: "stray_after_token",
        detail: trimmed,
        snippet: `}}${trimmed}`,
      });
      fixes.push(`Removed stray noise after exercise token: "${trimmed.slice(0, 60)}"`);
      return token; // drop the trailing junk
    }

    // Anything else: flag, keep as-is for human review.
    flagged.push({
      type: "stray_after_token",
      detail: trimmed.slice(0, 120),
      snippet: `}}${trimmed.slice(0, 120)}`,
    });
    return match;
  });
}

/**
 * Detects EMOM finisher/main blocks that mix `Minute N:` labels with orphan exercises
 * that have no minute label after the last labelled minute.
 * We FLAG these (not auto-fix) because the correct rep scheme is editorial.
 */
function detectEmomOrphans(html: string, flagged: ProtocolIssue[]) {
  // For each <ul>...</ul> block that contains "Minute" labels, check the last <li>
  const ulPattern = /<ul[^>]*>([\s\S]*?)<\/ul>/g;
  let ulMatch: RegExpExecArray | null;

  while ((ulMatch = ulPattern.exec(html)) !== null) {
    const block = ulMatch[1];
    if (!/<strong>Minute\s+\d+/i.test(block)) continue;

    const items = block.match(/<li[^>]*>[\s\S]*?<\/li>/g) || [];
    if (items.length === 0) continue;

    const minuteNumbers: number[] = [];
    items.forEach((li) => {
      const m = li.match(/<strong>Minute\s+(\d+)/i);
      if (m) minuteNumbers.push(parseInt(m[1], 10));
    });

    // Orphan: more list items than minute labels
    if (minuteNumbers.length > 0 && minuteNumbers.length < items.length) {
      flagged.push({
        type: "emom_orphan_exercise",
        detail: `EMOM block has ${items.length} bullets but only ${minuteNumbers.length} minute labels`,
      });
    }

    // Gap: minute labels not sequential
    const sorted = [...minuteNumbers].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i] !== i + 1) {
        flagged.push({
          type: "emom_minute_gap",
          detail: `EMOM minutes are not sequential: [${sorted.join(", ")}]`,
        });
        break;
      }
    }
  }
}

function normalizeEmomMinuteBlocks(html: string, issues: ProtocolIssue[], fixes: string[]): string {
  const sectionRe = /(<p[^>]*>\s*(?:💪|⚡)\s*<strong><u>\s*(?:Main Workout|Finisher)\s*\(\s*EMOM\s*\)\s*<\/u><\/strong>\s*<\/p>)([\s\S]*?)(?=<p[^>]*>\s*(?:🧘|⚡|💪|🔥|🧽)|$)/gi;

  return html.replace(sectionRe, (_section, header: string, body: string) => {
    const minuteEntries: Array<{ minute: number; html: string }> = [];
    let changed = false;

    const removeAndCollect = (source: string, itemRe: RegExp): string => source.replace(itemRe, (full: string, inner: string) => {
      const text = stripTags(inner || "");
      const m = text.match(/\bMinute\s+(\d+)\s*:/i);
      if (!m) return full;
      const minute = Number(m[1]);
      if (!Number.isFinite(minute)) return full;
      const normalizedInner = inner.replace(/(?:<strong>)?\s*Minute\s+\d+\s*:\s*(?:<\/strong>)?/i, `<strong>Minute ${minute}:</strong> `);
      minuteEntries.push({
        minute,
        html: `<li class="tiptap-list-item"><p class="tiptap-paragraph">${normalizedInner.trim()}</p></li>`,
      });
      changed = true;
      return "";
    });

    let cleanedBody = removeAndCollect(body, /<li[^>]*>\s*<p[^>]*>([\s\S]*?\bMinute\s+\d+\s*:[\s\S]*?)<\/p>\s*<\/li>/gi);
    cleanedBody = removeAndCollect(cleanedBody, /<p[^>]*>([\s\S]*?\bMinute\s+\d+\s*:[\s\S]*?)<\/p>/gi);

    if (minuteEntries.length < 2) return `${header}${body}`;

    minuteEntries.sort((a, b) => a.minute - b.minute);
    cleanedBody = cleanedBody.replace(/<ul[^>]*>\s*<\/ul>/gi, "");
    const list = `<ul class="tiptap-bullet-list">${minuteEntries.map((entry) => entry.html).join("")}</ul>`;
    const rebuilt = `${header}${cleanedBody}${list}`;

    if (changed) {
      issues.push({
        type: "emom_minute_order_repaired",
        detail: `Rebuilt EMOM minute list in order: ${minuteEntries.map((entry) => entry.minute).join(", ")}`,
      });
      fixes.push("Converted loose EMOM Minute paragraphs into one ordered bullet list");
    }
    return rebuilt;
  });
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function getMainAndFinisherItems(html: string): Array<{ section: string; format: string; text: string }> {
  const items: Array<{ section: string; format: string; text: string }> = [];
  const sectionPattern = /<p[^>]*>\s*(💪|⚡)\s*<strong><u>\s*([^<]+?)\s*<\/u><\/strong>\s*<\/p>([\s\S]*?)(?=<p[^>]*>\s*(?:🧘|⚡|💪|🔥|🧽)|$)/gi;
  let sectionMatch: RegExpExecArray | null;

  while ((sectionMatch = sectionPattern.exec(html)) !== null) {
    const sectionTitle = stripTags(sectionMatch[2] || "");
    const body = sectionMatch[3] || "";
    const formatMatch = sectionTitle.match(/\(([^)]+)\)/);
    const format = (formatMatch?.[1] || sectionTitle).toUpperCase();
    const liPattern = /<li[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>[\s\S]*?<\/li>/gi;
    let liMatch: RegExpExecArray | null;
    while ((liMatch = liPattern.exec(body)) !== null) {
      const raw = liMatch[1] || "";
      if (/\{\{exercise:[^}]+\}\}/i.test(raw)) {
        items.push({ section: sectionTitle, format, text: stripTags(raw) });
      }
    }
  }

  return items;
}

function hasClearPrescriptionBeforeExercise(text: string, format: string): boolean {
  // Tabata timing is the protocol itself: 20s work / 10s rest x 8 rounds per exercise.
  if (/TABATA/i.test(format)) return true;

  const tokenIndex = text.search(/\{\{exercise:[^}]+\}\}/i);
  if (tokenIndex < 0) return true;
  const before = text.slice(0, tokenIndex).trim();

  // Accept explicit reps, time, distance, calories, rounds, sets, labelled EMOM minutes,
  // or a bare number used as reps, only when they appear before the exercise token.
  return /(?:^|\b)(?:minute\s+\d+\s*:)?\s*(?:\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?\s*(?:reps?|sec(?:onds?)?|s\b|min(?:utes?)?|m\b|meters?|metres?|km\b|kilometers?|kilometres?|mi\b|miles?|cal(?:ories)?|kcal|rounds?|sets?)\b|\d+\s*(?:x|×)\s*\d+|\d+(?:\s*-\s*\d+)?\s*$|amrap\s+\d+)/i.test(before);
}

function detectNakedExercisePrescriptions(html: string, flagged: ProtocolIssue[]) {
  for (const item of getMainAndFinisherItems(html)) {
    if (!hasClearPrescriptionBeforeExercise(item.text, item.format)) {
      flagged.push({
        type: "naked_exercise_prescription",
        detail: `${item.section}: exercise token has no reps, time, distance, calories, or sets before it`,
        snippet: item.text.slice(0, 180),
      });
    }
  }
}

function detectMixedRepTimePrescriptions(html: string, flagged: ProtocolIssue[]) {
  for (const item of getMainAndFinisherItems(html)) {
    const tokenIndex = item.text.search(/\{\{exercise:[^}]+\}\}/i);
    if (tokenIndex < 0) continue;

    const before = item.text.slice(0, tokenIndex).trim();
    const after = item.text.slice(tokenIndex).trim();
    const bareNumberOnly = /^\d+(?:\s*-\s*\d+)?$/.test(before);
    const timedHoldAfterToken = /\b(?:hold|hold\s+for|hold\s+each|for)\s+\d+\s*(?:sec|seconds?|s\b|min|minutes?)\b/i.test(after);

    if (bareNumberOnly && timedHoldAfterToken) {
      flagged.push({
        type: "mixed_rep_time_prescription",
        detail: `${item.section}: bare reps before a timed hold creates an impossible mixed prescription`,
        snippet: item.text.slice(0, 180),
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// New: Stimulus mismatch — token inside a breathing/meditation paragraph.
// Blocking: a sit-up token in "Diaphragmatic Breathing" is a coaching error.
// ─────────────────────────────────────────────────────────────────────────────
function detectStimulusMismatch(html: string, flagged: ProtocolIssue[]) {
  // Inspect every <p>…</p> and <li>…</li> independently so a breathing
  // paragraph in the cool-down can't poison unrelated bullets.
  const blockPattern = /<(p|li)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = blockPattern.exec(html)) !== null) {
    const block = m[2] || "";
    const text = stripTags(block);
    if (!BREATHING_CONTEXT_RE.test(text)) continue;
    if (!/\{\{exercise:[^}]+\}\}/i.test(block)) continue;
    flagged.push({
      type: "stimulus_mismatch",
      detail: "Exercise token placed inside a breathing/meditation paragraph",
      snippet: text.slice(0, 180),
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// New: Bare common-exercise names inside Activation (🔥) or Cool Down (🧘).
// These same exercises are usually linked elsewhere in the same workout, so a
// plain-text mention is almost always a missed link. Non-blocking (flagged).
// ─────────────────────────────────────────────────────────────────────────────
function detectBareExerciseInWarmupOrCooldown(html: string, flagged: ProtocolIssue[]) {
  const sectionPattern = /(🔥|🧘)([\s\S]*?)(?=🧽|🔥|💪|⚡|🧘|$)/g;
  let m: RegExpExecArray | null;
  // Skip the first emoji match itself; scan the body
  while ((m = sectionPattern.exec(html)) !== null) {
    const body = m[2] || "";
    // Strip linked tokens so we don't flag the linked Name inside `{{...:Name}}`.
    const stripped = body.replace(/\{\{exercise:[^}]+\}\}/gi, " ");
    const text = stripTags(stripped);
    for (const name of COMMON_BARE_EXERCISE_NAMES) {
      const re = new RegExp(`\\b${name.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "i");
      if (re.test(text)) {
        flagged.push({
          type: "bare_exercise_in_warmup_or_cooldown",
          detail: `Bare exercise name "${name}" in ${m[1] === "🔥" ? "Activation" : "Cool Down"} — should be a {{exercise:…}} token`,
          snippet: text.slice(0, 180),
        });
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// New: Auto-wrap loose <p> sub-blocks inside Activation (🔥) so labels like
// "Dynamic Mobility (5 min):", "Core Activation (5 min):", "Movement Prep
// (5 min):" each become their own <ul> with at least one <li> sibling,
// matching the gold-standard structure.
// Conservative: only wraps when a label paragraph is immediately followed by
// a <p> that contains an exercise token or a numeric prescription.
// ─────────────────────────────────────────────────────────────────────────────
function wrapLooseActivationSubBlocks(
  html: string,
  fixes: string[],
): string {
  const labelRe = /(<p[^>]*>\s*<strong>(?:Dynamic Mobility|Core Activation|Movement Prep|Movement Preparation)[^<]*<\/strong>\s*<\/p>)\s*(<p[^>]*>(?!\s*<strong>)([\s\S]*?)<\/p>)/gi;
  let changed = false;
  const out = html.replace(labelRe, (_full, labelP: string, looseP: string, looseBody: string) => {
    const body = looseBody || "";
    // Only wrap when the loose paragraph carries an exercise token or a
    // measurable prescription — otherwise it's coaching text and should stay.
    if (!/\{\{exercise:[^}]+\}\}/i.test(body) && !/\b\d+\s*(reps?|sec|seconds?|min|minutes?)\b/i.test(body)) {
      return `${labelP}${looseP}`;
    }
    changed = true;
    return `${labelP}<ul class="tiptap-bullet-list"><li class="tiptap-list-item"><p class="tiptap-paragraph">${body}</p></li></ul>`;
  });
  if (changed) fixes.push("Wrapped loose <p> after Activation sub-block label into a bullet list");
  return out;
}

export function sanitizeProtocolBlocks(input: string | null | undefined): ProtocolSanitizeResult {
  const original = input || "";
  const issues: ProtocolIssue[] = [];
  const fixes: string[] = [];
  const flagged: ProtocolIssue[] = [];

  let cleaned = original;
  cleaned = stripDurationFromHeaders(cleaned, issues, fixes);
  cleaned = normalizeEmomMinuteBlocks(cleaned, issues, fixes);
  // PRE-STEP: auto-insert a single space when text is glued directly after
  // an exercise token (`}}foo` -> `}} foo`). This is purely cosmetic but
  // unblocks the hard validator below, which forbids `}}` followed by any
  // non-whitespace, non-tag character. Safe — never deletes content.
  cleaned = cleaned.replace(/\}\}([^\s<])/g, (match, next) => {
    issues.push({
      type: "stray_after_token",
      detail: `auto-spaced after token before "${next}"`,
      snippet: `}}${next}`,
    });
    fixes.push("Inserted missing space after exercise token");
    return `}} ${next}`;
  });
  cleaned = cleanStrayAfterToken(cleaned, issues, fixes, flagged);
  cleaned = wrapLooseActivationSubBlocks(cleaned, fixes);
  detectEmomOrphans(cleaned, flagged);
  detectNakedExercisePrescriptions(cleaned, flagged);
  detectMixedRepTimePrescriptions(cleaned, flagged);
  detectStimulusMismatch(cleaned, flagged);
  detectBareExerciseInWarmupOrCooldown(cleaned, flagged);

  return {
    cleaned,
    bugsFound: issues,
    fixesApplied: fixes,
    flaggedForReview: flagged,
  };
}

/**
 * Hard validator used by the live WOD generator: returns an array of blocking
 * issues that should trigger a regeneration.
 */
export function validateProtocolBlocks(html: string): string[] {
  const issues: string[] = [];

  if (
    new RegExp(`\\b(${HEADER_PROTOCOLS.join("|")})\\s*\\d`, "i").test(html) ||
    /\b\d+\s*-?\s*minute\s+(EMOM|TABATA|AMRAP)/i.test(html)
  ) {
    issues.push("Header contains duration after a protocol keyword (TABATA/EMOM/AMRAP/FOR TIME)");
  }

  if (/\}\}[^\s<]/.test(html)) {
    issues.push("Stray text glued to an exercise token (no whitespace between `}}` and following text)");
  }

  const nakedItems: ProtocolIssue[] = [];
  detectNakedExercisePrescriptions(html, nakedItems);
  detectMixedRepTimePrescriptions(html, nakedItems);
  for (const item of nakedItems) {
    issues.push(`Invalid exercise prescription: ${item.detail}${item.snippet ? ` [${item.snippet}]` : ""}`);
  }

  // Blocking: stimulus mismatch (token inside breathing/meditation paragraph)
  const mismatchItems: ProtocolIssue[] = [];
  detectStimulusMismatch(html, mismatchItems);
  for (const item of mismatchItems) {
    issues.push(`Stimulus mismatch: ${item.detail}${item.snippet ? ` [${item.snippet}]` : ""}`);
  }

  // EMOM orphan check (blocking)
  const ulPattern = /<ul[^>]*>([\s\S]*?)<\/ul>/g;
  let ulMatch: RegExpExecArray | null;
  while ((ulMatch = ulPattern.exec(html)) !== null) {
    const block = ulMatch[1];
    if (!/<strong>Minute\s+\d+/i.test(block)) continue;
    const items = block.match(/<li[^>]*>[\s\S]*?<\/li>/g) || [];
    const labels = items.filter((li) => /<strong>Minute\s+\d+/i.test(li)).length;
    if (labels > 0 && labels < items.length) {
      issues.push(`EMOM block has ${items.length} bullets but only ${labels} labelled minutes (orphan exercise)`);
      break;
    }
  }

  return issues;
}