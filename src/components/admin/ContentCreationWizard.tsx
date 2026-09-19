import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Check, Dumbbell, Calendar, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  WORKOUT_CATEGORIES,
  STRENGTH_FOCUS_OPTIONS,
} from "@/constants/workoutCategories";
import { ADMIN_EQUIPMENT_CHOICES } from "@/lib/coach-options";

/**
 * Guided wizard for creating a new Workout or Training Program.
 * Collects ALL the same metadata our public filters expose, in the
 * same order, then hands off to the existing edit dialog (which still
 * owns the rich-text body, library-first exercise rules, normalizer
 * pipeline, and DB triggers — all coaching rules stay intact).
 */

export type WizardContentType = "workout" | "program";

export interface WizardWorkoutResult {
  type: "workout";
  payload: Record<string, any>;
  /** True when the workout has already been generated + saved to DB by the wizard. */
  generated?: boolean;
  /** When generated=true, the new workout id so the list can reload to it. */
  id?: string;
}

export interface WizardProgramResult {
  type: "program";
  payload: Record<string, any>;
}

export type WizardResult = WizardWorkoutResult | WizardProgramResult;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialType?: WizardContentType;
  /** If true, user can flip between workout/program in step 1. */
  allowTypeSwitch?: boolean;
  onComplete: (result: WizardResult) => void;
}

const PROGRAM_CATEGORIES = [
  "CARDIO ENDURANCE",
  "FUNCTIONAL STRENGTH",
  "MUSCLE HYPERTROPHY",
  "WEIGHT LOSS",
  "LOW BACK PAIN",
  "MOBILITY & STABILITY",
] as const;

const FORMATS_FREE = ["TABATA", "CIRCUIT", "AMRAP", "FOR TIME", "EMOM", "REPS & SETS", "MIX"] as const;
const FIXED_FORMAT: Record<string, string> = {
  STRENGTH: "REPS & SETS",
  "MOBILITY & STABILITY": "REPS & SETS",
  PILATES: "REPS & SETS",
  RECOVERY: "MIX",
};

const WORKOUT_DURATIONS = ["15 min", "20 min", "25 min", "30 min", "35 min", "40 min", "45 min", "50 min", "Various"];
const MICRO_DURATION = "5 min";

const DIFFICULTY_OPTIONS = [
  { stars: 0, label: "All Levels" },
  { stars: 1, label: "Beginner ★" },
  { stars: 2, label: "Beginner ★★" },
  { stars: 3, label: "Intermediate ★★★" },
  { stars: 4, label: "Intermediate ★★★★" },
  { stars: 5, label: "Advanced ★★★★★" },
  { stars: 6, label: "Advanced ★★★★★★" },
];

const EQUIPMENT_OPTIONS = ["BODYWEIGHT", "EQUIPMENT"];
const PROGRAM_EQUIPMENT_OPTIONS = ["Bodyweight", "Equipment"];

/**
 * Categories whose equipment is part of their coaching rules and must never be
 * chosen in the wizard — the step is skipped entirely so nothing can conflict.
 */
const LOCKED_EQUIPMENT: Record<string, { workoutValue: string; note: string }> = {
  "MICRO-WORKOUTS": {
    workoutValue: "BODYWEIGHT",
    note: "Micro-workouts are locked to bodyweight only (office / home / chair / desk).",
  },
  PILATES: {
    workoutValue: "BODYWEIGHT",
    note: "Pilates is locked to mat / bodyweight work.",
  },
  RECOVERY: {
    workoutValue: "BODYWEIGHT",
    note: "Recovery is locked to bodyweight and light props (mat, band, ball, roller).",
  },
};
const WEEKS_OPTIONS = [4, 6, 8];
const DAYS_PER_WEEK_OPTIONS = [3, 4, 5, 6];

type AccessChoice = "free" | "premium" | "standalone";

/** Where an in-flight generation job id is parked so a refresh can resume it. */
const JOB_KEY = "admin_generation_job";

const rememberJob = (jobId: string, type: WizardContentType) => {
  try {
    localStorage.setItem(JOB_KEY, JSON.stringify({ jobId, type }));
  } catch { /* storage unavailable — polling still works in this tab */ }
};

const forgetJob = () => {
  try {
    localStorage.removeItem(JOB_KEY);
  } catch { /* ignore */ }
};

const readRememberedJob = (): { jobId: string; type: WizardContentType } | null => {
  try {
    const raw = localStorage.getItem(JOB_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.jobId ? parsed : null;
  } catch {
    return null;
  }
};

/**
 * Waits for a backend generation job to finish. The job runs in the database
 * and edge function independently of this browser, so there is no deadline
 * here — a finished workout is never thrown away because the page stopped
 * waiting. The job id is stored, so a refresh or a reopened wizard picks the
 * same generation back up.
 */
const awaitJobDraft = async (
  jobId: string,
  type: WizardContentType,
): Promise<Record<string, any>> => {
  rememberJob(jobId, type);
  // The job row itself is the failure signal; a row that never resolves is
  // still visible and resumable rather than silently discarded.
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    const { data: current, error: pollError } = await supabase
      .from("admin_generation_jobs")
      .select("status,draft_payload,error_message,created_at")
      .eq("id", jobId)
      .maybeSingle();
    if (pollError) throw pollError;
    if (!current) {
      forgetJob();
      throw new Error("That generation is no longer available. Please start it again.");
    }
    if (current.status === "failed") {
      forgetJob();
      await supabase.from("admin_generation_jobs").delete().eq("id", jobId);
      throw new Error(current.error_message || "Generation failed");
    }
    if (current.status === "completed") {
      const draft = current.draft_payload as Record<string, any> | null;
      forgetJob();
      await supabase.from("admin_generation_jobs").delete().eq("id", jobId);
      if (!draft) throw new Error(`The ${type} finished without a draft. Please start it again.`);
      return draft;
    }
    // Stall guard, not a waiting limit: the server process itself is gone.
    if (Date.now() - new Date(current.created_at as string).getTime() > 20 * 60 * 1000) {
      forgetJob();
      await supabase.from("admin_generation_jobs").delete().eq("id", jobId);
      throw new Error("The server stopped working on this generation. Please start it again.");
    }
  }
};

export const ContentCreationWizard = ({
  open,
  onOpenChange,
  initialType = "workout",
  allowTypeSwitch = true,
  onComplete,
}: Props) => {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [type, setType] = useState<WizardContentType>(initialType);
  const [category, setCategory] = useState<string>("");
  const [difficultyStars, setDifficultyStars] = useState<number>(3);
  const [equipment, setEquipment] = useState<string>("");
  const [equipmentIds, setEquipmentIds] = useState<string[]>([]);
  const [duration, setDuration] = useState<string>("");
  const [format, setFormat] = useState<string>("");
  const [focus, setFocus] = useState<string>("");
  const [weeks, setWeeks] = useState<number>(4);
  const [daysPerWeek, setDaysPerWeek] = useState<number>(4);
  const [access, setAccess] = useState<AccessChoice>("free");
  const [price, setPrice] = useState<string>("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(0);
      setType(initialType);
      setCategory("");
      setDifficultyStars(3);
      setEquipment("");
      setEquipmentIds([]);
      setDuration("");
      setFormat("");
      setFocus("");
      setWeeks(4);
      setDaysPerWeek(4);
      setAccess("free");
      setPrice("");
      setGenerating(false);
    }
  }, [open, initialType]);

  // A generation started earlier keeps running on the server. If the page was
  // refreshed or the wizard closed, pick it back up instead of losing it.
  useEffect(() => {
    if (!open) return;
    const pending = readRememberedJob();
    if (!pending) return;
    let cancelled = false;
    setGenerating(true);
    toast({
      title: "Picking up your generation",
      description: "It kept running in the background — this will open as soon as it is ready.",
    });
    awaitJobDraft(pending.jobId, pending.type)
      .then((draft) => {
        if (!cancelled) deliverDraft(draft, pending.type);
      })
      .catch((e: any) => {
        if (cancelled) return;
        toast({
          title: "Generation failed",
          description: e?.message || "Please start it again.",
          variant: "destructive",
        });
      })
      .finally(() => {
        if (!cancelled) setGenerating(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const lockedEquipment = type === "workout" ? LOCKED_EQUIPMENT[category] : undefined;

  // Categories whose equipment (and, for micro-workouts, duration/difficulty)
  // is fixed by the coaching rules — nothing to choose, nothing to conflict.
  useEffect(() => {
    if (type !== "workout") return;
    const locked = LOCKED_EQUIPMENT[category];
    if (!locked) return;
    setEquipment(locked.workoutValue);
    setEquipmentIds([]);
    if (category === "MICRO-WORKOUTS") {
      setDuration(MICRO_DURATION);
      setDifficultyStars(0);
    }
  }, [type, category]);

  // Auto-set fixed formats
  useEffect(() => {
    if (type === "workout" && category && FIXED_FORMAT[category]) {
      setFormat(FIXED_FORMAT[category]);
    }
  }, [type, category]);

  const isStrength = type === "workout" && category === "STRENGTH";
  const isMicro = type === "workout" && category === "MICRO-WORKOUTS";
  const hasFixedFormat = type === "workout" && !!FIXED_FORMAT[category];

  // Build dynamic step list
  const steps = useMemo(() => {
    const list: { key: string; title: string }[] = [
      { key: "type", title: "Content Type" },
      { key: "category", title: "Category" },
      { key: "difficulty", title: "Difficulty" },
    ];
    if (type === "workout") {
      if (!isMicro) list.push({ key: "duration", title: "Duration" });
      if (!lockedEquipment) list.push({ key: "equipment", title: "Equipment" });
      if (!hasFixedFormat) list.push({ key: "format", title: "Format" });
      if (isStrength) list.push({ key: "focus", title: "Strength Focus" });
    } else {
      list.push({ key: "equipment", title: "Equipment" });
      list.push({ key: "weeks", title: "Weeks & Days/Week" });
    }
    list.push({ key: "access", title: "Access & Price" });
    list.push({ key: "review", title: "Review" });
    return list;
  }, [type, hasFixedFormat, isStrength, isMicro, lockedEquipment]);

  const currentKey = steps[step]?.key;
  const totalSteps = steps.length;

  const canContinue = (): boolean => {
    switch (currentKey) {
      case "type":
        return !!type;
      case "category":
        return !!category;
      case "difficulty":
        return difficultyStars >= 0;
      case "equipment":
        if (!equipment) return false;
        return equipment.toLowerCase().includes("bodyweight") || equipmentIds.length > 0;
      case "duration":
        return !!duration;
      case "format":
        return !!format;
      case "focus":
        return !!focus;
      case "weeks":
        return !!weeks && !!daysPerWeek;
      case "access":
        if (access === "standalone") return !!price && Number(price) > 0;
        return true;
      case "review":
        return true;
      default:
        return false;
    }
  };

  const goNext = () => {
    if (step < totalSteps - 1) setStep(step + 1);
  };
  const goBack = () => {
    if (step > 0) setStep(step - 1);
  };

  /** Human-readable list of the ticked apparatus, e.g. "Dumbbells, Kettlebells". */
  const equipmentLabels = () =>
    ADMIN_EQUIPMENT_CHOICES.filter((e) => equipmentIds.includes(e.id))
      .map((e) => e.label)
      .join(", ");

  /** What the program's own `equipment` field stores (programs use labels). */
  const programEquipmentValue = () =>
    equipment.toLowerCase().includes("bodyweight") ? "Bodyweight" : equipmentLabels() || "Equipment";

  const handleFinish = () => {
    const isFree = access === "free";
    const isPremium = access === "premium";
    const isStandalone = access === "standalone";

    if (type === "workout") {
      onComplete({
        type: "workout",
        payload: {
          id: "",
          serial_number: 0,
          name: "",
          category,
          difficulty_stars: difficultyStars,
          equipment,
          format,
          duration,
          focus: isStrength ? focus : "",
          activation: "",
          warm_up: "",
          main_workout: "",
          finisher: "",
          cool_down: "",
          description: "",
          instructions: "",
          tips: "",
          image_url: "",
          generate_unique_image: false,
          is_free: isFree,
          is_premium: isPremium,
          is_standalone_purchase: isStandalone,
          price: isStandalone ? price : "",
          stripe_product_id: "",
          stripe_price_id: "",
          tier_required: isPremium ? "premium" : "",
        },
      });
    } else {
      onComplete({
        type: "program",
        payload: {
          id: "",
          serial_number: 0,
          name: "",
          category,
          difficulty_stars: difficultyStars,
          weeks,
          days_per_week: daysPerWeek,
          equipment: programEquipmentValue(),
          training_program: "",
          program_description: "",
          construction: "",
          final_tips: "",
          image_url: "",
          generate_unique_image: false,
          is_free: isFree,
          is_premium: isPremium,
          is_standalone_purchase: isStandalone,
          price: isStandalone ? price : "",
          stripe_product_id: "",
          stripe_price_id: "",
        },
      });
    }
    onOpenChange(false);
  };

  /**
   * Generate the full workout via AI (library-first) and save it to the
   * database. On success the wizard closes and tells the manager to
   * refresh — no manual editing required.
   */
  /** Hands a finished draft to the editor — shared by a fresh run and a resumed one. */
  const deliverDraft = (draft: Record<string, any>, draftType: WizardContentType) => {
    if (draftType === "workout") {
      toast({
        title: "Workout drafted",
        description: `"${draft.name}" is ready — review and click Save to publish.`,
      });
      onComplete({
        type: "workout",
        payload: {
          ...draft,
          category: draft.category || category,
          equipment: draft.equipment || equipment,
          difficulty_stars: draft.difficulty_stars ?? difficultyStars,
          duration: draft.duration || duration,
          format: draft.format || format,
          focus: isStrength ? (draft.focus || focus) : "",
        },
      });
    } else {
      toast({
        title: "Program drafted",
        description: `"${draft.name}" is ready — review and click Save to publish.`,
      });
      onComplete({
        type: "program",
        payload: {
          ...draft,
          category: draft.category || category,
          equipment: draft.equipment || programEquipmentValue(),
          difficulty_stars: draft.difficulty_stars ?? difficultyStars,
          weeks: draft.weeks ?? weeks,
          days_per_week: draft.days_per_week ?? daysPerWeek,
        },
      });
    }
    onOpenChange(false);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (!userId) throw new Error("Please sign in again before generating content.");

      const request = type === "workout"
        ? {
            category,
            equipment,
            equipment_ids: equipmentIds,
            difficulty_stars: difficultyStars,
            format,
            duration,
            focus: isStrength ? focus : undefined,
            access,
            price: access === "standalone" ? price : undefined,
            tier_required: access === "premium" ? "premium" : undefined,
          }
        : {
            category,
            equipment: programEquipmentValue(),
            equipment_ids: equipmentIds,
            difficulty_stars: difficultyStars,
            weeks,
            days_per_week: daysPerWeek,
            access,
            price: access === "standalone" ? price : undefined,
            tier_required: access === "premium" ? "premium" : undefined,
          };

      // The database starts the long-running function independently, so a
      // browser or mobile connection closing cannot cancel the generation.
      const { data: jobId, error: jobError } = await supabase.rpc("start_admin_generation", {
        _content_type: type,
        _request_payload: request,
      });
      if (jobError || !jobId) throw jobError ?? new Error("Could not start generation.");

      const draft = await awaitJobDraft(String(jobId), type);

      deliverDraft(draft, type);
    } catch (e: any) {
      console.error(`[Wizard] generate-${type} failed`, e);
      let message = e?.message || `Could not generate the ${type}. Please adjust the settings and try again.`;
      if (e?.context && typeof e.context.json === "function") {
        try {
          const backendError = await e.context.json();
          message = backendError?.error || message;
        } catch {
          // Keep the SDK message if the backend did not return JSON.
        }
      }
      toast({
        title: "Generation failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  /**
   * Skip the wizard entirely and open the manual editor with a clean
   * blank form — same behavior the old "+ Create" button had before
   * the wizard was added.
   */
  const handleSkipToManual = () => {
    onComplete(
      type === "workout"
        ? { type: "workout", payload: {} as any }
        : { type: "program", payload: {} as any },
    );
    onOpenChange(false);
  };

  // --- choice grid helper ---
  const ChoiceGrid = ({
    options,
    value,
    onChange,
    columns = 2,
  }: {
    options: { value: string | number; label: string; sub?: string }[];
    /** A single selected value, or an array when several may be ticked. */
    value: string | number | (string | number)[];
    onChange: (v: any) => void;
    columns?: 2 | 3 | 4;
  }) => (
    <div
      className={
        "grid gap-2 " +
        (columns === 4 ? "grid-cols-2 sm:grid-cols-4" : columns === 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2")
      }
    >
      {options.map((o) => {
        const active = Array.isArray(value) ? value.includes(o.value) : value === o.value;
        return (
          <Card
            key={String(o.value)}
            role="button"
            tabIndex={0}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onChange(o.value);
              }
            }}
            className={
              "p-3 cursor-pointer transition border-2 " +
              (active
                ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                : "border-border hover:border-primary/50")
            }
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium text-sm">{o.label}</div>
              {active && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
            </div>
            {o.sub && <p className="text-xs text-muted-foreground mt-1">{o.sub}</p>}
          </Card>
        );
      })}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden px-3 sm:px-6">
        <DialogHeader>
          <DialogTitle>Create New Content</DialogTitle>
          <DialogDescription>
            Step {step + 1} of {totalSteps} — {steps[step]?.title}. Pick the metadata first; you'll
            write the body (description, instructions, tips, sections) in the next screen using the
            same protocols as the rest of the library.
          </DialogDescription>
        </DialogHeader>

        {/* Skip-to-manual shortcut — preserves the pre-wizard behavior */}
        <div className="flex items-center justify-end -mt-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-primary"
            onClick={handleSkipToManual}
          >
            Skip wizard — open manual editor →
          </Button>
        </div>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5 my-3">
          {steps.map((s, i) => (
            <div
              key={s.key}
              className={
                "h-1.5 rounded-full flex-1 transition " +
                (i < step
                  ? "bg-primary"
                  : i === step
                  ? "bg-primary/70"
                  : "bg-muted")
              }
            />
          ))}
        </div>

        <div className="space-y-4">
          {currentKey === "type" && (
            <ChoiceGrid
              options={[
                { value: "workout", label: "Workout", sub: "Single session (warm-up → main → finisher → cool-down)" },
                { value: "program", label: "Training Program", sub: "Multi-week plan with weekly schedule" },
              ]}
              value={type}
              onChange={(v) => {
                if (!allowTypeSwitch) return;
                setType(v);
                setCategory("");
              }}
              columns={2}
            />
          )}

          {currentKey === "category" && type === "workout" && (
            <ChoiceGrid
              options={WORKOUT_CATEGORIES.map((c) => ({ value: c, label: c }))}
              value={category}
              onChange={setCategory}
              columns={3}
            />
          )}

          {currentKey === "category" && type === "program" && (
            <ChoiceGrid
              options={PROGRAM_CATEGORIES.map((c) => ({ value: c, label: c }))}
              value={category}
              onChange={setCategory}
              columns={2}
            />
          )}

          {currentKey === "difficulty" && (
            <ChoiceGrid
              options={DIFFICULTY_OPTIONS.map((d) => ({ value: d.stars, label: d.label }))}
              value={difficultyStars}
              onChange={(v) => setDifficultyStars(Number(v))}
              columns={2}
            />
          )}

          {currentKey === "equipment" && (
            <>
              <ChoiceGrid
                options={(type === "workout" ? EQUIPMENT_OPTIONS : PROGRAM_EQUIPMENT_OPTIONS).map((e) => ({
                  value: e,
                  label: e,
                }))}
                value={equipment}
                onChange={(v) => {
                  setEquipment(v);
                  if (v.toLowerCase().includes("bodyweight")) setEquipmentIds([]);
                }}
                columns={2}
              />
              {equipment && !equipment.toLowerCase().includes("bodyweight") && (
                <div className="pt-4 mt-4 border-t">
                  <Label className="text-sm font-medium mb-2 block">
                    Which equipment? (pick at least one)
                  </Label>
                  <ChoiceGrid
                    options={ADMIN_EQUIPMENT_CHOICES.map((e) => ({ value: e.id, label: e.label }))}
                    value={equipmentIds}
                    onChange={(v) => {
                      const id = String(v);
                      setEquipmentIds((prev) =>
                        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
                      );
                    }}
                    columns={2}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Only these will be used. Bodyweight movements stay available alongside them.
                  </p>
                </div>
              )}
            </>
          )}

          {currentKey === "duration" && (
            <>
              {isMicro && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
                  Micro-workouts are locked to exactly 5 min total.
                </p>
              )}
              <ChoiceGrid
                options={(isMicro ? [MICRO_DURATION] : WORKOUT_DURATIONS).map((d) => ({ value: d, label: d }))}
                value={duration}
                onChange={(v) => {
                  if (isMicro) return;
                  setDuration(v);
                }}
                columns={3}
              />
            </>
          )}

          {currentKey === "format" && (
            <ChoiceGrid
              options={FORMATS_FREE.map((f) => ({ value: f, label: f }))}
              value={format}
              onChange={setFormat}
              columns={3}
            />
          )}

          {currentKey === "focus" && (
            <ChoiceGrid
              options={STRENGTH_FOCUS_OPTIONS.map((f) => ({ value: f, label: f }))}
              value={focus}
              onChange={setFocus}
              columns={2}
            />
          )}

          {currentKey === "weeks" && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Program length (weeks)</Label>
                <ChoiceGrid
                  options={WEEKS_OPTIONS.map((w) => ({ value: w, label: `${w} weeks` }))}
                  value={weeks}
                  onChange={(v) => setWeeks(Number(v))}
                  columns={3}
                />
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Days per week</Label>
                <ChoiceGrid
                  options={DAYS_PER_WEEK_OPTIONS.map((d) => ({ value: d, label: `${d} days` }))}
                  value={daysPerWeek}
                  onChange={(v) => setDaysPerWeek(Number(v))}
                  columns={4}
                />
              </div>
            </div>
          )}

          {currentKey === "access" && (
            <div className="space-y-4">
              <ChoiceGrid
                options={[
                  { value: "free", label: "Free", sub: "Available to all visitors" },
                  { value: "premium", label: "Premium Subscription", sub: "Requires active membership" },
                  { value: "standalone", label: "Standalone Purchase", sub: "One-time paid item" },
                ]}
                value={access}
                onChange={(v) => setAccess(v as AccessChoice)}
                columns={3}
              />
              {access === "standalone" && (
                <div className="max-w-xs">
                  <Label className="text-sm font-medium mb-1 block">Price (EUR)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 3.99"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          {currentKey === "review" && (
            <Card className="p-4 space-y-2 text-sm">
              <div className="flex items-center gap-2 font-semibold text-base mb-1">
                {type === "workout" ? <Dumbbell className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
                {type === "workout" ? "New Workout" : "New Training Program"}
              </div>
              <Row label="Category" value={category} />
              <Row
                label="Difficulty"
                value={DIFFICULTY_OPTIONS.find((d) => d.stars === difficultyStars)?.label || "—"}
              />
              <Row label="Equipment" value={equipment} />
              {type === "workout" ? (
                <>
                  <Row label="Duration" value={duration} />
                  <Row label="Format" value={format} />
                  {isStrength && <Row label="Strength Focus" value={focus} />}
                </>
              ) : (
                <>
                  <Row label="Weeks" value={`${weeks}`} />
                  <Row label="Days / week" value={`${daysPerWeek}`} />
                </>
              )}
              <Row
                label="Access"
                value={
                  access === "free"
                    ? "Free"
                    : access === "premium"
                    ? "Premium subscription"
                    : `Standalone purchase — €${price || "?"}`
                }
              />
              <p className="text-xs text-muted-foreground pt-2 border-t mt-3">
                <strong>Generate &amp; Review</strong> drafts the full session (name, description,
                5-section body, instructions, tips) using library-first exercises and opens it in
                the editor — nothing is saved until you click <strong>Save</strong> there. Or use
                <strong> Open Editor </strong> to write everything by hand.
              </p>
            </Card>
          )}
        </div>

        <div className="pt-4 mt-4 border-t">
          {currentKey === "review" ? (
            <div className="space-y-3">
              <Button className="h-12 w-full text-base font-semibold" onClick={handleGenerate} disabled={generating}>
                {generating ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 shrink-0 animate-spin" /> Generating workout…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2 shrink-0" /> Generate &amp; Review
                  </>
                )}
              </Button>
              <div className="flex items-center justify-between gap-2">
                <Button variant="outline" onClick={goBack} disabled={generating}>
                  <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </Button>
                <Badge variant="outline" className="text-xs">
                  {step + 1} / {totalSteps}
                </Badge>
                <Button variant="ghost" size="sm" onClick={handleFinish} disabled={generating}>
                  Write manually
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <Button variant="outline" onClick={goBack} disabled={step === 0 || generating}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Badge variant="outline" className="text-xs">
                {step + 1} / {totalSteps}
              </Badge>
              <Button onClick={goNext} disabled={!canContinue()}>
                Next <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-3 py-1">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium text-right">{value || "—"}</span>
  </div>
);