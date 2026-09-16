// ═══════════════════════════════════════════════════════════════════════════════
// SHARED EXERCISE MATCHING UTILITIES
// Used by generate-workout-of-day and generate-fitness-plan to link exercises
// ═══════════════════════════════════════════════════════════════════════════════
// ONE selection policy for the whole platform — see ./exercise-selection.ts
import { applySelectionPolicy, COACH_MINDSET } from "./exercise-selection.ts";

export interface ExerciseBasic {
  id: string;
  name: string;
  category?: string | null;
  body_part: string;
  equipment: string;
  target: string;
  difficulty?: string | null;
}

const STATIC_HOLD_PATTERNS: RegExp[] = [
  /^back\s+lever$/i,
  /^front\s+lever$/i,
  /^front\s+lever\s+reps$/i,
  /\bl-?sit\b/i,
  /\bwall\s+sit\b/i,
  /\bdead\s+hang\b/i,
  /\bsupport\s+hold\b/i,
  /\bhollow\s+(?:body\s+)?hold\b/i,
  /\barch\s+hold\b/i,
  /^flag$/i,
  /^full\s+planche$/i,
  /^handstand$/i,
  /\bforearm\s+plank\b/i,
  /^bodyweight\s+incline\s+side\s+plank$/i,
  /\bisometric\s+chest\s+squeeze\b/i,
];

export function isStaticHoldExerciseName(name: string): boolean {
  const normalized = (name || '').toLowerCase().trim();
  if (STATIC_HOLD_PATTERNS.some((pattern) => pattern.test(normalized))) return true;
  if (!normalized || /\breps?\b|tap|twist|row|fly|raise|press|push|pull|wiper|walk|crawl/i.test(normalized)) return false;

  return STATIC_HOLD_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function filterOutStaticHoldExercises<T extends { name?: string | null }>(exercises: T[]): T[] {
  return exercises.filter((exercise) => !isStaticHoldExerciseName(exercise.name || ''));
}

export function repairStaticHoldPrescriptions(
  content: string,
  logPrefix = '[HOLD-RX]'
): { processedContent: string; repaired: Array<{ exercise: string; from: string; to: string }> } {
  const repaired: Array<{ exercise: string; from: string; to: string }> = [];
  if (!content) return { processedContent: content || '', repaired };

  const processedContent = content.replace(
    /(\{\{exercise:[^:}]+:([^}]+)\}\}\s*[–-]\s*)(?:(\d+)\s*[×x]\s*(\d+)(?:\s*reps?)?(?!\s*-?\s*(?:sec|secs|seconds?|s\b|min|mins|minutes?|holds?\b))|(\d+)\s*sets?\s*(?:of|x|×)?\s*(\d+)(?:\s*reps?)?(?!\s*-?\s*(?:sec|secs|seconds?|s\b|min|mins|minutes?|holds?\b)))/gi,
    (full, prefix: string, name: string, setsA: string, countA: string, setsB: string, countB: string) => {
      if (!isStaticHoldExerciseName(name)) return full;
      const sets = setsA || setsB;
      const seconds = countA || countB;
      const replacement = `${sets} × ${seconds}-sec holds`;
      repaired.push({ exercise: name, from: full.replace(prefix, '').trim(), to: replacement });
      return `${prefix}${replacement}`;
    },
  );

  if (repaired.length > 0) {
    console.log(`${logPrefix} Repaired ${repaired.length} static-hold prescriptions`);
  }

  return { processedContent, repaired };
}

export function removeStaticHoldsFromMomentumSections(
  content: string,
  logPrefix = '[HOLD-PLACEMENT]'
): { processedContent: string; removed: Array<{ section: string; exercise: string }> } {
  const removed: Array<{ section: string; exercise: string }> = [];
  if (!content) return { processedContent: content || '', removed };

  const sections = splitIntoSections(content);
  if (!sections.length) return { processedContent: content, removed };

  const processedContent = sections.map((section) => {
    if (section.name !== 'main_workout' && section.name !== 'finisher') return section.content;

    return section.content.replace(
      /<li\b[^>]*>[\s\S]*?\{\{exercise:[^:}]+:([^}]+)\}\}[\s\S]*?<\/li>/gi,
      (full, exerciseName: string) => {
        if (!isStaticHoldExerciseName(exerciseName)) return full;
        removed.push({ section: section.name, exercise: exerciseName });
        return '';
      },
    );
  }).join('');

  if (removed.length > 0) {
    console.log(`${logPrefix} Removed ${removed.length} static holds from Main/Finisher momentum sections`);
  }

  return { processedContent, removed };
}

const NON_BODYWEIGHT_FILTER = 'non-bodyweight';

function isBodyweightEquipmentValue(equipment: string | null | undefined): boolean {
  const eq = (equipment || '').toLowerCase().trim();
  return eq === 'body weight' || eq === 'bodyweight';
}

// ─────────────────────────────────────────────────────────────────────────────
// HOME-BODYWEIGHT GUARDRAIL
// Some exercises are tagged equipment="body weight" but still require apparatus
// (bench, pull-up bar, dip station, GHD/glute-ham bench, parallel bars, box,
// captain's chair, gymnastic rings, etc.). For BODYWEIGHT WODs (no-equipment,
// home/hotel/travel) those must be excluded from the prompt and rejected post
// generation. Match by exercise NAME so we never need to touch the data.
// ─────────────────────────────────────────────────────────────────────────────
const HOME_BODYWEIGHT_FORBIDDEN_PATTERNS: RegExp[] = [
  /\bbench\b/i,
  /\(bench/i,
  /\bdip(s)?\b/i,
  /pull-?up/i,
  /chin-?up/i,
  /muscle-?up/i,
  /parallel\s*bars?/i,
  /\bcage\b/i,
  /\brings?\b/i,
  /hyperextension/i,
  /glute-?ham/i,
  /captains?\s*chair/i,
  /\(on\s*box\)/i,
  /\bbox\s*jump/i,
  /vertical\s*bar/i,
  /on\s*(a\s*)?(straight|vertical)\s*bar/i,
  /pull-?up\s*cable/i,
];

export function isHomeBodyweightFriendly(exercise: ExerciseBasic): boolean {
  if (!isBodyweightEquipmentValue(exercise.equipment)) return false;
  const name = (exercise.name || '').toLowerCase();
  return !HOME_BODYWEIGHT_FORBIDDEN_PATTERNS.some((re) => re.test(name));
}

export function filterToHomeBodyweight(exercises: ExerciseBasic[]): ExerciseBasic[] {
  return exercises.filter(isHomeBodyweightFriendly);
}

export interface MatchResult {
  exercise: ExerciseBasic;
  confidence: number;
}

export interface ProcessingResult {
  processedContent: string;
  matched: Array<{ original: string; matched: string; id: string; confidence: number }>;
  unmatched: string[];
}

/**
 * Normalize an exercise name for comparison
 */
export function normalizeExerciseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[-_]/g, ' ')
    .replace(/[''`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(word => word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word)
    .join('');
}

/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

/**
 * Calculate confidence score between two normalized strings
 */
export function calculateConfidence(searchNorm: string, exerciseNorm: string): number {
  if (searchNorm === exerciseNorm) return 1.0;
  
  if (exerciseNorm.includes(searchNorm) || searchNorm.includes(exerciseNorm)) {
    const longer = Math.max(searchNorm.length, exerciseNorm.length);
    const shorter = Math.min(searchNorm.length, exerciseNorm.length);
    return 0.80 + (shorter / longer * 0.20);
  }
  
  const distance = levenshteinDistance(searchNorm, exerciseNorm);
  const maxLength = Math.max(searchNorm.length, exerciseNorm.length);
  const similarity = 1 - (distance / maxLength);
  
  return similarity;
}

/**
 * Find the best matching exercise from the library
 */
export function findBestMatch(
  searchTerm: string,
  exercises: ExerciseBasic[],
  confidenceThreshold: number = 0.65
): MatchResult | null {
  const searchLower = searchTerm.toLowerCase().trim();
  
  // EXACT name match first (case-insensitive) — guarantees exercises like "balance board" always match
  for (const exercise of exercises) {
    if (exercise.name.toLowerCase().trim() === searchLower) {
      return { exercise, confidence: 1.0 };
    }
  }
  
  const searchNorm = normalizeExerciseName(searchTerm);
  if (searchNorm.length < 3) return null;
  
  let bestMatch: MatchResult | null = null;
  let bestConfidence = 0;
  
  for (const exercise of exercises) {
    const exerciseNorm = normalizeExerciseName(exercise.name);
    const confidence = calculateConfidence(searchNorm, exerciseNorm);
    
    if (confidence > bestConfidence && confidence >= confidenceThreshold) {
      bestConfidence = confidence;
      bestMatch = { exercise, confidence };
    }
  }
  
  return bestMatch;
}

/**
 * Force-match: try at 0.65 first, then fall back to 0.45.
 * If matched at lower threshold, returns the LIBRARY exercise name as replacement.
 */
export function forceMatchExercise(
  searchTerm: string,
  exercises: ExerciseBasic[],
  logPrefix: string = ""
): { match: MatchResult; replaceName: boolean } | null {
  // Try normal threshold first
  const normalMatch = findBestMatch(searchTerm, exercises, 0.65);
  if (normalMatch) {
    return { match: normalMatch, replaceName: false };
  }
  
  // Try lower threshold - will REPLACE exercise name with library name
  const forceMatch = findBestMatch(searchTerm, exercises, 0.45);
  if (forceMatch) {
    console.log(`${logPrefix} 🔄 Force-match: "${searchTerm}" → "${forceMatch.exercise.name}" (${(forceMatch.confidence * 100).toFixed(0)}%)`);
    return { match: forceMatch, replaceName: true };
  }
  
  return null;
}

// Common structural headers that are NOT exercises
const STRUCTURAL_HEADERS = [
  'warm up', 'warmup', 'warm-up',
  'cool down', 'cooldown', 'cool-down',
  'main workout', 'finisher', 'activation',
  'notes', 'tips', 'instructions', 'description',
  'rounds', 'sets', 'reps', 'rest', 'recovery',
  'block', 'circuit', 'station', 'phase',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'day 1', 'day 2', 'day 3', 'day 4', 'day 5', 'day 6', 'day 7',
  'week 1', 'week 2', 'week 3', 'week 4', 'week 5', 'week 6', 'week 7', 'week 8',
  'duration', 'frequency', 'session', 'session length', 'focus', 'format',
  'protein', 'carbs', 'hydration', 'electrolytes', 'deficit', 'timing',
  'pre-workout', 'post-workout', 'pre-cardio', 'post-cardio',
  'volume progression', 'intensity progression', 'density progression', 'complexity progression',
  'cardiovascular', 'metabolism', 'mental strength', 'energy',
  'calorie burn', 'fat loss', 'conditioning', 'strength', 'movement', 'daily life',
  'daily goal', 'daily hydration', 'electrolyte balance', 'carbohydrate needs',
  'race day nutrition', 'rest days', 'heart rate monitoring', 'weekly progression',
  'total weekly calorie targets', 'caloric deficit', 'carb cycling', 'collagen',
  'machine setup tips', 'treadmill', 'rower', 'by week',
  'cardiovascular fitness', 'expected results', 'nutrition tips',
  'soft tissue preparation', 'perform each exercise', 'complete', 'repeat',
  'foam roll', 'lacrosse ball', 'gentle jogging',
  'overview', 'target audience', 'program structure', 'progression plan',
  'equipment needed', 'training days', 'workout duration', 'rest between exercises',
  'weekly schedule', 'important notes', 'safety first', 'progressive overload',
  // Structural section titles
  'tabata 1', 'tabata 2', 'tabata 3', 'tabata 4',
  'tabata block 1', 'tabata block 2', 'tabata block 3',
  'tabata round 1', 'tabata round 2', 'tabata round 3',
  'tabata protocol', 'tabata',
  'flow sequence', 'flow sequence 1', 'flow sequence 2', 'flow sequence 3',
  'practice round', 'practice rounds', 'practice combos',
  'progressive build', 'build', 'foundation',
  'dynamic warm', 'stability warm', 'spine and core warm',
  'full body flow', 'full body boost', 'full body finisher',
  'full body stretching', 'full body shake out', 'full body scan',
  'hip mobility', 'hip flexor focus', 'hip liberation sequence',
  'spine mobility flow', 'spine articulation', 'joint mobility',
  'mobilization', 'dynamic mobility flow', 'relaxation pose',
  'core endurance', 'stability and core', 'lower body',
  'upper body', 'ascending triad', 'forge gauntlet',
  'metabolic amrap circuit', 'emom of power',
  'advanced cardiovascular emom', 'dynamic balance',
  'gentle full body shakedown', 'gentle aerobic',
  'light cardio', 'light cooldown cardio',
  'walk down recovery', 'slow walking', 'stretching',
  'savasana', 'breathing', 'deep abdominal breathing',
  'safety', 'record total rounds', 'record your total time',
  'intensity technique progression', 'key movement principles',
  'training to failure', 'power, olympic lifts',
  'for energy boost', 'after 6 weeks', 'retest 1rm',
  'fartlek', 'steady ride', 'sun salutation',
];

// Words that indicate structural/instructional text, not exercise names
const STRUCTURAL_WORD_STARTS = [
  'perform', 'complete', 'repeat', 'rest', 'foam roll', 'lacrosse ball',
  'gentle jogging', 'seconds', 'minute', 'round', 'set',
  'week ', 'day ', 'phase ',
];

// Prefix patterns that indicate a header with exercise after colon
const PREFIX_PATTERNS = [
  /^tabata\s*\d*:\s*/i,
  /^tabata\s+round\s*\d*:\s*/i,
  /^\d+\s*rounds?\s*(?:of)?:\s*/i,
  /^for\s*time:\s*/i,
  /^amrap\s*(?:\d+)?:\s*/i,
  /^emom\s*(?:\d+)?:\s*/i,
  /^minute\s*\d+:\s*/i,
  /^accumulation\s*challenge:\s*/i,
  /^station\s*\d*:\s*/i,
  /^exercise\s*\d*:\s*/i,
  /^movement\s*\d*:\s*/i,
  /^block\s*\d*:\s*/i,
  /^[A-D]\d+[\.:]?\s*/,
  /^[A-D]\d*[\.:]\s*/,
  /^[A-D]\d*\)\s*/,
];

// Patterns that are purely structural (no exercise follows)
const PURE_STRUCTURAL_PATTERNS = [
  /^for\s*time$/i,
  /^amrap\s*\d*$/i,
  /^emom\s*\d*$/i,
  /^\d+\s*rounds?$/i,
  /^\d+\s*sets?$/i,
  /^\d+\s*reps?$/i,
  /^rest\s*\d*/i,
  /^recovery$/i,
];

/**
 * Check if a string looks like an exercise name (not structural/instructional text)
 */
function isLikelyExerciseName(text: string): boolean {
  const lower = text.toLowerCase().trim();
  
  if (lower.length < 3 || lower.length > 60) return false;
  if (/^\d+\.?\s*$/.test(text)) return false;
  if (/\b(diaphragmatic|breathing|breath\s*work|box\s*breathing|inhale|exhale)\b/i.test(lower)) return false;
  if (/\b(one\s+hand|one\s+on|both\s+hands|hand\s+on\s+chest|on\s+belly|on\s+chest|lie\s+supine|lying\s+supine)\b/i.test(lower)) return false;
  
  if (PURE_STRUCTURAL_PATTERNS.some(p => p.test(text))) return false;
  if (STRUCTURAL_HEADERS.some(h => lower === h || lower.startsWith(h + ' ') || lower.startsWith(h + ':'))) return false;
  if (STRUCTURAL_WORD_STARTS.some(w => lower.startsWith(w))) return false;
  
  // Allow "perform X" where X is a short exercise candidate (1-3 words), skip longer instructional text
  if (/^perform\s/i.test(lower)) {
    const afterPerform = lower.replace(/^perform\s+/i, '').replace(/[.,!?]$/, '').trim();
    if (afterPerform.split(/\s+/).length <= 3 && afterPerform.length >= 3) {
      return true; // Short exercise name after "perform" — allow it
    }
    return false;
  }
  if (/^(complete|repeat|do|hold|maintain|keep|breathe|inhale|exhale|record|retest|practice|simply|include|stop|start|add|test|target|focus|intensity|rep range|reps|both|after|immediately|as many|for max|for time|for energy)\s/i.test(lower)) return false;
  if (/^\d+\s*(seconds?|minutes?|mins?|secs?)\s/i.test(lower)) return false;
  if (/^\d+\s*rounds?\s/i.test(lower)) return false;
  if (!/^[A-Za-z]/.test(text)) return false;
  // Filter out instructional/description text
  if (/^(static stretch|gentle stretch|dynamic stretch|light jog|easy pace|smooth transition)/i.test(lower)) return false;
  if (/^(cardio|fat burning|high intensity|intervals|steady):/i.test(lower)) return false;
  if (/\d+%\s*(max|of|hr|1rm)/i.test(lower)) return false;
  if (/^(target|intensity|rep range|reps|hold|both legs|after \d|immediately into)/i.test(lower)) return false;
  // Filter out anything that looks like a sentence (has 6+ words)
  if (lower.split(/\s+/).length > 6) return false;
  
  return true;
}

function isBreathingCueFragment(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return /\b(diaphragmatic|breathing|breath\s*work|box\s*breathing|inhale|exhale)\b/i.test(lower)
    || /\b(one\s+hand|one\s+on|both\s+hands|hand\s+on\s+chest|on\s+belly|on\s+chest|lie\s+supine|lying\s+supine)\b/i.test(lower);
}

/**
 * Clean an exercise name by stripping metadata, qualifiers, etc.
 */
function cleanExerciseName(text: string): string {
  let cleaned = text;
  cleaned = cleaned.replace(/^\d+\.\s*/, '');
  // Strip leading sets/reps prescriptions: "5 sets × 5 reps Handstand Push-up" → "Handstand Push-up"
  cleaned = cleaned.replace(/^\d+\s*sets?\s*(?:x|×)\s*\d+(?:\s*-\s*\d+)?\s*(?:reps?)?\s+/i, '').trim();
  // Strip leading measurable prescriptions: "15 reps Bird Dog", "45 sec Plank", "200m Run" → exercise name
  cleaned = cleaned.replace(/^\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?\s*(?:reps?(?:\s*\/\s*(?:side|leg|arm))?|reps?\s*(?:per|each)\s*(?:side|leg|arm)|sec(?:onds?)?|s\b|min(?:utes?)?|m\b|meters?|metres?|km\b|cal(?:ories)?|rounds?)\s+/i, '').trim();
  // Strip leading quantity: "15 Kettlebell Swing" → "Kettlebell Swing"
  cleaned = cleaned.replace(/^\d+\s+(?=[A-Z])/i, '').trim();
  // Strip superset labels like "A1:", "B:", "C2.", "D)" at the start (case-sensitive: A-D only uppercase)
  cleaned = cleaned.replace(/^[A-D]\d*[\.\:\)]\s*/, '').trim();
  // Strip "Minute N:" prefix: "Minute 1: Kettlebell Swing" → "Kettlebell Swing"
  cleaned = cleaned.replace(/^Minute\s*\d+\s*:\s*/i, '').trim();
  cleaned = cleaned.replace(/[:;.]+$/, '');
  cleaned = cleaned.replace(/\s+machine\s*$/i, '');
  cleaned = cleaned.replace(/:\s*\d+\s*(?:sets?|rounds?|reps?|x\s|×\s|min|sec).*/i, '').trim();
  cleaned = cleaned.replace(/\s+\d+\s*(?:sets?\s*(?:x|×)\s*\d+|reps?|rounds?|min(?:utes?)?|sec(?:onds?)?).*$/i, '').trim();
  cleaned = cleaned.replace(/\s*\([^)]*\)\s*/g, '').trim();
  // Strip trailing duration like " - 40 sec work" (require space before dash)
  cleaned = cleaned.replace(/\s+[-–—]\s*\d+\s*(?:sec|min|seconds?|minutes?).*$/i, '').trim();
  // Strip trailing description after dash with SPACE: "Battle Rope Slams – full body power" → "Battle Rope Slams"
  // IMPORTANT: requires whitespace before dash to preserve hyphenated names like "chin-up", "l-pull-up"
  cleaned = cleaned.replace(/\s+[-–—]\s+[a-z].*$/i, '').trim();
  // Strip trailing dash (with or without space)
  cleaned = cleaned.replace(/\s*[-–—]\s*$/, '');
  // Strip trailing "x" or "x \d+" (common artifact: "burpeex 5", "Walkouts x")
  cleaned = cleaned.replace(/\s*x\s*\d*\s*$/i, '').trim();
  // Strip trailing typo artifact only when appended to a longer word ("jump squatv"), not legitimate names like "V-Up".
  cleaned = cleaned.replace(/(?<=[A-Za-z]{3,})[vx]\s*$/i, '').trim();
  cleaned = cleaned.trim();
  return cleaned;
}

/**
 * Extract exercise names from HTML content
 * Handles: bold text, text after bold prefixes, list items, <br>-separated lines
 */
export function extractExerciseNames(htmlContent: string): string[] {
  const exercises: string[] = [];
  const seen = new Set<string>();
  
  function addExercise(name: string) {
    // Split comma-separated exercise lists: "Bird, Dead Bug" → ["Bird", "Dead Bug"]
    if (name.includes(',') && !name.includes('{{')) {
      const parts = name.split(',');
      if (parts.length >= 2 && parts.length <= 8) {
        for (const part of parts) {
          const cleaned = cleanExerciseName(part.trim());
          if (cleaned && cleaned.length >= 3 && isLikelyExerciseName(cleaned) && !seen.has(cleaned.toLowerCase())) {
            seen.add(cleaned.toLowerCase());
            exercises.push(cleaned);
          }
        }
        return;
      }
    }
    const cleaned = cleanExerciseName(name);
    if (cleaned.length >= 3 && isLikelyExerciseName(cleaned) && !seen.has(cleaned.toLowerCase())) {
      seen.add(cleaned.toLowerCase());
      exercises.push(cleaned);
    }
  }
  
  if (!htmlContent) return [];
  
  // ─── Pattern 1: Bold text (exercise name fully inside bold tags) ───
  const boldPattern = /<(?:strong|b)>([^<]+)<\/(?:strong|b)>/gi;
  let match;
  while ((match = boldPattern.exec(htmlContent)) !== null) {
    let text = match[1].trim();
    if (/\{\{exercise:/.test(text)) continue;
    
    for (const prefixPattern of PREFIX_PATTERNS) {
      const prefixMatch = text.match(prefixPattern);
      if (prefixMatch) {
        const afterPrefix = text.substring(prefixMatch[0].length).trim();
        if (afterPrefix.length >= 3) {
          text = afterPrefix;
        } else {
          text = '';
        }
        break;
      }
    }
    
    if (text) addExercise(text);
  }
  
  // ─── Pattern 2: Text AFTER a closing bold tag ───
  const afterBoldPattern = /<\/(?:strong|b)>\s*([^<]+)/gi;
  while ((match = afterBoldPattern.exec(htmlContent)) !== null) {
    let text = match[1].trim();
    if (!text || /\{\{exercise:/.test(text)) continue;
    const cleaned = cleanExerciseName(text);
    if (cleaned) addExercise(cleaned);
  }
  
  // ─── Pattern 3: Plain text in list items ───
  const listItemPattern = /<li[^>]*>\s*(?:<p[^>]*>)?([^<]+)(?:<\/p>)?/gi;
  while ((match = listItemPattern.exec(htmlContent)) !== null) {
    let text = match[1].trim();
    if (!text || /\{\{exercise:/.test(text)) continue;
    
    // Apply prefix pattern cleanup
    for (const prefixPattern of PREFIX_PATTERNS) {
      const prefixMatch = text.match(prefixPattern);
      if (prefixMatch) {
        const afterPrefix = text.substring(prefixMatch[0].length).trim();
        if (afterPrefix.length >= 3) {
          text = afterPrefix;
        } else {
          text = '';
        }
        break;
      }
    }
    if (!text) continue;
    
    // "30 seconds Jumping Jacks"
    const durationFirst = text.match(/^\d+\s*(?:seconds?|secs?|minutes?|mins?)\s+(.+)/i);
    if (durationFirst && durationFirst[1]) {
      const candidate = cleanExerciseName(durationFirst[1]);
      if (candidate) addExercise(candidate);
      continue;
    }
    
    // "4 sets × 8 reps Push-up" / "20 Air Squats"
    const setsFirst = text.match(/^\d+\s*sets?\s*(?:x|×)\s*\d+/i);
    if (setsFirst) {
      const candidate = cleanExerciseName(text);
      if (candidate) addExercise(candidate);
      continue;
    }

    // "20 Air Squats"
    const numberFirst = text.match(/^(\d+)\s+([A-Za-z][A-Za-z\s'-]+)/);
    if (numberFirst && numberFirst[2]) {
      const candidate = cleanExerciseName(numberFirst[2]);
      if (candidate) addExercise(candidate);
      continue;
    }
    
    if (/^[A-Za-z]/.test(text)) {
      const candidate = cleanExerciseName(text);
      if (candidate) addExercise(candidate);
    }
  }
  
  // ─── Pattern 4: <br>-separated lines (common in training programs) ───
  const brLines = htmlContent.split(/<br\s*\/?>/gi);
  for (const rawLine of brLines) {
    const line = rawLine.replace(/<[^>]+>/g, '').trim();
    if (!line || line.length < 3 || /\{\{exercise:/.test(line)) continue;
    
    // Apply prefix pattern cleanup (Tabata 1:, Station 2:, etc.)
    let cleanedLine = line;
    for (const prefixPattern of PREFIX_PATTERNS) {
      const prefixMatch = cleanedLine.match(prefixPattern);
      if (prefixMatch) {
        const afterPrefix = cleanedLine.substring(prefixMatch[0].length).trim();
        if (afterPrefix.length >= 3) {
          cleanedLine = afterPrefix;
        }
        break;
      }
    }
    
    // "1. Squat to Press - 40 sec work" → "Squat to Press"
    const numberedLine = cleanedLine.match(/^\d+[\.\)]\s*(.+)/);
    if (numberedLine && numberedLine[1]) {
      const candidate = cleanExerciseName(numberedLine[1]);
      if (candidate) addExercise(candidate);
      continue;
    }
    
    // Comma-separated exercise list
    if (cleanedLine.includes(',') && !cleanedLine.includes('{{')) {
      const parts = cleanedLine.split(',');
      if (parts.length >= 2 && parts.length <= 10) {
        let allLookLikeExercises = true;
        const candidates: string[] = [];
        for (const part of parts) {
          const cleaned = cleanExerciseName(part.trim());
          if (cleaned && cleaned.length >= 3 && isLikelyExerciseName(cleaned)) {
            candidates.push(cleaned);
          } else if (part.trim().length > 2) {
            allLookLikeExercises = false;
          }
        }
        if (allLookLikeExercises && candidates.length >= 2) {
          for (const c of candidates) addExercise(c);
          continue;
        }
      }
    }
    
    // Plain line starting with a letter
    if (/^[A-Za-z]/.test(cleanedLine)) {
      const candidate = cleanExerciseName(cleanedLine);
      if (candidate) addExercise(candidate);
    }
  }
  
  return exercises;
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Replace an exercise name with markup in content.
 * If replacementName is provided (force-match), replaces the original name with the library name.
 */
function replaceExerciseInContent(
  content: string,
  exerciseName: string,
  markup: string,
  replacementName?: string
): string {
  const escaped = escapeRegExp(exerciseName);
  // Match the exercise name followed by optional plural 's', optional 'machine', optional punctuation
  // The word boundary prevents partial matches: "chin-up" won't match inside "chin-up-up-up"
  const escapedWithSuffix = escaped + '(?:s)?(?:\\s+[Mm]achine)?(?:[:;.])?\\s*';
  let result = content;
  
  const patterns = [
    // 1. Inside bold tags
    new RegExp(`(<(?:strong|b)>(?:\\d+\\.\\s*)?)${escapedWithSuffix}(<\/(?:strong|b)>)`, 'gi'),
    // 2. With Tabata/Station/Exercise prefix inside bold
    new RegExp(`(<(?:strong|b)>(?:(?:Tabata|Station|Exercise|Movement|Block)\\s*(?:Round\\s*)?\\d*:\\s*))${escapedWithSuffix}(<\/(?:strong|b)>)`, 'gi'),
    // 3. With A1:/B2: prefix inside bold
    new RegExp(`(<(?:strong|b)>[A-Da-d]\\d*[\\.:]\\s*)${escapedWithSuffix}(<\/(?:strong|b)>)`, 'gi'),
    // 4. With parenthetical qualifiers inside bold
    new RegExp(`(<(?:strong|b)>(?:\\d+\\.\\s*)?)${escaped}(?:s)?(?:\\s+[Mm]achine)?(?:\\s*\\([^)]*\\))?(?:[:;.])?\\s*(<\/(?:strong|b)>)`, 'gi'),
    // 5. After a closing bold tag
    new RegExp(`(<\/(?:strong|b)>\\s*)${escapedWithSuffix}`, 'gi'),
    // 6. After duration in list/content
    new RegExp(`(\\d+\\s*(?:seconds?|secs?|minutes?|mins?)\\s+)${escapedWithSuffix}`, 'gi'),
    // 7. After a number
    new RegExp(`(\\d+\\s+)${escapedWithSuffix}`, 'gi'),
    // 8a. Exercise name as ENTIRE <p> content (exact)
    new RegExp(`(<p[^>]*>\\s*)${escapedWithSuffix}(\\s*<\/p>)`, 'gi'),
    // 8b. Exercise name followed by parenthetical/trailing text inside <p>
    new RegExp(`(<p[^>]*>\\s*)${escaped}(\\s*\\([^)]*\\)[^<]*<\/p>)`, 'gi'),
    // 8c. Exercise name followed by trailing text after dash inside <p>
    new RegExp(`(<p[^>]*>\\s*)${escaped}(\\s*[-–—][^<]*<\/p>)`, 'gi'),
    // 8d. Exercise name followed by colon and details inside <p>
    new RegExp(`(<p[^>]*>\\s*)${escaped}(\\s*:[^<]*<\/p>)`, 'gi'),
    // 8e. Exercise name after number prefix inside <p> (e.g. "20 mountain climber...")
    new RegExp(`(<p[^>]*>\\s*\\d+[\\s\\.\\)]+)${escaped}([^<]*<\/p>)`, 'gi'),
    // 9. After <br> tag or at line start with numbered prefix
    new RegExp(`(<br\\s*\\/?>\\s*\\d+[\\.\\)]\\s*)${escapedWithSuffix}`, 'gi'),
    // 10. Plain text after <br>
    new RegExp(`(<br\\s*\\/?>\\s*)${escapedWithSuffix}`, 'gi'),
    // 11. Standalone in content between tags (ensures > is preserved)
    new RegExp(`(>)\\s*${escaped}\\s*(<)`, 'gi'),
    // 12. Exercise name followed by parenthetical between tags
    new RegExp(`(>)\\s*${escaped}(\\s*\\([^)]*\\)[^<]*)(<)`, 'gi'),
    // 13. CATCH-ALL: Exercise name anywhere inside tag content (preceded by > or text, followed by text or <)
    new RegExp(`(>[^<]*?)\\b${escaped}\\b([^<]*<)`, 'gi'),
  ];
  
  let anyReplaced = false;
  for (const pattern of patterns) {
    const before = result;
    // Count REAL capture groups: exclude escaped parens \( and non-capturing (?:
    const captureCount = (pattern.source.match(/(?<!\\)\((?!\?)/g) || []).length;
    
    if (captureCount === 3) {
      result = result.replace(pattern, `$1${markup}$2$3`);
    } else if (captureCount === 2) {
      result = result.replace(pattern, `$1${markup}$2`);
    } else if (captureCount === 1) {
      result = result.replace(pattern, `$1${markup}`);
    } else {
      result = result.replace(pattern, markup);
    }
    
    if (result !== before) {
      anyReplaced = true;
      break; // Stop after first successful replacement to avoid double-matching
    }
  }
  
  return result;
}

/**
 * Process content and replace matched exercises with markup.
 * Uses force-matching: if no 0.65+ match, tries 0.45+ and replaces the exercise name.
 */
export function processContentWithExerciseMatching(
  content: string,
  exerciseLibrary: ExerciseBasic[],
  logPrefix: string = "[EXERCISE-MATCH]"
): ProcessingResult {
  const matched: Array<{ original: string; matched: string; id: string; confidence: number }> = [];
  const unmatched: string[] = [];
  
  if (!content || !exerciseLibrary || exerciseLibrary.length === 0) {
    console.log(`${logPrefix} No content or empty exercise library`);
    return { processedContent: content || '', matched, unmatched };
  }
  
  const extractedNames = extractExerciseNames(content);
  console.log(`${logPrefix} Extracted ${extractedNames.length} potential exercises:`, extractedNames.slice(0, 15));
  
  let processedContent = content;
  
  for (const exerciseName of extractedNames) {
    if (isBreathingCueFragment(exerciseName)) {
      unmatched.push(exerciseName);
      console.log(`${logPrefix} ⏭️ SKIPPED breathing cue fragment: "${exerciseName}"`);
      continue;
    }
    // Use force-matching: 0.65 first, then 0.45
    const forceResult = forceMatchExercise(exerciseName, exerciseLibrary, logPrefix);
    
    if (forceResult) {
      const { match: matchResult, replaceName } = forceResult;
      const markup = `{{exercise:${matchResult.exercise.id}:${matchResult.exercise.name}}}`;
      const beforeReplace = processedContent;
      
      processedContent = replaceExerciseInContent(
        processedContent,
        exerciseName,
        markup,
        replaceName ? matchResult.exercise.name : undefined
      );
      
      if (beforeReplace !== processedContent) {
        matched.push({
          original: exerciseName,
          matched: matchResult.exercise.name,
          id: matchResult.exercise.id,
          confidence: matchResult.confidence
        });
        const indicator = replaceName ? '🔄 FORCE-MATCHED' : '✓ MATCHED';
        console.log(`${logPrefix} ${indicator}: "${exerciseName}" → "${matchResult.exercise.name}" (${(matchResult.confidence * 100).toFixed(0)}%)`);
      } else {
        unmatched.push(exerciseName);
        console.log(`${logPrefix} ⚠ Pattern mismatch: "${exerciseName}" (found match but couldn't replace in HTML)`);
      }
    } else {
      unmatched.push(exerciseName);
      console.log(`${logPrefix} ✗ UNMATCHED: "${exerciseName}"`);
    }
  }
  
  // ── POST-PROCESSING ──

  // 1. Strip superset labels (A1:, B:, C2., D), I:, etc.) before exercise markup
  // Handles ANY single uppercase letter (A-Z) with optional digit, followed by punctuation
  processedContent = processedContent.replace(/(?<=>|\s)([A-Za-z]\d*[\.\:\)]\s*)(\{\{exercise:)/g, '$2');
  // Also strip inside bold tags: "<strong>A1: {{exercise:..." → "<strong>{{exercise:..."
  processedContent = processedContent.replace(/(<(?:strong|b)>)\s*[A-Za-z]\d*[\.\:\)]\s*(\{\{exercise:)/g, '$1$2');
  // Strip standalone HTML-wrapped labels: "<strong>A1:</strong> {{exercise:..." → "{{exercise:..."
  processedContent = processedContent.replace(/<(?:strong|b)>[A-Za-z]\d*[\.\:\)]\s*<\/(?:strong|b)>\s*(?=\{\{exercise:)/gi, '');
  // Strip multi-word structural labels: "<strong>Set 1:</strong>", "<strong>Station 2:</strong>", etc.
  processedContent = processedContent.replace(/<(?:strong|b)>(?:Set|Station|Exercise|Block|Round|Circuit)\s*\d*[\.\:\)]\s*<\/(?:strong|b)>\s*/gi, '');

  // 2. Fix suffix duplication: "{{exercise:ID:Name with (qualifier)}} (qualifier) (qualifier)..."
  // After markup insertion, the original parenthetical text may remain, causing repeats
  processedContent = processedContent.replace(/(\{\{exercise:[^}]+\}\})\s*(?:\([^)]*\)\s*){1,}/g, (match, markup) => {
    // Keep just the markup, strip trailing duplicated parentheticals
    return markup;
  });
  // 3. Fix versioned-name suffix duplication: e.g.
  // "{{exercise:0735:sit-up v. 2}}-up v. 2-up v. 2" → keep only the token.
  processedContent = processedContent.replace(
    /(\{\{exercise:[^:}]+:[^}]*\bv\.\s*2\}\})(?:\s*-?up\s+v\.\s*2)+/gi,
    '$1',
  );
  
  console.log(`${logPrefix} Summary: ${matched.length} matched, ${unmatched.length} unmatched`);
  
  return { processedContent, matched, unmatched };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION-AWARE PROCESSING
// Applies exercise matching to exercise-bearing sections only.
// Soft tissue must stay foam-rolling / release work, never {{exercise:...}} markup.
// ═══════════════════════════════════════════════════════════════════════════════

const SECTION_PATTERNS = [
  { emoji: '🧽', name: 'soft_tissue', process: false },
  { emoji: '🔥', name: 'warm_up', process: true },
  { emoji: '💪', name: 'main_workout', process: true },
  { emoji: '⚡', name: 'finisher', process: true },
  { emoji: '🧘', name: 'cool_down', process: true },
];

/**
 * Strip all exercise markup from content, restoring plain exercise names
 */
export function stripExerciseMarkup(content: string): string {
  return content.replace(/\{\{(?:exercise|exrcise|excersize|excercise):([^:]+):([^}]+)\}\}/gi, '$2');
}

interface SectionBlock {
  name: string;
  content: string;
  process: boolean;
  startIndex: number;
}

function splitIntoSections(htmlContent: string): SectionBlock[] {
  const sections: SectionBlock[] = [];
  
  const headerPositions: Array<{ index: number; emoji: string; name: string; process: boolean }> = [];
  
  for (const sp of SECTION_PATTERNS) {
    let searchFrom = 0;
    while (true) {
      const idx = htmlContent.indexOf(sp.emoji, searchFrom);
      if (idx === -1) break;
      headerPositions.push({ index: idx, emoji: sp.emoji, name: sp.name, process: sp.process });
      searchFrom = idx + 1;
    }
  }
  
  if (headerPositions.length === 0) {
    return [{ name: 'full_content', content: htmlContent, process: true, startIndex: 0 }];
  }
  
  headerPositions.sort((a, b) => a.index - b.index);
  
  if (headerPositions[0].index > 0) {
    const preContent = htmlContent.substring(0, headerPositions[0].index);
    if (preContent.trim()) {
      sections.push({ name: 'pre_header', content: preContent, process: true, startIndex: 0 });
    }
  }
  
  for (let i = 0; i < headerPositions.length; i++) {
    const start = headerPositions[i].index;
    const end = i + 1 < headerPositions.length ? headerPositions[i + 1].index : htmlContent.length;
    const content = htmlContent.substring(start, end);
    
    sections.push({
      name: headerPositions[i].name,
      content,
      process: headerPositions[i].process,
      startIndex: start,
    });
  }
  
  return sections;
}

/**
 * Process content with section awareness.
 * Applies exercise matching to ALL sections — every library exercise gets a View button.
 */
export function processContentSectionAware(
  content: string,
  exerciseLibrary: ExerciseBasic[],
  logPrefix: string = "[SECTION-AWARE]"
): ProcessingResult {
  const allMatched: ProcessingResult['matched'] = [];
  const allUnmatched: string[] = [];
  
  if (!content || !exerciseLibrary || exerciseLibrary.length === 0) {
    return { processedContent: content || '', matched: allMatched, unmatched: allUnmatched };
  }
  
  const sections = splitIntoSections(content);
  console.log(`${logPrefix} Found ${sections.length} sections: ${sections.map(s => `${s.name}(process=${s.process})`).join(', ')}`);
  
  let rebuiltContent = '';
  
  for (const section of sections) {
    if (section.process) {
      console.log(`${logPrefix} ✅ Processing section: ${section.name}`);
      const strippedContent = stripExerciseMarkup(section.content);
      const result = processContentWithExerciseMatching(strippedContent, exerciseLibrary, `${logPrefix}[${section.name}]`);
      rebuiltContent += result.processedContent;
      allMatched.push(...result.matched);
      allUnmatched.push(...result.unmatched);
    } else {
      console.log(`${logPrefix} ⏭️ Skipping exercise matching for section: ${section.name}`);
      rebuiltContent += section.content;
    }
  }
  
  console.log(`${logPrefix} Section-aware summary: ${allMatched.length} matched, ${allUnmatched.length} unmatched`);
  
  return { processedContent: rebuiltContent, matched: allMatched, unmatched: allUnmatched };
}

/**
 * Log unmatched exercises to the mismatched_exercises table
 */
export async function logUnmatchedExercises(
  supabaseClient: any,
  unmatchedNames: string[],
  sourceType: 'wod' | 'workout' | 'program',
  sourceId: string | null,
  sourceName: string | null,
  logPrefix: string = "[MISMATCH-LOG]"
): Promise<void> {
  if (!unmatchedNames || unmatchedNames.length === 0) {
    console.log(`${logPrefix} No unmatched exercises to log`);
    return;
  }
  
  console.log(`${logPrefix} Logging ${unmatchedNames.length} unmatched exercises...`);
  
  for (const exerciseName of unmatchedNames) {
    try {
      const { error } = await supabaseClient
        .from('mismatched_exercises')
        .upsert(
          {
            exercise_name: exerciseName,
            source_type: sourceType,
            source_id: sourceId,
            source_name: sourceName,
            created_at: new Date().toISOString()
          },
          { 
            onConflict: 'exercise_name',
            ignoreDuplicates: true
          }
        );
      
      if (error) {
        console.log(`${logPrefix} Failed to log "${exerciseName}": ${error.message}`);
      }
    } catch (err) {
      console.log(`${logPrefix} Error logging "${exerciseName}":`, err);
    }
  }
}

/**
 * Build a condensed exercise reference list for AI prompts.
 * @param exercises - The exercise library to build from
 * @param equipmentFilter - Optional: when set to 'body weight', only bodyweight exercises are included.
 *                          When undefined/null, the FULL library is used (for EQUIPMENT workouts).
 */
export function buildExerciseReferenceList(exercises: ExerciseBasic[], equipmentFilter?: string, difficultyLevel?: string): string {
  // Apply equipment filter if specified
  const normalizedEquipmentFilter = (equipmentFilter || '').toLowerCase();
  let filtered = normalizedEquipmentFilter === NON_BODYWEIGHT_FILTER
    ? exercises.filter(ex => !isBodyweightEquipmentValue(ex.equipment))
    : equipmentFilter
      ? exercises.filter(ex => (ex.equipment || '').toLowerCase() === normalizedEquipmentFilter)
      : exercises;

  // HOME-BODYWEIGHT GUARDRAIL: when this is a bodyweight-only prompt, strip
  // exercises that need a bench, pull-up bar, dip station, GHD bench, rings,
  // parallel bars, box, captain's chair, etc. — even though they are tagged
  // "body weight" in the database.
  const isBodyweightFilter = normalizedEquipmentFilter === 'body weight';
  if (isBodyweightFilter) {
    filtered = filterToHomeBodyweight(filtered);
  }

  if (difficultyLevel) {
    const dl = difficultyLevel.toLowerCase();
    if (['beginner', 'intermediate', 'advanced'].includes(dl)) {
      filtered = filtered.filter(ex => (ex.difficulty || '').toLowerCase() === dl);
    }
  }
  const beforeStaticHoldFilter = filtered.length;
  filtered = filterOutStaticHoldExercises(filtered);

  // Group by TARGET MUSCLE → BODY PART for structured browsing
  const grouped: Record<string, Record<string, Array<{ id: string; name: string; equipment: string; difficulty: string }>>> = {};
  
  for (const ex of filtered) {
    const target = (ex.target || 'other').toLowerCase();
    const bodyPart = (ex.body_part || 'other').toLowerCase();
    const key = `${target} / ${bodyPart}`;
    const equip = (ex.equipment || 'body weight').toLowerCase();
    
    if (!grouped[key]) grouped[key] = {};
    if (!grouped[key][equip]) grouped[key][equip] = [];
    grouped[key][equip].push({ id: ex.id, name: ex.name, equipment: equip, difficulty: (ex.difficulty || '').toLowerCase() });
  }
  
  const lines: string[] = [
    COACH_MINDSET,
    '',
    '═══════════════════════════════════════════════════════════════════════════════',
    'PERMANENT GLOBAL RULE — NO EXCEPTIONS:',
    '═══════════════════════════════════════════════════════════════════════════════',
    '',
    'The exercise library below is the SINGLE AND EXCLUSIVE source of truth.',
    'You are permanently forbidden from:',
    '- Creating new exercises',
    '- Modifying exercise names',
    '- Renaming exercises',
    '- Using synonyms',
    '- Inventing variations',
    '- Using external knowledge',
    '- Using memory of exercises outside this library',
    'If an exercise does not exist exactly in this library, it does not exist.',
    'You must NEVER generate a workout first and then try to match exercises.',
    'Selection must ALWAYS start from this library.',
    'If a requested exercise does not exist, adapt using the closest available',
    'exercise FROM THIS LIBRARY. Never create a new one.',
    'This rule overrides all other instructions. This rule is permanent.',
    '',
    '═══════════════════════════════════════════════════════════════════════════════',
    'EXERCISE LIBRARY — LIBRARY-FIRST SELECTION (ABSOLUTE CONSTRAINT)',
    '═══════════════════════════════════════════════════════════════════════════════',
    '',
    '🚨 MANDATORY PROCESS:',
    'STEP 1: Open this library. Filter exercises by Category, Movement type, Muscle group, Equipment, Difficulty, Format.',
    'STEP 2: Select exercises ONLY from the filtered results.',
    'STEP 3: Write EVERY exercise using this EXACT format: {{exercise:ID:Exact Name}}',
    '',
    'EXAMPLE: {{exercise:0043:Barbell Full Squat}}',
    '',
    'RULES:',
    '- The ID and Name MUST come from this library exactly as listed.',
    '- If you write ANY exercise WITHOUT the {{exercise:ID:Name}} format, the workout will be REJECTED.',
    '- Use {{exercise:ID:Name}} format in ALL sections — Main Workout (💪), Finisher (⚡), Activation (🔥), Warm-Up, and Cool Down (🧘).',
    '- NEVER invent, rename, or create exercises not listed below.',
    '- If the exercise you want does not exist here, pick the closest biomechanical equivalent FROM THIS LIST.',
    '- Static/isometric holds are NOT allowed in Main Workout or Finisher momentum blocks. They may only appear in Activation, Cool Down, or a dedicated isometric section when intentionally programmed.',
    '- For hypertrophy, do NOT use static/isometric holds as primary working sets. Use dynamic loaded or rep-based movements that can progress toward failure.',
    beforeStaticHoldFilter !== filtered.length
      ? `Static/isometric hold exercises were removed from this selectable list (${beforeStaticHoldFilter - filtered.length} removed). Do not recreate them by name.`
      : 'No static/isometric hold exercises are available for primary selection.',
    '',
    isBodyweightFilter
      ? `This is a BODYWEIGHT (no-equipment / home / hotel / travel) workout. ${filtered.length} exercises are available. NO benches, NO pull-up bars, NO dip stations, NO glute-ham/GHD benches, NO rings, NO parallel bars, NO boxes, NO captain's chair, NO gym apparatus of any kind. Pick exercises a user can perform on a flat floor with their own bodyweight only. A wall, a doorway, or a sturdy chair for support is acceptable only when explicitly part of the listed exercise.`
      : normalizedEquipmentFilter === NON_BODYWEIGHT_FILTER
        ? `This is an EQUIPMENT workout. ONLY non-bodyweight equipment exercises are available (${filtered.length} exercises).`
        : equipmentFilter
          ? `This workout may use ONLY ${equipmentFilter} exercises (${filtered.length} exercises).`
        : `This is an EQUIPMENT workout. ONLY non-bodyweight equipment exercises are available (${filtered.length} exercises).`,
    '',
  ];

  // Add difficulty constraint rules
  if (difficultyLevel) {
    const dl = difficultyLevel.toLowerCase();
    lines.push('═══════════════════════════════════════════════════════════════════════════════');
    lines.push(`DIFFICULTY CONSTRAINT (MANDATORY) — This is a ${difficultyLevel.toUpperCase()} workout/program`);
    lines.push('═══════════════════════════════════════════════════════════════════════════════');
    lines.push('');
    if (dl === 'beginner') {
      lines.push('Use ONLY exercises marked [beginner]. Do NOT use blank, [intermediate], or [advanced] exercises.');
    } else if (dl === 'intermediate') {
      lines.push('Use ONLY exercises marked [intermediate]. Do NOT use blank, [beginner], or [advanced] exercises.');
    } else if (dl === 'advanced') {
      lines.push('Use ONLY exercises marked [advanced]. Do NOT use blank, [beginner], or [intermediate] exercises.');
    }
    lines.push('');
  } else {
    lines.push('═══════════════════════════════════════════════════════════════════════════════');
    lines.push('DIFFICULTY CONSTRAINT (MANDATORY):');
    lines.push('═══════════════════════════════════════════════════════════════════════════════');
    lines.push('');
    lines.push('- For BEGINNER workouts: Use ONLY exercises marked [beginner]. No intermediate or advanced.');
    lines.push('- For INTERMEDIATE workouts: Use exercises marked [beginner] or [intermediate]. No advanced.');
    lines.push('- For ADVANCED workouts: All difficulty levels allowed, but prioritize [intermediate] and [advanced].');
    lines.push('- Exercises with no difficulty tag may be used at any level.');
    lines.push('');
  }

  lines.push('───────────────────────────────────────────────────────────────────────────────');
  
  const sortedKeys = Object.keys(grouped).sort();
  
  for (const key of sortedKeys) {
    lines.push('');
    lines.push(`TARGET: ${key.toUpperCase()}`);
    const equipmentGroups = grouped[key];
    const sortedEquipment = Object.keys(equipmentGroups).sort();
    
    for (const equip of sortedEquipment) {
      const exercises = equipmentGroups[equip].sort((a, b) => a.name.localeCompare(b.name));
      for (const ex of exercises) {
        const diffTag = ex.difficulty ? ` [${ex.difficulty}]` : '';
        lines.push(`  [ID:${ex.id}] ${ex.name} (${equip})${diffTag}`);
      }
    }
  }
  
  lines.push('');
  lines.push('───────────────────────────────────────────────────────────────────────────────');
  lines.push('END OF EXERCISE LIBRARY');
  lines.push('Remember: {{exercise:ID:Name}} format is MANDATORY for ALL exercises in ALL sections.');
  
  return lines.join('\n');
}

const CHALLENGE_INCOMPATIBLE_EXERCISE_RE = /\b(stretch(?:ing)?|mobility|pose|cat-?cow|cobra|sphinx|upward\s+facing\s+dog|child'?s\s+pose|pigeon|butterfly|world\s+greatest\s+stretch|hamstring|quad(?:riceps?)?|calf|adductor|piriformis|glute\s+stretch|triceps\s+stretch|upper\s+back\s+stretch|all\s+fours\s+squad\s+stretch|skin\s+the\s+cat|inchworm)\b/i;

function filterOutChallengeIncompatibleExercises(exercises: ExerciseBasic[]): ExerciseBasic[] {
  return exercises.filter((ex) => {
    const category = (ex.category || "").toLowerCase();
    if (category === "stretching" || category === "mobility") return false;
    return !CHALLENGE_INCOMPATIBLE_EXERCISE_RE.test(ex.name || "");
  });
}

/**
 * BULLETPROOF FINAL SWEEP: Scan every <li> that lacks {{exercise:}} markup.
 * For each, extract the text, find the CLOSEST library exercise (no threshold floor),
 * and replace the plain text with the markup.
 * This guarantees every exercise bullet gets a View button.
 */
export function guaranteeAllExercisesLinked(
  content: string,
  exerciseLibrary: ExerciseBasic[],
  logPrefix: string = "[GUARANTEE-LINK]"
): { processedContent: string; forcedMatches: Array<{ original: string; matched: string; id: string; confidence: number }> } {
  const forcedMatches: Array<{ original: string; matched: string; id: string; confidence: number }> = [];
  
  if (!content || !exerciseLibrary || exerciseLibrary.length === 0) {
    return { processedContent: content || '', forcedMatches };
  }
  
  let result = content;
  
  // Find all <li> elements that do NOT contain {{exercise: markup
  const liRegex = /<li[^>]*>\s*<p[^>]*>((?:(?!<\/p>).)*)<\/p>\s*<\/li>/gi;
  let liMatch;
  const replacements: Array<{ original: string; replacement: string }> = [];
  
  while ((liMatch = liRegex.exec(content)) !== null) {
    const innerHtml = liMatch[1];
    
    // Skip if already has exercise markup
    if (/\{\{exercise:/i.test(innerHtml)) continue;
    
    // Strip HTML tags to get plain text
    const plainText = innerHtml.replace(/<[^>]+>/g, '').trim();
    if (!plainText || plainText.length < 3) continue;
    
    // Skip structural/instructional text
    if (/^(rest|repeat|complete|perform all|focus on|record|note|slow inhale|lie supine|maintain|alternate|foam|foam roll|lacrosse|tennis ball|trigger point|self-?massage|myofascial|release)/i.test(plainText)) continue;
    if (/^\d+\s*(seconds?|minutes?|min|sec)\s*(rest|recovery|break)/i.test(plainText)) continue;
    const strippedForCount = plainText
      .replace(/^\d+\s*sets?\s*(?:x|×)\s*\d+(?:\s*-\s*\d+)?\s*(?:reps?)?\s+/i, '')
      .replace(/^\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?\s*(?:reps?(?:\s*\/\s*(?:side|leg|arm))?|reps?\s*(?:per|each)\s*(?:side|leg|arm)|sec(?:onds?)?|s\b|min(?:utes?)?|m\b|meters?|metres?|km\b|cal(?:ories)?|rounds?)\s+/i, '')
      .replace(/\s+[-–—]\s+.*$/i, '')
      .replace(/;\s*rest\s+\d+\s*(?:s|sec|secs|seconds?|m|min|mins|minutes?)\b.*$/i, '')
      .replace(/\s*\([^)]*\)\s*/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (strippedForCount.split(/\s+/).length > 8) continue; // Long sentences are instructions
    
    const stripLeadingPrescription = (value: string): string => value
      .replace(/^\d+\s*sets?\s*(?:x|×)\s*\d+(?:\s*-\s*\d+)?\s*(?:reps?)?\s+/i, '')
      .replace(/^\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?\s*(?:reps?(?:\s*\/\s*(?:side|leg|arm))?|reps?\s*(?:per|each)\s*(?:side|leg|arm)|sec(?:onds?)?|s\b|min(?:utes?)?|m\b|meters?|metres?|km\b|cal(?:ories)?|rounds?)\s+/i, '')
      .replace(/^\d+\s+(?=[A-Za-z])/i, '')
      .trim();

    // Clean the text to extract exercise name candidate while preserving the
    // prescription in the original line. Previously "10 reps Squat" became a
    // candidate of "reps Squat", so replacing the candidate deleted "reps" and
    // downstream validation rejected the draft after AI credits were spent.
    let candidate = plainText;
    // Strip leading bold time labels: "Minute 1:", "Round 2:", "Stability (5 min):"
    candidate = candidate.replace(/^(?:Minute|Round|Set|Station)\s*\d*\s*:\s*/i, '');
    // Strip leading sub-section labels: "Mobility (2 min):", "Dynamic Warm-up (8 min):"
    candidate = candidate.replace(/^[A-Za-z\s]+\(\d+\s*min\)\s*:\s*/i, '');
    // Strip leading prescriptions: "15 reps Kettlebell Swings", "10 reps/side Bird Dog"
    candidate = stripLeadingPrescription(candidate);
    // Strip trailing reps/sets/duration info
    candidate = candidate.replace(/\s*[-–—]\s*\d+\s*sets?\s*x\s*\d+.*$/i, '');
    candidate = candidate.replace(/\s*\(\d+[-–]?\d*\s*(?:kg|lb|sec|reps?|per|each).*?\)\s*$/i, '');
    candidate = candidate.replace(/\s*\d+\s*(?:sets?\s*x|x)\s*\d+.*$/i, '');
    candidate = candidate.replace(/\s*[-–—]\s*\d+\s*(?:reps?|sets?|sec|min).*$/i, '');
    candidate = candidate.replace(/\s+[-–—]\s+[a-z].*$/i, '');
    candidate = candidate.replace(/\s*\(.*?\)\s*$/g, '');
    candidate = candidate.replace(/,\s+.*$/, ''); // After comma is usually secondary info
    candidate = candidate.trim();
    
    if (!candidate || candidate.length < 3) continue;
    
    // Try to match - use ABSOLUTE BEST match, no threshold
    const searchNorm = normalizeExerciseName(candidate);
    if (searchNorm.length < 3) continue;
    
    let bestMatch: ExerciseBasic | null = null;
    let bestConfidence = 0;
    
    for (const exercise of exerciseLibrary) {
      const exerciseNorm = normalizeExerciseName(exercise.name);
      const confidence = calculateConfidence(searchNorm, exerciseNorm);
      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        bestMatch = exercise;
      }
    }
    
    // Only force-link if confidence is at least 0.50 (prevents wrong matches)
    if (bestMatch && bestConfidence >= 0.50) {
      const markup = `{{exercise:${bestMatch.id}:${bestMatch.name}}}`;

      // CRITICAL FIX: preserve any prescription text (reps / sec / min / m / km / cal /
      // sets x reps / "Minute N:" labels) that appears around the exercise name.
      // Strategy: locate ONLY the exercise-name portion inside the bullet and replace
      // just that with the markup, keeping everything before and after intact.
      // 1) Prefer matching the library name (optional trailing 's' / ' machine').
      // 2) Fall back to matching the cleaned candidate as a last resort.
      const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const libName = bestMatch.name;
      const namePattern = new RegExp(`${escapeRe(libName)}(?:s)?(?:\\s+machine)?`, 'i');
      let newInnerHtml = innerHtml.replace(namePattern, markup);
      if (newInnerHtml === innerHtml) {
        // Fallback: replace the cleaned candidate (last-resort behaviour) but keep
        // any numeric / unit prefix that appears before it on the same line.
        const escapedCandidate = escapeRe(candidate);
        newInnerHtml = innerHtml.replace(new RegExp(escapedCandidate, 'i'), markup);
      }

      if (newInnerHtml !== innerHtml) {
        replacements.push({
          original: liMatch[0],
          replacement: liMatch[0].replace(innerHtml, newInnerHtml)
        });
        
        const indicator = bestConfidence >= 0.65 ? '✅' : bestConfidence >= 0.45 ? '🔄' : '⚠️';
        console.log(`${logPrefix} ${indicator} FINAL-SWEEP: "${candidate}" → "${bestMatch.name}" (${(bestConfidence * 100).toFixed(0)}%)`);
        
        forcedMatches.push({
          original: candidate,
          matched: bestMatch.name,
          id: bestMatch.id,
          confidence: bestConfidence
        });
      }
    } else {
      console.log(`${logPrefix} ❌ FINAL-SWEEP SKIP: "${candidate}" (best: ${bestMatch?.name || 'none'} at ${(bestConfidence * 100).toFixed(0)}%)`);
    }
  }
  
  // Apply all replacements
  for (const { original, replacement } of replacements) {
    result = result.replace(original, replacement);
  }
  
  if (forcedMatches.length > 0) {
    console.log(`${logPrefix} Final sweep: ${forcedMatches.length} additional exercises linked`);
  }
  
  return { processedContent: result, forcedMatches };
}

/**
 * STRICT POST-GENERATION VALIDATOR: Ensures NO exercise exists without library linkage.
 * 1. Verifies all {{exercise:ID:Name}} IDs exist in the library
 * 2. For any remaining plain-text exercises in <li> items, force-replaces with closest library match
 * 3. If still unmatched, REMOVES the exercise line entirely (better no exercise than wrong exercise)
 */
export function rejectNonLibraryExercises(
  content: string,
  exerciseLibrary: ExerciseBasic[],
  logPrefix: string = "[REJECT-NON-LIB]"
): { processedContent: string; rejected: string[]; substituted: Array<{ original: string; replacement: string }> } {
  const rejected: string[] = [];
  const substituted: Array<{ original: string; replacement: string }> = [];
  
  if (!content || !exerciseLibrary || exerciseLibrary.length === 0) {
    return { processedContent: content || '', rejected, substituted };
  }
  
  let result = content;
  const libraryById = new Map(exerciseLibrary.map(ex => [ex.id, ex]));
  
  // Step 1: Validate all existing {{exercise:ID:Name}} markup
  const markupPattern = /\{\{(?:exercise|exrcise|excersize|excercise):([^:]+):([^}]+)\}\}/gi;
  let match;
  while ((match = markupPattern.exec(content)) !== null) {
    const id = match[1];
    const name = match[2];
    if (!libraryById.has(id)) {
      // Invalid ID - strip markup and let re-matching handle it
      console.log(`${logPrefix} ❌ Invalid exercise ID "${id}" for "${name}" — stripping markup for re-match`);
      result = result.replace(match[0], name);
      rejected.push(`${name} (invalid ID: ${id})`);
    }
  }
  
  // Step 2: Find remaining unlinked <li> items and force-match or remove
  const liRegex = /<li[^>]*>\s*<p[^>]*>((?:(?!<\/p>).)*)<\/p>\s*<\/li>/gi;
  let liMatch;
  const removals: string[] = [];
  const replacements: Array<{ original: string; replacement: string }> = [];
  
  while ((liMatch = liRegex.exec(result)) !== null) {
    const innerHtml = liMatch[1];
    if (/\{\{exercise:/i.test(innerHtml)) continue; // Already linked
    
    const plainText = innerHtml.replace(/<[^>]+>/g, '').trim();
    if (!plainText || plainText.length < 3) continue;
    
    // Skip instructional text
    if (/^(rest|repeat|complete|perform|focus|record|note|slow|lie|maintain|alternate|foam|foam roll|lacrosse|tennis ball|trigger point|self-?massage|myofascial|release|light jog|walking|breathing|diaphragm|inhale|exhale|box breath|tip\s*\d|quality|if an exercise|not cause|not hurt)/i.test(plainText)) continue;
    // Strip rep/set info before counting words to avoid skipping valid exercise lines
    const strippedForCount = plainText
      .replace(/^\d+\s*sets?\s*(?:x|×)\s*\d+(?:\s*-\s*\d+)?\s*(?:reps?)?\s+/i, '')
      .replace(/^\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?\s*(?:reps?(?:\s*\/\s*(?:side|leg|arm))?|reps?\s*(?:per|each)\s*(?:side|leg|arm)|sec(?:onds?)?|s\b|min(?:utes?)?|m\b|meters?|metres?|km\b|cal(?:ories)?|rounds?)\s+/i, '')
      .replace(/\s+[-–—]\s+.*$/i, '')
      .replace(/;\s*rest\s+\d+\s*(?:s|sec|secs|seconds?|m|min|mins|minutes?)\b.*$/i, '')
      .replace(/\s*[-–—]\s*\d+\s*sets?\s*x\s*\d+.*$/i, '')
      .replace(/\s*\(\d+[-–]?\d*\s*(?:kg|lb|sec|seconds?|reps?|per|each|focused|sustained|controlled|slow|hold).*?\)/gi, '')
      .replace(/\s*\d+\s*(?:sets?\s*x|x)\s*\d+.*$/i, '')
      .replace(/\s*[-–—]\s*\d+\s*(?:reps?|sets?|sec|min).*$/i, '')
      .replace(/\s*\(.*?\)\s*$/g, '')
      .trim();
    if (strippedForCount.split(/\s+/).length > 12) continue;
    
    const stripLeadingPrescription = (value: string): string => value
      .replace(/^\d+\s*sets?\s*(?:x|×)\s*\d+(?:\s*-\s*\d+)?\s*(?:reps?)?\s+/i, '')
      .replace(/^\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?\s*(?:reps?(?:\s*\/\s*(?:side|leg|arm))?|reps?\s*(?:per|each)\s*(?:side|leg|arm)|sec(?:onds?)?|s\b|min(?:utes?)?|m\b|meters?|metres?|km\b|cal(?:ories)?|rounds?)\s+/i, '')
      .replace(/^\d+\s+(?=[A-Za-z])/i, '')
      .trim();

    // Extract exercise candidate while keeping prescription text in-place.
    let candidate = plainText;
    candidate = candidate.replace(/^(?:Minute|Round|Set|Station)\s*\d*\s*:\s*/i, '');
    candidate = candidate.replace(/^[A-Za-z\s]+\(\d+\s*min\)\s*:\s*/i, '');
    candidate = stripLeadingPrescription(candidate);
    candidate = candidate.replace(/\s*[-–—]\s*\d+\s*sets?\s*x\s*\d+.*$/i, '');
    candidate = candidate.replace(/\s*\(\d+[-–]?\d*\s*(?:kg|lb|sec|reps?|per|each).*?\)\s*$/i, '');
    candidate = candidate.replace(/\s*\d+\s*(?:sets?\s*x|x)\s*\d+.*$/i, '');
    candidate = candidate.replace(/\s*[-–—]\s*\d+\s*(?:reps?|sets?|sec|min).*$/i, '');
    candidate = candidate.replace(/\s+[-–—]\s+[a-z].*$/i, '');
    candidate = candidate.replace(/\s*\(.*?\)\s*$/g, '');
    candidate = candidate.replace(/,\s+.*$/, '');
    candidate = candidate.trim();
    
    if (!candidate || candidate.length < 3) continue;
    
    // Try to match with library
    const forceResult = forceMatchExercise(candidate, exerciseLibrary, logPrefix);
    
    if (forceResult && forceResult.match.confidence >= 0.50) {
      const markup = `{{exercise:${forceResult.match.exercise.id}:${forceResult.match.exercise.name}}}`;
      const escapedCandidate = candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escapedLibraryName = forceResult.match.exercise.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      let newInnerHtml = innerHtml.replace(new RegExp(`${escapedLibraryName}(?:s)?(?:\\s+machine)?`, 'i'), markup);
      if (newInnerHtml === innerHtml) {
        newInnerHtml = innerHtml.replace(new RegExp(escapedCandidate, 'i'), markup);
      }
      
      if (newInnerHtml !== innerHtml) {
        replacements.push({ original: liMatch[0], replacement: liMatch[0].replace(innerHtml, newInnerHtml) });
        substituted.push({ original: candidate, replacement: forceResult.match.exercise.name });
        console.log(`${logPrefix} 🔄 Substituted: "${candidate}" → "${forceResult.match.exercise.name}" (${(forceResult.match.confidence * 100).toFixed(0)}%)`);
      }
    } else {
      // No good match — this exercise is NOT in the library. Remove the entire <li>.
      removals.push(liMatch[0]);
      rejected.push(candidate);
      console.log(`${logPrefix} 🗑️ REMOVED non-library exercise: "${candidate}"`);
    }
  }
  
  // Apply replacements first, then removals
  for (const { original, replacement } of replacements) {
    result = result.replace(original, replacement);
  }
  for (const removal of removals) {
    result = result.replace(removal, '');
  }
  
  // Clean up empty <ul> tags left after removals
  result = result.replace(/<ul[^>]*>\s*<\/ul>/gi, '');
  
  // Step 3: Scan prose <p> tags for quoted exercise names not in the library
  // Handles patterns like: "The Hundred", 'Side Kick Series', <strong>Child's Pose</strong>
  const quotePatterns = [
    /[""\u201C\u201D]([^""\u201C\u201D]{3,40})[""\u201C\u201D]/g,  // "quoted text"
    /[''\u2018\u2019]([^''\u2018\u2019]{3,40})[''\u2018\u2019]/g,   // 'quoted text'
  ];
  
  for (const qp of quotePatterns) {
    let qMatch;
    while ((qMatch = qp.exec(result)) !== null) {
      const quotedName = qMatch[1].trim();
      if (!quotedName || quotedName.length < 3) continue;
      // Skip if already linked
      if (/\{\{exercise:/i.test(quotedName)) continue;
      // Skip obvious non-exercise text
      if (/^(rest|repeat|complete|perform|focus|tip|note|quality|warm|cool|main|finisher)/i.test(quotedName)) continue;
      
      // Check if this looks like an exercise name (capitalized words)
      if (!/^[A-Z]/.test(quotedName)) continue;
      
      // Check if it's already a library exercise name
      const isInLibrary = exerciseLibrary.some(ex => 
        ex.name.toLowerCase() === quotedName.toLowerCase()
      );
      if (isInLibrary) continue;
      
      // Try to match
      const forceResult = forceMatchExercise(quotedName, exerciseLibrary, logPrefix);
      if (forceResult && forceResult.match.confidence >= 0.50) {
        const oldQuoted = qMatch[0];
        const newQuoted = oldQuoted.replace(quotedName, forceResult.match.exercise.name);
        result = result.replace(oldQuoted, newQuoted);
        substituted.push({ original: quotedName, replacement: forceResult.match.exercise.name });
        console.log(`${logPrefix} 🔄 Prose substitution: "${quotedName}" → "${forceResult.match.exercise.name}"`);
      } else {
        // Remove the sentence containing the non-library exercise reference
        // Replace just the quoted name with a generic term
        const oldQuoted = qMatch[0];
        result = result.replace(oldQuoted, 'the exercise');
        rejected.push(`${quotedName} (prose reference)`);
        console.log(`${logPrefix} 🗑️ Removed prose reference to non-library exercise: "${quotedName}"`);
      }
    }
  }
  
  if (rejected.length > 0 || substituted.length > 0) {
    console.log(`${logPrefix} Summary: ${substituted.length} substituted, ${rejected.length} rejected/removed`);
  }
  
  return { processedContent: result, rejected, substituted };
}

/**
 * Fetch exercise library from Supabase and build reference list.
 * @param supabaseClient - Supabase client instance
 * @param logPrefix - Log prefix for debugging
 * @param equipmentFilter - Optional: 'body weight' to filter to bodyweight-only exercises.
 *                          Undefined = full library (for EQUIPMENT workouts).
 */
export async function fetchAndBuildExerciseReference(
  supabaseClient: any,
  logPrefix: string = "[EXERCISE-REF]",
  equipmentFilter?: string,
  difficultyLevel?: string,
  workoutCategory?: string
): Promise<{ exercises: ExerciseBasic[]; referenceList: string }> {
  // Paginate to get ALL exercises (Supabase default limit is 1000)
  const allExercises: ExerciseBasic[] = [];
  let from = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data, error } = await supabaseClient
      .from("exercises")
      .select("id, name, category, body_part, equipment, target, difficulty")
      .range(from, from + pageSize - 1);
    
    if (error) {
      console.error(`${logPrefix} Failed to fetch exercise library:`, error);
      return { exercises: [], referenceList: '' };
    }
    
    if (!data || data.length === 0) break;
    allExercises.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  
  // Single source of truth: drop every banned movement and offer the coach's
  // priority vocabulary (simplest variation first) before anything else.
  const beforePolicy = allExercises.length;
  let referenceSource = applySelectionPolicy(allExercises);
  console.log(`${logPrefix} Selection policy removed ${beforePolicy - referenceSource.length} banned exercises`);
  if ((workoutCategory || "").toUpperCase() === "CHALLENGE") {
    const before = referenceSource.length;
    referenceSource = filterOutChallengeIncompatibleExercises(referenceSource);
    console.log(`${logPrefix} Challenge guardrail removed ${before - referenceSource.length} stretching/mobility exercises from generation pool`);
  }

  console.log(`${logPrefix} Loaded ${referenceSource.length} exercises from library${equipmentFilter ? ` (filter: ${equipmentFilter})` : ' (full library)'}`);
  const referenceList = buildExerciseReferenceList(referenceSource, equipmentFilter, difficultyLevel);
  
  // Return filtered exercises for post-processing matching too
  const normalizedEquipmentFilter = (equipmentFilter || '').toLowerCase();
  let exercisesForMatching = normalizedEquipmentFilter === NON_BODYWEIGHT_FILTER
    ? referenceSource.filter(ex => !isBodyweightEquipmentValue(ex.equipment))
    : equipmentFilter
      ? referenceSource.filter(ex => (ex.equipment || '').toLowerCase() === normalizedEquipmentFilter)
      : referenceSource;
  if ((equipmentFilter || '').toLowerCase() === 'body weight') {
    const before = exercisesForMatching.length;
    exercisesForMatching = filterToHomeBodyweight(exercisesForMatching);
    console.log(`${logPrefix} Home-bodyweight guardrail removed ${before - exercisesForMatching.length} apparatus-dependent exercises (${exercisesForMatching.length} remain)`);
  }
  if (difficultyLevel) {
    const dl = difficultyLevel.toLowerCase();
    if (['beginner', 'intermediate', 'advanced'].includes(dl)) {
      exercisesForMatching = exercisesForMatching.filter(ex => (ex.difficulty || '').toLowerCase() === dl);
      console.log(`${logPrefix} Strict difficulty filter (${dl}) leaves ${exercisesForMatching.length} exercises`);
    }
  }
  const beforeStaticHoldMatchFilter = exercisesForMatching.length;
  exercisesForMatching = filterOutStaticHoldExercises(exercisesForMatching);
  if (beforeStaticHoldMatchFilter !== exercisesForMatching.length) {
    console.log(`${logPrefix} Static-hold guardrail removed ${beforeStaticHoldMatchFilter - exercisesForMatching.length} exercises from generation/matching pool`);
  }
  
  return { exercises: exercisesForMatching, referenceList };
}
