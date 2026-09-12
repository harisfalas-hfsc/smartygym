// Client-safe parser: workout HTML -> ordered playable steps.
import { EXERCISE_TOKEN_RE, isLibraryId, stripHtml, stripTokens } from "./tokens.ts";
import { canonicalSection, type SectionName } from "./spec.ts";

export type WorkoutStep = {
  exerciseId: string;
  name: string;
  prescription: string;
  section: SectionName;
  subSection: string | null;
};

const BLOCK_RE = /<(p|li|h1|h2|h3|h4)\b[^>]*>([\s\S]*?)<\/\1>/gi;

function detectSubSection(text: string): string | null {
  const t = text.toLowerCase();
  const round = text.match(/\bround\s+(\d+)\b/i);
  const block = text.match(/\bblock\s+(\d+)\b/i);
  if (t.includes("tabata")) return "Tabata";
  if (t.includes("amrap")) return "AMRAP";
  if (t.includes("emom")) return "EMOM";
  if (block) return `Block ${block[1]}`;
  if (round) return `Round ${round[1]}`;
  return null;
}

/**
 * Walks the workout HTML in document order and produces one step per valid
 * exercise token. Invalid / unlinked tokens are excluded.
 */
export function parseWorkoutSteps(html: string): WorkoutStep[] {
  if (!html) return [];
  const steps: WorkoutStep[] = [];
  let section: SectionName = "Main Workout";
  let subSection: string | null = null;

  // Unwrap list items that only wrap a paragraph so every block is scanned once.
  const flat = html.replace(/<li\b[^>]*>\s*(<p\b[\s\S]*?<\/p>)\s*<\/li>/gi, "$1");

  const re = new RegExp(BLOCK_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(flat))) {
    const inner = m[2] ?? "";
    if (/<(p|li)\b/i.test(inner)) continue; // container, children handled separately
    const text = stripHtml(inner);
    if (!text) continue;

    const tokenRe = new RegExp(EXERCISE_TOKEN_RE.source, "g");
    const tokens: Array<{ id: string; name: string; raw: string }> = [];
    let t: RegExpExecArray | null;
    while ((t = tokenRe.exec(inner))) {
      tokens.push({ id: t[1]!, name: (t[2] ?? "").trim(), raw: t[0]! });
    }

    if (tokens.length === 0) {
      const heading = canonicalSection(text);
      if (heading) {
        section = heading;
        subSection = null;
      }
      const sub = detectSubSection(text);
      if (sub) subSection = sub;
      continue;
    }

    const inlineSub = detectSubSection(stripTokens(text)) ?? subSection;

    for (const token of tokens) {
      if (!isLibraryId(token.id)) continue;
      let prescription = stripTokens(text);
      prescription = prescription.replace(token.name, " ");
      prescription = prescription.replace(/\s{2,}/g, " ").replace(/^[\s—–-]+|[\s—–-]+$/g, "").trim();
      steps.push({
        exerciseId: token.id,
        name: token.name,
        prescription,
        section,
        subSection: inlineSub,
      });
    }
  }
  return steps;
}

/**
 * Pulls the plain-text Soft Tissue Preparation lines. That section never
 * carries exercise tokens, so the player shows it as one standardised slide.
 */
export function extractSoftTissue(html: string): string[] {
  if (!html) return [];
  const start = html.search(/🧽/);
  if (start === -1) return [];
  const rest = html.slice(start);
  const end = rest.search(/🔥|💪|⚡|🧘/);
  const body = end === -1 ? rest : rest.slice(0, end);
  const lines: string[] = [];
  for (const m of body.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
    const text = stripTokens(stripHtml(m[1] ?? "")).trim();
    if (text) lines.push(text);
  }
  return lines;
}

export type PlayerSlide =
  | { kind: "soft-tissue"; lines: string[] }
  | { kind: "exercise"; step: WorkoutStep; stepIndex: number }
  | { kind: "break"; previous: SectionName; next: SectionName };

/** Inserts a section-break slide whenever the section changes. */
export function buildSlides(steps: WorkoutStep[], softTissue: string[] = []): PlayerSlide[] {
  const slides: PlayerSlide[] = [];
  if (softTissue.length) slides.push({ kind: "soft-tissue", lines: softTissue });
  steps.forEach((step, i) => {
    const prev = steps[i - 1];
    if (prev && prev.section !== step.section) {
      slides.push({ kind: "break", previous: prev.section, next: step.section });
    }
    slides.push({ kind: "exercise", step, stepIndex: i });
  });
  return slides;
}


export type StepTiming =
  | { mode: "manual" }
  | { mode: "timed"; seconds: number }
  | { mode: "tabata"; work: number; rest: number; rounds: number };

const REST_FRAGMENT_RE = /rest[^.;]*?\d+\s*(sec|secs|seconds|s|min|minutes|m)\b/gi;

/** Decides how (or whether) a step is timed. Rest fragments never count as work. */
export function parseStepTiming(step: {
  prescription: string;
  section?: string;
  subSection?: string | null;
}): StepTiming {
  const all = `${step.section ?? ""} ${step.subSection ?? ""} ${step.prescription}`.toLowerCase();
  if (all.includes("tabata")) return { mode: "tabata", work: 20, rest: 10, rounds: 8 };

  const text = step.prescription.replace(REST_FRAGMENT_RE, " ");
  if (/\b\d+\s*(reps?|rep|sets?|x)\b/i.test(text) || /\b\d+\s*sets?\s*[x×]/i.test(text)) {
    return { mode: "manual" };
  }

  const clock = text.match(/\b(\d{1,2}):([0-5]\d)\b/);
  if (clock) return { mode: "timed", seconds: Number(clock[1]) * 60 + Number(clock[2]) };

  const min = text.match(/\b(\d+(?:\.\d+)?)\s*(min|mins|minute|minutes)\b/i);
  if (min) return { mode: "timed", seconds: Math.round(Number(min[1]) * 60) };

  const sec = text.match(/\b(\d+)\s*(sec|secs|second|seconds|s)\b/i);
  if (sec) return { mode: "timed", seconds: Number(sec[1]) };

  return { mode: "manual" };
}
