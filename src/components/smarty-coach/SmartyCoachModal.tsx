import { useState, useEffect, useMemo } from "react";
import { ChevronRight, ChevronLeft, Clock, Dumbbell, Zap, Brain, BookOpen, Target, Activity, Wrench, Flame, Sparkles, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSmartyContext } from "@/hooks/useSmartyContext";
import { generateSuggestions, ContentItem, QuestionAnswers } from "@/utils/smarty-coach/suggestionEngine";
import { generateSmartNote } from "@/utils/smarty-coach/smartNoteGenerator";
import { SmartNoteDisplay } from "./SmartNote";
import { ProgramSuggestionFlow } from "./ProgramSuggestionFlow";
import { KnowledgeSuggestionFlow } from "./KnowledgeSuggestionFlow";
import { useNavigate, Link } from "react-router-dom";
import { useAccessControl } from "@/contexts/AccessControlContext";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getWorkoutUrl } from "@/utils/smarty-coach/routes";
import { DialogDescription } from "@/components/ui/dialog";
import smartyCoachIcon from "@/assets/smarty-gym-icon-noborder.png";
import { fetchVisibleWorkoutMetadata } from "@/hooks/useTodayWods";
import { useOverlayZIndex } from "@/lib/overlayActivity";

type MenuAccent = 'primary' | 'amber' | 'emerald' | 'violet' | 'rose' | 'sky';
const menuAccentClasses: Record<MenuAccent, string> = {
  primary: 'bg-primary/10 text-primary',
  amber: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  emerald: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  violet: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  rose: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
  sky: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
};

interface MenuCardProps {
  emoji: string;
  title: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
  accent: MenuAccent;
  onClick: () => void;
}

const MenuCard = ({ emoji, title, description, Icon, accent, onClick }: MenuCardProps) => (
  <button
    onClick={onClick}
    className={cn(
      "group relative w-full text-left rounded-xl border-2 border-border bg-card p-2.5 md:p-4",
      "transition-all duration-200 hover:border-primary hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/10",
      "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
    )}
  >
    <div className="flex items-center gap-2.5 md:gap-3">
      <div className={cn("w-9 h-9 min-w-[2.25rem] md:w-11 md:h-11 md:min-w-[2.75rem] rounded-lg flex items-center justify-center", menuAccentClasses[accent])}>
        <Icon className="h-4 w-4 md:h-5 md:w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground text-sm md:text-base leading-tight whitespace-normal break-words">
          <span className="mr-1">{emoji}</span>{title}
        </p>
        <p className="text-[11px] md:text-xs text-muted-foreground mt-0.5 leading-snug whitespace-normal break-words line-clamp-2">{description}</p>
      </div>
      <ChevronRight className="h-4 w-4 md:h-5 md:w-5 shrink-0 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-transform" />
    </div>
  </button>
);

interface SmartyCoachModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPath?: 'menu' | 'workout' | 'program' | 'knowledge';
}

const moodEmojis = [
  { value: 1, emoji: "😰", label: "Very stressed" },
  { value: 2, emoji: "😔", label: "Low" },
  { value: 3, emoji: "😐", label: "Neutral" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 5, emoji: "😁", label: "Very positive" },
];

const energyLabels: Record<number, string> = {
  0: "Exhausted", 1: "Exhausted", 2: "Very tired", 3: "Very tired",
  4: "Tired", 5: "OK", 6: "OK", 7: "Good", 8: "Good", 9: "On fire", 10: "On fire",
};

const goalOptions = [
  { label: "Get stronger", value: "strength" },
  { label: "Burn calories", value: "calorie_burning" },
  { label: "Improve metabolic", value: "metabolic" },
  { label: "Improve endurance", value: "endurance" },
  { label: "Move better", value: "move_better" },
  { label: "Challenge me", value: "challenge" },
  { label: "Regenerate", value: "regenerate" },
];

const durationOptions = [
  { label: "15 min", value: 15 },
  { label: "20 min", value: 20 },
  { label: "30 min", value: 30 },
  { label: "45 min", value: 45 },
];

const equipmentOptions = [
  { label: "No equipment", value: "bodyweight" },
  { label: "Equipment available", value: "equipment" },
];

// Map legacy stored primary_goal values to the new category-aligned options.
const LEGACY_GOAL_MAP: Record<string, string> = {
  fat_loss: 'calorie_burning',
  muscle_gain: 'strength',
  flexibility: 'move_better',
  general_fitness: 'strength',
  recovery: 'regenerate',
};
const normalizeGoal = (g: string | null | undefined): string | null =>
  g ? (LEGACY_GOAL_MAP[g] ?? g) : null;

type MainPath = 'menu' | 'workout' | 'program' | 'knowledge';
type WorkoutStep = 1 | 2 | 3 | 4 | 5 | 'result';

export const SmartyCoachModal = ({ isOpen, onClose, initialPath = 'menu' }: SmartyCoachModalProps) => {
  const zIndex = useOverlayZIndex(isOpen);

  const navigate = useNavigate();
  const { user } = useAccessControl();
  const context = useSmartyContext();
  
  const [activePath, setActivePath] = useState<MainPath>(initialPath);
  const [currentStep, setCurrentStep] = useState<WorkoutStep>(1);
  const [answers, setAnswers] = useState<QuestionAnswers>({});
  const [energyValue, setEnergyValue] = useState(5);

  const { data: allContent = [], isLoading: contentLoading } = useQuery({
    queryKey: ['smarty-coach-workouts'],
    queryFn: async () => {
      const data = await fetchVisibleWorkoutMetadata(null);
      return data.map(w => ({
        ...w,
        category: w.category || w.type || 'General',
      })) as ContentItem[];
    },
    enabled: isOpen && activePath === 'workout',
  });

  const { data: measurementGoals } = useQuery({
    queryKey: ['smarty-coach-measurement-goals', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('user_measurement_goals')
        .select('target_weight, target_body_fat, target_muscle_mass')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: isOpen && !!user?.id,
  });

  const hasFitnessGoals = !!context.userGoal?.primary_goal;
  const hasMeasurementGoals = !!(
    measurementGoals?.target_weight ||
    measurementGoals?.target_body_fat ||
    measurementGoals?.target_muscle_mass
  );
  const hasAnyGoals = hasFitnessGoals || hasMeasurementGoals;

  const defaultGoal = useMemo(() => {
    if (context.userGoal?.primary_goal) return normalizeGoal(context.userGoal.primary_goal);
    if (measurementGoals) {
      if (measurementGoals.target_weight || measurementGoals.target_body_fat) return 'calorie_burning';
      if (measurementGoals.target_muscle_mass) return 'strength';
    }
    return null;
  }, [context.userGoal?.primary_goal, measurementGoals]);

  const goalSource = useMemo(() => {
    if (context.userGoal?.primary_goal) return 'fitnessGoals';
    if (measurementGoals?.target_weight || measurementGoals?.target_body_fat || measurementGoals?.target_muscle_mass) return 'measurementGoals';
    return 'manual';
  }, [context.userGoal?.primary_goal, measurementGoals]);

  const logInteraction = useMutation({
    mutationFn: async (data: { suggested_content_id: string; action_taken: 'accepted' | 'dismissed' }) => {
      if (!user?.id) return;
      await supabase.from('smartly_suggest_interactions').insert([{
        user_id: user.id,
        suggested_content_type: 'workout',
        suggested_content_id: data.suggested_content_id,
        confidence_level: 'direct',
        questions_asked: ['mood', 'energy', 'goal', 'duration', 'equipment'] as unknown as any,
        user_responses: answers as unknown as any,
        action_taken: data.action_taken,
      }]);
    },
  });

  useEffect(() => {
    if (isOpen) {
      setActivePath(initialPath);
      setCurrentStep(1);
      setAnswers({});
      setEnergyValue(5);
    }
  }, [isOpen, initialPath]);

  const goBack = () => {
    if (currentStep === 1) setActivePath('menu');
    else if (currentStep === 2) setCurrentStep(1);
    else if (currentStep === 3) setCurrentStep(2);
    else if (currentStep === 4) setCurrentStep(3);
    else if (currentStep === 5) setCurrentStep(4);
    else if (currentStep === 'result') setCurrentStep(5);
  };

  const handleMoodSelect = (value: number) => { setAnswers(prev => ({ ...prev, mood: value })); setCurrentStep(2); };
  const handleEnergyConfirm = () => { setAnswers(prev => ({ ...prev, energy: energyValue })); setCurrentStep(3); };
  const handleGoalSelect = (value: string) => { setAnswers(prev => ({ ...prev, goal: value, goalSource })); setCurrentStep(4); };
  const handleDurationSelect = (value: number) => { setAnswers(prev => ({ ...prev, time: value })); setCurrentStep(5); };
  const handleEquipmentSelect = (value: string) => { setAnswers(prev => ({ ...prev, equipment: value })); setCurrentStep('result'); };

  const handleSelectSuggestion = (item: ContentItem) => {
    logInteraction.mutate({ suggested_content_id: item.id, action_taken: 'accepted' });
    onClose();
    navigate(getWorkoutUrl(item));
  };

  const handleDismiss = () => {
    if (suggestion) {
      logInteraction.mutate({ suggested_content_id: suggestion.item.id, action_taken: 'dismissed' });
    }
    onClose();
  };

  const suggestion = currentStep === 'result' && activePath === 'workout' && allContent.length > 0
    ? generateSuggestions(allContent, context, answers)
    : null;

  const smartNote = suggestion ? generateSmartNote(context, suggestion.item) : null;

  const isLoading = context.isLoading || (activePath === 'workout' && contentLoading);

  const getDifficultyColor = (difficulty: string | null) => {
    switch (difficulty?.toLowerCase()) {
      case 'beginner': return 'bg-green-500/10 text-green-600 dark:text-green-400';
      case 'intermediate': return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400';
      case 'advanced': return 'bg-red-500/10 text-red-600 dark:text-red-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const totalSteps = 5;
  const currentStepNum = currentStep === 'result' ? 5 : currentStep;

  const defaultGoalLabel = defaultGoal
    ? goalOptions.find(g => g.value === defaultGoal)?.label || defaultGoal
    : null;

  const goalSourceLabel = goalSource === 'fitnessGoals' 
    ? 'Based on your fitness goals' 
    : goalSource === 'measurementGoals' 
      ? 'Based on your active goals (weight/body composition)' 
      : null;

  const handleMenuSelect = (path: MainPath) => {
    if (path === 'menu') return;
    if (path === 'workout' || path === 'program' || path === 'knowledge') {
      setActivePath(path);
    }
  };

  const handleNavigateTo = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleDismiss()} modal={false}>
      <DialogContent
        style={{ zIndex }}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className={cn(
          "p-0 border-0 overflow-hidden",
          // Use small/dynamic viewport units for consistent mobile-browser chrome behavior.
          "w-[calc(100svw-2rem)] max-w-[22rem] sm:max-w-md md:max-w-3xl lg:max-w-4xl mx-auto",
          "max-h-[calc(100svh-2rem)] supports-[height:100dvh]:max-h-[calc(100dvh-2rem)] sm:max-h-[85vh] overflow-y-auto overscroll-contain",
          // Re-center vertically using small/dynamic viewport units so the modal
          // is truly centered in the visible area on mobile (where vh != svh).
          "!top-[50svh] supports-[height:100dvh]:!top-[50dvh]",
          "rounded-2xl bg-card border-2 border-primary/30 shadow-2xl shadow-primary/20",
          activePath === 'menu' ? "[&>button]:hidden" : ""
        )}
      >
        {activePath === 'menu' ? (
          <>
            {/* Rich header band */}
            <div className="relative px-3 sm:px-5 pt-4 pb-3 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent">
              <button
                onClick={handleDismiss}
                aria-label="Close"
                className="absolute top-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/90 text-foreground shadow-sm transition-colors hover:bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex flex-col items-center text-center gap-2">
                <img
                  src={smartyCoachIcon}
                  alt="Smarty Coach"
                  width={70}
                  height={70}
                  decoding="async"
                  className="h-[70px] w-[70px] rounded-full object-contain"
                />
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg md:text-2xl font-bold text-foreground leading-tight break-words">
                    Hi <span className="inline-block">👋</span> I'm your Smarty Coach
                  </h2>
                  <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                    How can I help you today?
                  </p>
                </div>
              </div>
            </div>

            {/* Menu options */}
            <div className="px-3 sm:px-4 md:px-6 pb-4 pt-2 md:pt-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3 animate-in fade-in duration-300">
                <MenuCard
                  emoji="🔥"
                  title="Workout of the Day"
                  description="Check today's bodyweight & equipment WOD"
                  Icon={Flame}
                  accent="amber"
                  onClick={() => handleNavigateTo('/workout/wod')}
                />
                <MenuCard
                  emoji="💪"
                  title="Start a Workout"
                  description="Find the perfect workout for right now"
                  Icon={Activity}
                  accent="primary"
                  onClick={() => handleMenuSelect('workout')}
                />
                <MenuCard
                  emoji="🎯"
                  title="Start a Program"
                  description="Get a structured multi-week training plan"
                  Icon={Target}
                  accent="emerald"
                  onClick={() => handleMenuSelect('program')}
                />
                <MenuCard
                  emoji="🛠️"
                  title="Use a Tool"
                  description="Track weight, body composition, calories & more"
                  Icon={Wrench}
                  accent="sky"
                  onClick={() => handleNavigateTo('/tools')}
                />
                <MenuCard
                  emoji="📚"
                  title="Upgrade My Knowledge"
                  description="Discover articles on fitness, nutrition & wellness"
                  Icon={BookOpen}
                  accent="violet"
                  onClick={() => handleMenuSelect('knowledge')}
                />
                <MenuCard
                  emoji="✨"
                  title="Learn More About Smarty Gym"
                  description="Discover the method, the coach, the philosophy"
                  Icon={Sparkles}
                  accent="rose"
                  onClick={() => handleNavigateTo('/about')}
                />
              </div>
            </div>
          </>
        ) : (
        <div className="px-4 py-4">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            <img
              src={smartyCoachIcon}
              alt=""
              aria-hidden="true"
              width={49}
              height={49}
              decoding="async"
              className="h-12 w-12 rounded-full object-contain"
            />
            Smarty Coach
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {activePath === 'workout' ? "Let's find the perfect workout" :
             activePath === 'program' ? "Let's find the right program" :
             "Let's find something to read"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">

          {/* === PROGRAM FLOW === */}
          {activePath === 'program' && (
            <ProgramSuggestionFlow onBack={() => setActivePath('menu')} onClose={onClose} />
          )}

          {/* === KNOWLEDGE FLOW === */}
          {activePath === 'knowledge' && (
            <KnowledgeSuggestionFlow onBack={() => setActivePath('menu')} onClose={onClose} />
          )}

          {/* === WORKOUT FLOW === */}
          {activePath === 'workout' && (
            <>
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-20 w-full rounded-xl" />
                  <Skeleton className="h-32 w-full rounded-xl" />
                </div>
              ) : currentStep !== 'result' ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-5 duration-300">
                  <div className="flex items-center gap-2">
                    {Array.from({ length: totalSteps }).map((_, i) => (
                      <div key={i} className={cn("h-1 flex-1 rounded-full transition-colors", i < currentStepNum ? "bg-primary" : "bg-muted")} />
                    ))}
                  </div>

                  {currentStep === 1 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium text-foreground">How is your mood?</h3>
                      <div className="grid grid-cols-5 gap-1 sm:flex sm:justify-between sm:gap-2">
                        {moodEmojis.map((mood) => (
                          <button key={mood.value} onClick={() => handleMoodSelect(mood.value)}
                            className={cn("flex flex-col items-center gap-0.5 p-2 sm:p-3 rounded-xl transition-all",
                              "border-2 border-border hover:border-primary hover:bg-primary/5",
                              "focus:outline-none focus:ring-2 focus:ring-primary")}>
                            <span className="text-xl sm:text-2xl">{mood.emoji}</span>
                            <span className="text-[10px] sm:text-xs text-muted-foreground text-center leading-tight">{mood.label}</span>
                          </button>
                        ))}
                      </div>
                      <Button variant="outline" onClick={goBack} className="flex items-center gap-1">
                        <ChevronLeft className="h-4 w-4" />Back
                      </Button>
                    </div>
                  )}

                  {currentStep === 2 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium text-foreground">How's your energy?</h3>
                      <div className="space-y-4">
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>0</span>
                          <span className="font-medium text-foreground">{energyValue} - {energyLabels[energyValue]}</span>
                          <span>10</span>
                        </div>
                        <Slider value={[energyValue]} onValueChange={(val) => setEnergyValue(val[0])} min={0} max={10} step={1} className="w-full" />
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={goBack} className="flex items-center gap-1"><ChevronLeft className="h-4 w-4" />Back</Button>
                          <Button onClick={handleEnergyConfirm} className="flex-1">Continue</Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {currentStep === 3 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium text-foreground">What's your focus?</h3>
                      {defaultGoal && (
                        <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                          <p className="text-sm text-muted-foreground mb-2">{goalSourceLabel}:</p>
                          <Button variant="default" className="w-full" onClick={() => handleGoalSelect(defaultGoal)}>{defaultGoalLabel}</Button>
                        </div>
                      )}
                      <div className="space-y-2">
                        {defaultGoal ? (
                          <p className="text-sm text-muted-foreground">Or choose different focus:</p>
                        ) : (
                          <p className="text-sm text-muted-foreground">Choose your focus:</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {goalOptions.filter(g => !defaultGoal || g.value !== defaultGoal).map((goal) => (
                            <Button key={goal.value} variant="outline" onClick={() => handleGoalSelect(goal.value)} className="h-auto py-2 px-3 text-sm">{goal.label}</Button>
                          ))}
                        </div>
                      </div>
                      {!hasAnyGoals && (
                        <Link to="/userdashboard?scroll=active-goals" className="inline-flex items-center gap-1 text-sm text-primary hover:underline" onClick={onClose}>Set your goals now</Link>
                      )}
                      <Button variant="outline" onClick={goBack} className="flex items-center gap-1"><ChevronLeft className="h-4 w-4" />Back</Button>
                    </div>
                  )}

                  {currentStep === 4 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium text-foreground">How much time do you have?</h3>
                      <div className="flex flex-wrap gap-2">
                        {durationOptions.map((dur) => (
                          <Button key={dur.value} variant="outline" onClick={() => handleDurationSelect(dur.value)}
                            className={cn("h-auto py-2 px-3 sm:py-3 sm:px-4 text-sm font-medium whitespace-normal text-left", "border-2 border-border hover:border-primary hover:bg-primary hover:text-primary-foreground")}>{dur.label}</Button>
                        ))}
                      </div>
                      <Button variant="outline" onClick={goBack} className="flex items-center gap-1"><ChevronLeft className="h-4 w-4" />Back</Button>
                    </div>
                  )}

                  {currentStep === 5 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium text-foreground">What equipment do you have?</h3>
                      <div className="flex flex-wrap gap-2">
                        {equipmentOptions.map((eq) => (
                          <Button key={eq.value} variant="outline" onClick={() => handleEquipmentSelect(eq.value)}
                            className={cn("h-auto py-2 px-3 sm:py-3 sm:px-4 text-sm font-medium flex-1 whitespace-normal text-left", "border-2 border-border hover:border-primary hover:bg-primary hover:text-primary-foreground")}>{eq.label}</Button>
                        ))}
                      </div>
                      <Button variant="outline" onClick={goBack} className="flex items-center gap-1"><ChevronLeft className="h-4 w-4" />Back</Button>
                    </div>
                  )}
                </div>
              ) : suggestion ? (
                <>
                  <div className={cn("overflow-hidden rounded-xl cursor-pointer", "border-2 border-primary/20 hover:border-primary/40", "transition-all duration-200 hover:shadow-lg")}
                    onClick={() => handleSelectSuggestion(suggestion.item)}>
                    {suggestion.item.image_url && (
                      <div className="relative h-32 overflow-hidden">
                        <img src={suggestion.item.image_url} alt={suggestion.item.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                      </div>
                    )}
                    <div className="p-4 space-y-2">
                      <h4 className="font-semibold text-foreground line-clamp-2">{suggestion.item.name}</h4>
                      <div className="flex flex-wrap items-center gap-2">
                        {suggestion.item.category && <Badge variant="secondary" className="text-xs">{suggestion.item.category}</Badge>}
                        {suggestion.item.difficulty && <Badge variant="outline" className={cn("text-xs", getDifficultyColor(suggestion.item.difficulty))}>{suggestion.item.difficulty}</Badge>}
                        {suggestion.item.duration && <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{suggestion.item.duration}</div>}
                        {suggestion.item.equipment && <div className="flex items-center gap-1 text-xs text-muted-foreground"><Dumbbell className="h-3 w-3" />{suggestion.item.equipment}</div>}
                      </div>
                    </div>
                  </div>

                  {suggestion.reasons.length > 0 && (
                    <div className="space-y-2 p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-primary" />
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Why we recommend this</span>
                      </div>
                      <ul className="space-y-1.5">
                        {suggestion.reasons.slice(0, 6).map((reason, index) => (
                          <li key={index} className="text-sm text-foreground flex items-start gap-2">
                            <span className="text-primary mt-1">•</span><span>{reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {smartNote && <SmartNoteDisplay note={smartNote} />}

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={goBack} className="flex items-center gap-1"><ChevronLeft className="h-4 w-4" />Back</Button>
                    <Button className="flex-1" onClick={() => handleSelectSuggestion(suggestion.item)}>Start Workout<ChevronRight className="h-4 w-4 ml-1" /></Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <p>We're refreshing the workout library right now — try the Workout of the Day or explore our programs in the meantime.</p>
                  <Button variant="outline" onClick={goBack} className="mt-4 flex items-center gap-1 mx-auto"><ChevronLeft className="h-4 w-4" />Back</Button>
                </div>
              )}
            </>
          )}
        </div>
        </div>
        )}
        {/* Always-available footer */}
        <div className="px-5 sm:px-7 py-3 bg-muted/40 border-t border-border text-center">
          <p className="text-xs sm:text-sm text-muted-foreground inline-flex items-center justify-center gap-1.5 flex-wrap">
            <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
            I'm always here for you — tap the <span className="font-semibold text-foreground">Smarty Coach</span> button anytime to get help.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};