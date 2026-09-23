/**
 * WOD Section Completeness Validator
 * 
 * Ensures every generated WOD has all required section icons before saving.
 * Non-recovery WODs: 🧽 🔥 💪 ⚡ 🧘 (5 sections)
 * Recovery WODs: 🧽 🔥 💪 🧘 (4 sections, no finisher required)
 * 
 * Also validates that exercise-bearing sections (💪 Main Workout, ⚡ Finisher)
 * contain a minimum number of {{exercise:...}} tags to prevent empty/rest-only sections.
 */

const SECTION_ICONS = {
  SOFT_TISSUE: "🧽",
  ACTIVATION: "🔥",
  MAIN_WORKOUT: "💪",
  FINISHER: "⚡",
  COOL_DOWN: "🧘",
} as const;

const NON_RECOVERY_REQUIRED = [
  SECTION_ICONS.SOFT_TISSUE,
  SECTION_ICONS.ACTIVATION,
  SECTION_ICONS.MAIN_WORKOUT,
  SECTION_ICONS.FINISHER,
  SECTION_ICONS.COOL_DOWN,
];

const RECOVERY_REQUIRED = [
  SECTION_ICONS.SOFT_TISSUE,
  SECTION_ICONS.ACTIVATION,
  SECTION_ICONS.MAIN_WORKOUT,
  SECTION_ICONS.COOL_DOWN,
];

const ICON_LABELS: Record<string, string> = {
  "🧽": "Soft Tissue Preparation",
  "🔥": "Activation",
  "💪": "Main Workout",
  "⚡": "Finisher",
  "🧘": "Cool Down",
};

// Minimum exercise tag counts per section
const MIN_MAIN_WORKOUT_EXERCISES = 3;
const MIN_FINISHER_EXERCISES = 3;

// Valid keywords for the 🧽 Soft Tissue Preparation block. Each line in that
// section must contain at least one of these. Library-exercise markup
// ({{exercise:...}}) and stretch/mobility verbs are forbidden here.
const SOFT_TISSUE_VALID_KEYWORDS = [
  "foam roll",
  "foam-roll",
  "foam roller",
  "lacrosse",
  "tennis ball",
  "trigger point",
  "trigger-point",
  "self-massage",
  "self massage",
  "myofascial",
  "release",
];

const SOFT_TISSUE_FORBIDDEN_WORDS =
  /\b(stretch|circle|raise|swing|lunge|pose|march|bridge|squat|press|row|curl|twist|hydrant|cobra|cat-cow|catcow|sun salutation)\b/i;

const MOBILITY_STABILITY_FORBIDDEN_EXERCISES: RegExp[] = [
  /\b(jump\s*squat|squat\s*jump|drop\s*jump|box\s*jump|broad\s*jump|tuck\s*jump|forward\s*jump|backward\s*jump|skater\s*jump|jumping\s*lunge|jumping\s*jacks?|high\s*knees?|burpees?|mountain\s*climbers?|sprints?|shuttle\s*runs?|\brun\b|fast\s*feet)\b/i,
  /\b(kettlebell\s*swings?|kettlebell\s.*snatch|snatch|clean\s*(?:and|&)\s*jerk|power\s*clean|thrusters?|battle\s*ropes?|wall\s*balls?|slam\s*balls?|medicine\s*ball\s*slams?|tire\s*flips?)\b/i,
  /\b(bench\s*press|shoulder\s*press|triceps\s*press|biceps\s*curl|weighted\s*curl|seated\s*row|high\s*row|chin-?ups?|pull-?ups?|bench\s*dips?|lever\s*seated\s*dips?|push-?ups?)\b/i,
  /\b(barbell\s*full\s*squat|dumbbell\s*squat|goblet\s*squat|pistol\s*squat|one\s*leg\s*squat|walking\s*lunge|dumbbell\s*lunge|romanian\s*deadlift|stiff\s*leg\s*deadlift|straight\s*leg\s*deadlift)\b/i,
  /\b(crunch(?:es)?|sit-?ups?|russian\s*twists?|bicycle\s*crunch|leg\s*raise\s*crunch|vertical\s*leg\s*raise|hanging\s*(?:straight\s*)?leg\s*raise|seated\s*leg\s*raise|twisted\s*leg\s*raise|frog\s*crunch|reverse\s*crunch)\b/i,
];

const CHALLENGE_FORBIDDEN_WORK_BLOCK_EXERCISES: RegExp[] = [
  /\b(stretch(?:ing)?|mobility|pose|cat-?cow|cobra|sphinx|upward\s+facing\s+dog|child'?s\s+pose|pigeon|butterfly|world\s+greatest\s+stretch)\b/i,
  /\b(hamstring|quad(?:riceps?)?|calf|adductor|piriformis|glute\s+stretch|triceps\s+stretch|upper\s+back\s+stretch|all\s+fours\s+squad\s+stretch)\b/i,
  /\b(skin\s+the\s+cat|inchworm)\b/i,
];

export interface SectionValidationResult {
  isComplete: boolean;
  missingSections: string[];
  missingIcons: string[];
  foundIcons: string[];
  // Exercise content validation
  mainWorkoutExerciseCount: number;
  finisherExerciseCount: number;
  hasMinimumExercises: boolean;
  exerciseContentIssues: string[];
  // Soft-tissue validation
  softTissueIssues: string[];
  softTissueValid: boolean;
  // Category-specific coaching validation
  mobilityCompatibilityIssues: string[];
  mobilityCompatible: boolean;
}

export function validateMobilityStabilityExerciseCompatibility(
  html: string | null | undefined,
  category: string | null | undefined,
): string[] {
  if (!html || (category || "").toUpperCase() !== "MOBILITY & STABILITY") return [];
  const exerciseNames = [...html.matchAll(/\{\{exercise:[^:}]+:([^}]+)\}\}/gi)]
    .map((match) => match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return exerciseNames
    .filter((name) => {
      if (/\bscapula\s+push-?up\b/i.test(name)) return false;
      return MOBILITY_STABILITY_FORBIDDEN_EXERCISES.some((pattern) => pattern.test(name));
    })
    .map((name) => `Mobility & Stability contains incompatible exercise: ${name}`);
}

function exerciseNamesBetween(html: string, startIcon: string, endIcon: string | null): string[] {
  const startIdx = html.indexOf(startIcon);
  if (startIdx === -1) return [];
  const endIdx = endIcon ? html.indexOf(endIcon, startIdx + 1) : -1;
  const sectionContent = html.substring(startIdx, endIdx === -1 ? html.length : endIdx);
  return [...sectionContent.matchAll(/\{\{exercise:[^:}]+:([^}]+)\}\}/gi)]
    .map((match) => match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function validateChallengeWorkBlockCompatibility(
  html: string | null | undefined,
  category: string | null | undefined,
): string[] {
  if (!html || (category || "").toUpperCase() !== "CHALLENGE") return [];
  const workBlockNames = [
    ...exerciseNamesBetween(html, SECTION_ICONS.MAIN_WORKOUT, SECTION_ICONS.FINISHER),
    ...exerciseNamesBetween(html, SECTION_ICONS.FINISHER, SECTION_ICONS.COOL_DOWN),
  ];

  return workBlockNames
    .filter((name) => CHALLENGE_FORBIDDEN_WORK_BLOCK_EXERCISES.some((pattern) => pattern.test(name)))
    .map((name) => `Challenge work blocks cannot contain stretching/mobility exercises: ${name}`);
}

/**
 * Counts {{exercise:...}} tags within a substring of the HTML content
 * between two section icon markers.
 */
function countExerciseTagsBetween(
  html: string,
  startIcon: string,
  endIcon: string | null
): number {
  const startIdx = html.indexOf(startIcon);
  if (startIdx === -1) return 0;

  let endIdx: number;
  if (endIcon) {
    endIdx = html.indexOf(endIcon, startIdx + 1);
    if (endIdx === -1) endIdx = html.length;
  } else {
    endIdx = html.length;
  }

  const sectionContent = html.substring(startIdx, endIdx);
  const matches = sectionContent.match(/\{\{exercise:/g);
  return matches ? matches.length : 0;
}

/**
 * Validates the 🧽 Soft Tissue Preparation block: must contain at least one
 * foam-rolling / ball / release keyword, must NOT contain {{exercise:...}}
 * markup, and must NOT list stretches or mobility drills.
 */
export function validateSoftTissueBlock(html: string | null | undefined): string[] {
  if (!html) return [];
  const start = html.indexOf(SECTION_ICONS.SOFT_TISSUE);
  if (start === -1) return [];
  // find next section icon
  const otherIcons = [
    SECTION_ICONS.ACTIVATION,
    SECTION_ICONS.MAIN_WORKOUT,
    SECTION_ICONS.FINISHER,
    SECTION_ICONS.COOL_DOWN,
  ];
  let end = html.length;
  for (const icon of otherIcons) {
    const idx = html.indexOf(icon, start + 1);
    if (idx !== -1 && idx < end) end = idx;
  }
  const block = html.slice(start, end);
  const issues: string[] = [];
  if (/\{\{exercise:/i.test(block)) {
    issues.push("Soft Tissue Preparation contains library-exercise markup ({{exercise:...}}). It must be foam-rolling only.");
  }
  // body lines (strip header paragraph and tags)
  const body = block.replace(/<p[^>]*>\s*🧽[\s\S]*?<\/p>/, "");
  const text = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  if (!text) {
    issues.push("Soft Tissue Preparation section is empty.");
    return issues;
  }
  const hasValid = SOFT_TISSUE_VALID_KEYWORDS.some((kw) => text.includes(kw));
  if (!hasValid) {
    issues.push("Soft Tissue Preparation has no foam-roll / lacrosse-ball / tennis-ball / trigger-point / self-massage / release cue.");
  }
  if (SOFT_TISSUE_FORBIDDEN_WORDS.test(text)) {
    issues.push("Soft Tissue Preparation contains stretches/mobility moves. Move them to Activation or Cool Down.");
  }
  return issues;
}

/**
 * Validates that a main_workout HTML string contains all required section icons
 * AND that exercise-bearing sections contain a minimum number of exercises.
 * 
 * @param mainWorkoutHtml - The main_workout field HTML content
 * @param isRecovery - Whether this is a recovery day WOD (no finisher required)
 * @returns Validation result with missing section details and exercise counts
 */
export function validateWodSections(
  mainWorkoutHtml: string | null | undefined,
  isRecovery: boolean = false,
  category?: string | null
): SectionValidationResult {
  if (!mainWorkoutHtml) {
    const required = isRecovery ? RECOVERY_REQUIRED : NON_RECOVERY_REQUIRED;
    return {
      isComplete: false,
      missingSections: required.map(icon => ICON_LABELS[icon]),
      missingIcons: [...required],
      foundIcons: [],
      mainWorkoutExerciseCount: 0,
      finisherExerciseCount: 0,
      hasMinimumExercises: false,
      exerciseContentIssues: ["No content provided"],
      softTissueIssues: ["No content provided"],
      softTissueValid: false,
      mobilityCompatibilityIssues: [],
      mobilityCompatible: true,
    };
  }

  // PILATES (like RECOVERY) may legitimately have no Finisher section.
  const finisherOptional =
    isRecovery ||
    ((category || "").toUpperCase() === "PILATES" && !mainWorkoutHtml.includes(SECTION_ICONS.FINISHER));
  const required = finisherOptional ? RECOVERY_REQUIRED : NON_RECOVERY_REQUIRED;
  const foundIcons: string[] = [];
  const missingIcons: string[] = [];
  const missingSections: string[] = [];

  for (const icon of required) {
    if (mainWorkoutHtml.includes(icon)) {
      foundIcons.push(icon);
    } else {
      missingIcons.push(icon);
      missingSections.push(ICON_LABELS[icon]);
    }
  }

  // Count exercises in Main Workout (💪 → ⚡) and Finisher (⚡ → 🧘)
  const mainWorkoutExerciseCount = countExerciseTagsBetween(
    mainWorkoutHtml,
    SECTION_ICONS.MAIN_WORKOUT,
    finisherOptional ? SECTION_ICONS.COOL_DOWN : SECTION_ICONS.FINISHER
  );

  const finisherExerciseCount = finisherOptional
    ? 0 // Recovery WODs don't require a finisher
    : countExerciseTagsBetween(
        mainWorkoutHtml,
        SECTION_ICONS.FINISHER,
        SECTION_ICONS.COOL_DOWN
      );

  // Check minimum exercise thresholds
  const exerciseContentIssues: string[] = [];

  if (mainWorkoutExerciseCount < MIN_MAIN_WORKOUT_EXERCISES) {
    exerciseContentIssues.push(
      `Main Workout has only ${mainWorkoutExerciseCount} exercise(s), minimum is ${MIN_MAIN_WORKOUT_EXERCISES}`
    );
  }

  if (!finisherOptional && finisherExerciseCount < MIN_FINISHER_EXERCISES) {
    exerciseContentIssues.push(
      `Finisher has only ${finisherExerciseCount} exercise(s), minimum is ${MIN_FINISHER_EXERCISES}`
    );
  }

  const hasMinimumExercises = exerciseContentIssues.length === 0;
  const softTissueIssues = validateSoftTissueBlock(mainWorkoutHtml);
  const mobilityCompatibilityIssues = [
    ...validateMobilityStabilityExerciseCompatibility(mainWorkoutHtml, category),
    ...validateChallengeWorkBlockCompatibility(mainWorkoutHtml, category),
  ];

  return {
    isComplete: missingIcons.length === 0 && exerciseContentIssues.length === 0 && softTissueIssues.length === 0 && mobilityCompatibilityIssues.length === 0,
    missingSections,
    missingIcons,
    foundIcons,
    mainWorkoutExerciseCount,
    finisherExerciseCount,
    hasMinimumExercises,
    exerciseContentIssues,
    softTissueIssues,
    softTissueValid: softTissueIssues.length === 0,
    mobilityCompatibilityIssues,
    mobilityCompatible: mobilityCompatibilityIssues.length === 0,
  };
}
