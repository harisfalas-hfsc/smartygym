import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, Info, BookOpen, Play } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useNavigate } from "react-router-dom";
import { WorkoutToolsCards } from "@/components/WorkoutToolsCards";
import workoutHero from "@/assets/workout-hero.jpg";
import { ParQReminder } from "@/components/ParQReminder";

import { ShareButtons } from "@/components/ShareButtons";
import { WorkoutInteractions } from "@/components/WorkoutInteractions";
import { ProgramInteractions } from "@/components/ProgramInteractions";
import { useAccessControl } from "@/hooks/useAccessControl";
import { HTMLContent } from "@/components/ui/html-content";
import { ExerciseHTMLContent } from "@/components/ExerciseHTMLContent";
import { A4Container } from "@/components/ui/a4-container";
import { ExerciseLibraryBanner } from "@/components/ExerciseLibraryBanner";
import { ReaderModeDialog } from "@/components/ReaderModeDialog";
import { normalizeWorkoutHtml } from "@/utils/htmlNormalizer";
import { WorkoutPlayerDialog } from "@/components/WorkoutPlayerDialog";
import { parseWorkoutSteps, type WorkoutStep } from "@/utils/parseWorkoutSteps";

interface Exercise {
  name: string;
  video_id: string;
  video_url: string;
  sets?: number;
  reps?: string;
  rest?: string;
  notes?: string;
}

interface WeekPlan {
  week: number;
  focus: string;
  days: Array<{
    day: string;
    exercises: Array<{
      name: string;
      sets: string;
      reps: string;
      intensity: string;
      rest: string;
      notes?: string;
    }>;
  }>;
}

interface WorkoutDisplayProps {
  exercises: Exercise[];
  planContent: string;
  title?: string;
  serial?: string;
  focus?: string;
  difficulty?: number;
  workoutType?: string;
  workoutDetails?: {
    exercises: Array<{
      name: string;
      sets: string;
      reps: string;
      rest: string;
      notes?: string;
    }>;
  };
  programWeeks?: WeekPlan[];
  imageUrl?: string;
  duration?: string;
  equipment?: string;
  description?: string;
  format?: string;
  instructions?: string;
  tips?: string;
  activation?: string;
  warm_up?: string;
  main_workout?: string;
  finisher?: string;
  cool_down?: string;
  programContent?: string;
  overview?: string;
  target_audience?: string;
  program_structure?: string;
  weekly_schedule?: string;
  progression_plan?: string;
  nutrition_tips?: string;
  expected_results?: string;
  workoutId?: string;
  workoutCategory?: string;
  programId?: string;
  offlineLocked?: boolean;
  programType?: string;
  isFreeContent?: boolean;
}

/**
 * Join workout sections with exactly ONE separator between them.
 * Removes trailing/leading empty paragraphs from each section to prevent double spacing.
 */
function joinWorkoutSections(sections: (string | undefined | null)[]): string {
  const EMPTY_P = '<p class="tiptap-paragraph"></p>';
  const EMPTY_P_PATTERN = /^(?:\s*<p[^>]*>\s*<\/p>\s*)+|(?:\s*<p[^>]*>\s*<\/p>\s*)+$/gi;
  
  const joined = sections
    .filter((s): s is string => Boolean(s && s.trim()))
    .map(section => section.replace(EMPTY_P_PATTERN, '').trim())
    .filter(s => s.length > 0)
    .join(EMPTY_P);

  return normalizeWorkoutHtml(joined);
}

function parseWorkoutSectionSteps(sectionLabel: string, html?: string | null): WorkoutStep[] {
  if (!html?.trim()) return [];
  return parseWorkoutSteps(normalizeWorkoutHtml(html)).map((step) => ({
    ...step,
    section: step.section || sectionLabel,
  }));
}

export const WorkoutDisplay = ({
  exercises, 
  planContent, 
  title = "Workout", 
  serial = "001",
  focus,
  difficulty = 3,
  workoutType,
  workoutDetails, 
  programWeeks, 
  imageUrl, 
  duration, 
  equipment,
  description,
  format,
  instructions,
  tips,
  activation,
  warm_up,
  main_workout,
  finisher,
  cool_down,
  programContent,
  overview,
  target_audience,
  program_structure,
  weekly_schedule,
  progression_plan,
  nutrition_tips,
  expected_results,
  workoutId,
  workoutCategory,
  programId,
  programType,
  isFreeContent = false,
  offlineLocked = false
}: WorkoutDisplayProps) => {
  const navigate = useNavigate();
  const { userTier } = useAccessControl();
  const isPremium = userTier === "premium";
  const [currentVideoId, setCurrentVideoId] = useState<string>(exercises[0]?.video_id || "");
  const [reader, setReader] = useState<{ open: boolean; title: string; content: string; meta?: { duration?: string; equipment?: string; category?: string } }>({
    open: false,
    title: "",
    content: "",
  });
  const [player, setPlayer] = useState<{ open: boolean; title: string; steps: WorkoutStep[] }>({
    open: false,
    title: "",
    steps: [],
  });

  const workoutContentHtml = joinWorkoutSections([activation, warm_up, main_workout, finisher, cool_down]);
  const trainingScheduleHtml = weekly_schedule ? normalizeWorkoutHtml(weekly_schedule) : '';
  const personalProgramHtml = programContent ? normalizeWorkoutHtml(programContent) : '';
  const instructionsHtml = instructions || program_structure ? normalizeWorkoutHtml(instructions || program_structure || '') : '';
  const tipsHtml = tips || nutrition_tips ? normalizeWorkoutHtml(tips || nutrition_tips || '') : '';

  const openReader = (sectionTitle: string, html: string) => {
    setReader({
      open: true,
      title: title ? `${title} — ${sectionTitle}` : sectionTitle,
      content: html,
      meta: {
        duration: duration || undefined,
        equipment: equipment || undefined,
        category: focus || undefined,
      },
    });
  };

  const openPlayer = (sectionTitle: string, html: string, preparedSteps?: WorkoutStep[]) => {
    const steps = preparedSteps || parseWorkoutSteps(html);
    if (!steps.length) return;
    setPlayer({
      open: true,
      title: title ? `${title} — ${sectionTitle}` : sectionTitle,
      steps,
    });
  };

  const workoutSteps = [
    ...parseWorkoutSectionSteps("Activation", activation),
    ...parseWorkoutSectionSteps("Warm-up", warm_up),
    ...parseWorkoutSectionSteps("Main Workout", main_workout),
    ...parseWorkoutSectionSteps("Finisher", finisher),
    ...parseWorkoutSectionSteps("Cool-down", cool_down),
  ];
  const trainingScheduleSteps = trainingScheduleHtml ? parseWorkoutSteps(trainingScheduleHtml) : [];
  const personalProgramSteps = personalProgramHtml ? parseWorkoutSteps(personalProgramHtml) : [];

  const getDifficultyText = (diff: number) => {
    if (diff <= 2) return 'Beginner';
    if (diff <= 4) return 'Intermediate';
    return 'Advanced';
  };

  if (offlineLocked) {
    return (
      <div className="space-y-6">
        <h1 className="text-4xl font-bold mb-4">{title}</h1>
        <Card className="border-2 border-primary/30">
          <CardHeader className="bg-primary/5">
            <CardTitle className="flex items-center gap-2 text-xl font-bold">
              <Info className="h-5 w-5" /> Content locked
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <p className="text-foreground/80 leading-relaxed">
              This content now requires Premium. Reconnect to the internet or upgrade to view it.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Workout Header */}
      <div className="space-y-6">
        {/* Title */}
        <h1 className="text-4xl font-bold mb-4">{title}</h1>
        
        {/* Description - Below Title */}
        {description && (
          <Card className="border-2 border-primary/30 mb-4">
            <CardHeader className="bg-primary/5">
              <CardTitle className="flex items-center gap-2 text-2xl font-bold">
                🔍 Description
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <HTMLContent 
                content={description} 
                className="prose-base text-foreground/90 leading-relaxed" 
              />
            </CardContent>
          </Card>
        )}
        
        {/* Credit Line */}
        <p className="text-sm text-muted-foreground mb-4">
          Created by <a href="/coach-profile" className="text-primary hover:underline font-medium">Haris Falas</a> — Sports Scientist & Strength and Conditioning Coach
        </p>


        {/* Info Bar: Serial, Focus, Difficulty with Stars, Type, Duration, Equipment - ABOVE IMAGE */}
        <div className="flex flex-wrap items-center gap-6 text-sm mb-6">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Serial:</span>
            <span className="font-mono">{serial}</span>
          </div>
          {focus && (
            <div className="flex items-center gap-2">
              <span className="font-semibold">Focus:</span>
              <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full font-medium">{focus}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="font-semibold">Difficulty:</span>
            <div className="flex items-center gap-2">
              <div className="flex">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Star 
                    key={i} 
                    className={`w-4 h-4 ${
                      difficulty > 0 && i <= difficulty 
                        ? 'fill-primary text-primary' 
                        : 'text-gray-300 dark:text-gray-600'
                    }`} 
                  />
                ))}
              </div>
              <span className="font-medium">{difficulty === 0 ? 'All Levels' : getDifficultyText(difficulty)}</span>
            </div>
          </div>
          {workoutType && (
            <div className="flex items-center gap-2">
              <span className="font-semibold">Type:</span>
              <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full font-medium uppercase text-xs tracking-wide">{workoutType}</span>
            </div>
          )}
          {duration && (
            <div className="flex items-center gap-2">
              <span className="font-semibold">Duration:</span>
              <span>{duration}</span>
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="How is duration calculated?"
                      className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
                    >
                      <Info className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[260px] text-xs leading-relaxed">
                    Duration covers the actual <strong>work time</strong> (Main Workout + Finisher).
                    Add roughly <strong>15–20 min</strong> for Warm-up + Cool Down.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
          {equipment && (
            <div className="flex items-center gap-2">
              <span className="font-semibold">Equipment:</span>
              <span>{equipment}</span>
            </div>
          )}
        </div>

        {/* Hero Banner Image */}
        <div className="relative w-full h-[300px] lg:h-[400px] rounded-2xl overflow-hidden shadow-2xl">
          <img
            src={imageUrl || workoutHero}
            alt={title}
            className="w-full h-full object-cover brightness-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        </div>
      </div>

      {/* Workout Tools - Timer, 1RM Calculator, Exercise Library */}
      <WorkoutToolsCards />

      {/* Start Your Workout - big clickable bar aligned with tools bar */}
      {(() => {
        const playerTarget =
          workoutSteps.length > 0
            ? { label: "Workout", html: workoutContentHtml, steps: workoutSteps }
            : trainingScheduleSteps.length > 0
            ? { label: "Training Program", html: trainingScheduleHtml, steps: trainingScheduleSteps }
            : personalProgramSteps.length > 0
            ? { label: "Training Program", html: personalProgramHtml, steps: personalProgramSteps }
            : null;
        if (!playerTarget) return null;
        return (
          <button
            type="button"
            onClick={() => openPlayer(playerTarget.label, playerTarget.html, playerTarget.steps)}
            aria-label="Start your workout with the Player"
            className="mt-3 w-full flex items-center justify-center gap-3 p-3 rounded-lg shadow-md border-2 border-primary/40 bg-primary text-primary-foreground hover:bg-primary/90 hover:border-primary transition-all font-semibold text-sm sm:text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Play className="h-5 w-5 fill-current" />
            <span>Start your workout</span>
          </button>
        );
      })()}


      {/* CONTENT SECTIONS - Display exactly as written, no automatic headers */}
      <div className="mt-8">
        
        {/* WORKOUT CONTENT - All workout fields displayed as single combined block */}
        {workoutContentHtml && (
          <Card className="border-2 border-primary/30">
            <CardHeader className="bg-primary/5">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-2xl font-bold">
                  💪 Workout
                </CardTitle>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 max-lg:h-9 max-lg:w-9 max-lg:p-0"
                    onClick={() => openReader("Workout", workoutContentHtml)}
                    aria-label="Reader Mode"
                  >
                    <BookOpen className="h-4 w-4" />
                    <span className="hidden lg:inline">Reader</span>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="content-container pt-6">
              <A4Container>
                <div className="workout-content">
                  <ExerciseHTMLContent 
                    content={workoutContentHtml} 
                    className="text-base" 
                    enableExerciseLinking={true} 
                  />
                </div>
              </A4Container>
            </CardContent>
          </Card>
        )}

        {/* TRAINING PROGRAM CONTENT - Display exactly as written */}
        {trainingScheduleHtml && (
          <Card className="border-2 border-primary/30">
            <CardHeader className="bg-primary/5">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-2xl font-bold">
                  📆 Training Program
                </CardTitle>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 max-lg:h-9 max-lg:w-9 max-lg:p-0"
                    onClick={() => openReader("Training Program", trainingScheduleHtml)}
                    aria-label="Reader Mode"
                  >
                    <BookOpen className="h-4 w-4" />
                    <span className="hidden lg:inline">Reader</span>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="content-container pt-6">
              <A4Container>
                <div className="workout-content">
                  <ExerciseHTMLContent content={trainingScheduleHtml} className="text-base" enableExerciseLinking={true} />
                </div>
              </A4Container>
            </CardContent>
          </Card>
        )}

        {/* PERSONAL TRAINING PROGRAM CONTENT - Display exactly as written */}
        {personalProgramHtml && (
          <Card className="border-2 border-primary/30">
            <CardHeader className="bg-primary/5">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-2xl font-bold">
                  📆 Training Program
                </CardTitle>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 max-lg:h-9 max-lg:w-9 max-lg:p-0"
                    onClick={() => openReader("Training Program", personalProgramHtml)}
                    aria-label="Reader Mode"
                  >
                    <BookOpen className="h-4 w-4" />
                    <span className="hidden lg:inline">Reader</span>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="content-container pt-6">
              <A4Container>
                <div className="workout-content">
                  <ExerciseHTMLContent content={personalProgramHtml} className="text-base" enableExerciseLinking={true} />
                </div>
              </A4Container>
            </CardContent>
          </Card>
        )}

        {/* INSTRUCTIONS - Display exactly as written */}
        {instructionsHtml && (
          <Card className="border-2 border-primary/30">
            <CardHeader className="bg-primary/5">
              <CardTitle className="flex items-center gap-2 text-2xl font-bold">
                📋 Instructions
              </CardTitle>
            </CardHeader>
            <CardContent className="content-container pt-6">
              <ExerciseLibraryBanner />
              <A4Container>
                <div className="workout-content">
                  <ExerciseHTMLContent
                    content={instructionsHtml}
                    className="text-base"
                    enableExerciseLinking={true}
                  />
                </div>
              </A4Container>
            </CardContent>
          </Card>
        )}

        {/* TIPS - Display exactly as written */}
        {tipsHtml && (
          <Card className="border-2 border-primary/30">
            <CardHeader className="bg-primary/5">
              <CardTitle className="flex items-center gap-2 text-2xl font-bold">
                💡 Tips
              </CardTitle>
            </CardHeader>
            <CardContent className="content-container pt-6">
              <A4Container>
                <div className="workout-content">
                  <ExerciseHTMLContent
                    content={tipsHtml}
                    className="text-base"
                    enableExerciseLinking={true}
                  />
                </div>
              </A4Container>
            </CardContent>
          </Card>
        )}

        {/* Workout Plan Card */}
        {workoutDetails && (
          <Card className="border-2 border-primary/30">
            <CardHeader className="bg-primary/5">
              <CardTitle className="flex items-center gap-2 text-2xl font-bold">
                💪 Workout Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {workoutDetails.exercises.map((exercise, index) => (
                <div key={index} className="border-l-4 border-primary pl-4 py-2">
                  <h4 className="font-bold text-lg mb-2">{exercise.name}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="font-semibold text-primary">Sets:</span> {exercise.sets}
                    </div>
                    <div>
                      <span className="font-semibold text-primary">Reps:</span> {exercise.reps}
                    </div>
                    <div>
                      <span className="font-semibold text-primary">Rest:</span> {exercise.rest}
                    </div>
                  </div>
                  {exercise.notes && (
                    <p className="text-sm text-muted-foreground mt-2 italic">
                      💡 {exercise.notes}
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Week-by-Week Training Program Plan */}
        {programWeeks && (
          <Card className="border-2 border-primary/30">
            <CardHeader className="bg-primary/5">
              <CardTitle className="flex items-center gap-2 text-2xl">
                📅 Week-by-Week Training Plan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {programWeeks.map((week, weekIndex) => (
                  <div key={weekIndex} className="border-2 border-primary/20 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-xl">Week {week.week}</h3>
                      <span className="text-sm font-semibold bg-primary text-primary-foreground px-3 py-1 rounded-full">
                        {week.focus}
                      </span>
                    </div>
                    <div className="space-y-4">
                      {week.days.map((day, dayIndex) => (
                        <div key={dayIndex} className="bg-muted/50 rounded-lg p-4">
                          <h4 className="font-bold text-lg mb-3 text-primary">{day.day}</h4>
                          <div className="space-y-3">
                            {day.exercises.map((exercise, exIndex) => (
                              <div key={exIndex} className="border-l-2 border-primary/50 pl-3">
                                <p className="font-semibold mb-1">{exercise.name}</p>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-muted-foreground">
                                  <span><strong>Sets:</strong> {exercise.sets}</span>
                                  <span><strong>Reps:</strong> {exercise.reps}</span>
                                  <span><strong>Intensity:</strong> {exercise.intensity}</span>
                                  <span><strong>Rest:</strong> {exercise.rest}</span>
                                </div>
                                {exercise.notes && (
                                  <p className="text-xs text-muted-foreground mt-1 italic">
                                    💡 {exercise.notes}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}


        {/* Workout/Program Interactions + Share */}
        <div className="flex flex-col gap-3">
          <div className="lg:flex-1 min-w-0">
            {workoutId && workoutCategory && (
              <WorkoutInteractions
                workoutId={workoutId}
                workoutType={workoutCategory}
                workoutName={title}
                isFreeContent={isFreeContent}
              />
            )}
            {programId && programType && (
              <ProgramInteractions
                programId={programId}
                programType={programType}
                programName={title}
                isFreeContent={isFreeContent}
              />
            )}
          </div>
          {(workoutId || programId) && (
            <div className="w-full lg:p-2 lg:bg-muted/60 lg:rounded-lg lg:border lg:border-border">
              <ShareButtons
                title={title}
                url={typeof window !== 'undefined' ? window.location.href : 'https://smartygym.com'}
                compact
              />
            </div>
          )}
        </div>

        {/* PAR-Q Reminder */}
        <ParQReminder />
      </div>
      
      {/* Bottom CTA Banner */}
      {!isPremium && (
        <div className="bg-card border border-border rounded-xl p-6 text-center shadow-soft mt-8">
          <h3 className="text-xl font-semibold mb-2">Want more like this?</h3>
          <p className="text-muted-foreground mb-4">
            Unlock 100+ workouts and all programs with SmartyGym Premium.
          </p>
          <Button size="lg" onClick={() => navigate("/smarty-premium")}>
            Join Premium
          </Button>
        </div>
      )}

      <ReaderModeDialog
        open={reader.open}
        onOpenChange={(o) => setReader((r) => ({ ...r, open: o }))}
        title={reader.title}
        metadata={reader.meta}
        content={
          <ExerciseHTMLContent
            content={reader.content}
            enableExerciseLinking={true}
          />
        }
      />

      <WorkoutPlayerDialog
        open={player.open}
        onOpenChange={(o) => setPlayer((p) => ({ ...p, open: o }))}
        title={player.title}
        steps={player.steps}
      />
    </div>
  );
};