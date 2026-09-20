import {
  parseProgramEquipmentIds,
  programAllowsFinisher,
  programDoctrine,
  programFinisherSizeViolation,
  programMainFormat,
  programWorkExerciseViolation,
} from "./program-doctrine.ts";
import { matchesSelectedEquipment, type PoolExercise } from "./workout-engine/pool.server.ts";
import type { Format } from "./workout-engine/spec.ts";

export type ProgramAuditIssue = {
  code: string;
  day: string;
  section: "Program" | "Main Workout" | "Finisher";
  message: string;
  exerciseId?: string;
};

export type ProgramAuditResult = {
  passed: boolean;
  issues: ProgramAuditIssue[];
  trainingDays: number;
  linkedExercises: number;
};

type ProgramLike = {
  category: string;
  equipment?: string | null;
  weekly_schedule?: string | null;
};

const TOKEN_RE = /\{\{exercise:([^:}]+):([^}]+)\}\}/g;
const DAY_RE = /<p[^>]*>\s*<strong>[^<]*DAY\s+(\d+)\s*[–-]\s*([^<]+)<\/strong>\s*<\/p>/gi;

function plain(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function parseFormat(text: string, fallback: Format): Format {
  const upper = text.toUpperCase();
  if (upper.includes("REPS & SETS") || upper.includes("SETS & REPS") || upper.includes("HOLDS")) return "REPS & SETS";
  if (upper.includes("TABATA")) return "TABATA";
  if (upper.includes("EMOM")) return "EMOM";
  if (upper.includes("AMRAP")) return "AMRAP";
  if (upper.includes("FOR TIME")) return "FOR TIME";
  if (upper.includes("CIRCUIT") || upper.includes("INTERVAL")) return "CIRCUIT";
  return fallback;
}

function sectionHtml(dayHtml: string, section: "Main Workout" | "Finisher"): string {
  const startRe = section === "Main Workout" ? /Main Workout/i : /Finisher/i;
  const nextRe = section === "Main Workout" ? /Finisher|Cool Down/i : /Cool Down/i;
  const start = dayHtml.search(startRe);
  if (start < 0) return "";
  const tail = dayHtml.slice(start);
  const next = tail.slice(1).search(nextRe);
  return next < 0 ? tail : tail.slice(0, next + 1);
}

function tokenRows(html: string): Array<{ id: string; name: string; before: string }> {
  const rows: Array<{ id: string; name: string; before: string }> = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(TOKEN_RE.source, "g");
  while ((match = re.exec(html)) !== null) {
    const lineStart = Math.max(html.lastIndexOf("<p", match.index), html.lastIndexOf("<li", match.index), 0);
    rows.push({ id: match[1].trim(), name: match[2].trim(), before: plain(html.slice(lineStart, match.index)) });
  }
  return rows;
}

export function auditProgramCompliance(program: ProgramLike, library: PoolExercise[]): ProgramAuditResult {
  const html = program.weekly_schedule || "";
  const issues: ProgramAuditIssue[] = [];
  const byId = new Map(library.map((exercise) => [exercise.id, exercise]));
  const doctrine = programDoctrine(program.category);
  const equipmentIds = parseProgramEquipmentIds(program.equipment);
  const bodyweightOnly = equipmentIds.length === 0;
  const dayMatches = [...html.matchAll(new RegExp(DAY_RE.source, "gi"))];
  const weekBStart = html.search(/WEEK B TEMPLATE/i);
  let trainingDays = 0;
  let linkedExercises = 0;

  for (let index = 0; index < dayMatches.length; index += 1) {
    const match = dayMatches[index];
    const start = match.index ?? 0;
    const end = index + 1 < dayMatches.length ? (dayMatches[index + 1].index ?? html.length) : html.length;
    const dayName = `Day ${match[1]} – ${match[2].trim()}`;
    if (/active recovery|rest/i.test(match[2])) continue;
    trainingDays += 1;
    const dayHtml = html.slice(start, end);
    const mainHtml = sectionHtml(dayHtml, "Main Workout");
    const finisherHtml = sectionHtml(dayHtml, "Finisher");
    const templateIndex = weekBStart >= 0 && start > weekBStart ? 2 : 1;
    const expectedMain = programMainFormat(program.category, templateIndex);
    const actualMain = parseFormat(plain(mainHtml).slice(0, 220), expectedMain);

    if (!mainHtml) {
      issues.push({ code: "MISSING_MAIN", day: dayName, section: "Main Workout", message: "Main Workout section is missing." });
      continue;
    }
    if (!doctrine.mainFormats.includes(actualMain)) {
      issues.push({ code: "FORMAT_ILLEGAL", day: dayName, section: "Main Workout", message: `${actualMain} is not legal for ${program.category}.` });
    }

    const inspect = (section: "Main Workout" | "Finisher", content: string, format: Format) => {
      const tokens = tokenRows(content);
      linkedExercises += tokens.length;
      if (section === "Main Workout" && tokens.length < 4) {
        issues.push({ code: "THIN_MAIN", day: dayName, section, message: `Main Workout has only ${tokens.length} linked exercises.` });
      }
      if (section === "Finisher" && tokens.length === 0) {
        issues.push({ code: "EMPTY_FINISHER", day: dayName, section, message: "Finisher has no linked exercises." });
      }
      for (const token of tokens) {
        const exercise = byId.get(token.id);
        if (!exercise) {
          issues.push({ code: "UNKNOWN_EXERCISE", day: dayName, section, exerciseId: token.id, message: `"${token.name}" is not linked to the live exercise library.` });
          continue;
        }
        if (exercise.name.trim().toLowerCase() !== token.name.trim().toLowerCase()) {
          issues.push({ code: "NAME_MISMATCH", day: dayName, section, exerciseId: token.id, message: `"${token.name}" does not match library name "${exercise.name}".` });
        }
        if (bodyweightOnly && !/body\s*weight|bodyweight/i.test(exercise.equipment || "")) {
          issues.push({ code: "EQUIPMENT_ILLEGAL", day: dayName, section, exerciseId: token.id, message: `"${exercise.name}" needs equipment in a Bodyweight program.` });
        } else if (equipmentIds.length && !equipmentIds.includes("fullgym") && !/body\s*weight|bodyweight/i.test(exercise.equipment || "") && !matchesSelectedEquipment(exercise, equipmentIds)) {
          issues.push({ code: "EQUIPMENT_ILLEGAL", day: dayName, section, exerciseId: token.id, message: `"${exercise.name}" is outside the program's available equipment.` });
        }
        const violation = programWorkExerciseViolation(exercise, program.category, format);
        if (violation) issues.push({ code: "EXERCISE_ILLEGAL", day: dayName, section, exerciseId: token.id, message: violation });
        if (!/\d/.test(token.before)) {
          issues.push({ code: "MISSING_DOSE", day: dayName, section, exerciseId: token.id, message: `"${exercise.name}" has no measurable prescription before its exercise link.` });
        }
      }
    };

    inspect("Main Workout", mainHtml, actualMain);
    if (!programAllowsFinisher(program.category) && finisherHtml) {
      issues.push({ code: "FINISHER_FORBIDDEN", day: dayName, section: "Finisher", message: `${program.category} days do not carry a Finisher.` });
    } else if (finisherHtml && doctrine.finisherFormat) {
      const actualFinisher = parseFormat(plain(finisherHtml).slice(0, 220), doctrine.finisherFormat);
      if (actualFinisher !== doctrine.finisherFormat) {
        issues.push({ code: "FINISHER_FORMAT", day: dayName, section: "Finisher", message: `${program.category} Finisher must use ${doctrine.finisherFormat}, not ${actualFinisher}.` });
      }
      const size = programFinisherSizeViolation(plain(finisherHtml));
      if (size) issues.push({ code: "FINISHER_SIZE", day: dayName, section: "Finisher", message: size });
      inspect("Finisher", finisherHtml, actualFinisher);
    }
  }

  if (!trainingDays) issues.push({ code: "NO_TRAINING_DAYS", day: "Program", section: "Program", message: "No playable training days were found." });
  return { passed: issues.length === 0, issues, trainingDays, linkedExercises };
}