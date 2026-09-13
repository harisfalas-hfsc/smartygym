import { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { useNavigate } from "react-router-dom";
import {
  Loader2,
  Sparkles,
  Wand2,
  Target,
  HeartPulse,
  Clock,
  MapPin,
  Dumbbell,
  MessageSquare,
  Flame,
  ListChecks,
  Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAccessControl } from "@/hooks/useAccessControl";
import { useToast } from "@/hooks/use-toast";
import { DesktopPageIntro } from "@/components/DesktopPageIntro";
import { GeneratingDialog } from "@/components/workout/GeneratingDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  BODY_FOCUS,
  EQUIPMENT,
  FOCUS_GOALS,
  GOALS,
  LEVEL_GROUPS,
  LOCATIONS,
  LOW_ENERGY_MOODS,
  MOODS,
  TIMES,
} from "@/lib/coach-options";

/** Member-built workouts allowed per calendar day. Mirrors the backend limit. */
const DAILY_LIMIT = 2;

/** Page description — human coaching knowledge, never AI talk. */
const PAGE_DESCRIPTION =
  "Create Your Own Workout puts Coach Haris Falas's knowledge and experience in your pocket. " +
  "Every session is assembled from his coaching rules and the Smarty Gym exercise library — a huge collection " +
  "of human-designed movements — matched to your goal, your time, your equipment and how you feel today. " +
  "Nothing generic, nothing random: the right workout for you, built on real coaching.";

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-12 w-full items-center justify-start truncate whitespace-nowrap rounded-2xl border px-3 text-left text-[13px] font-semibold leading-none transition sm:text-sm ${
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border bg-background text-foreground hover:border-primary/50"
      }`}
    >
      {children}
    </button>
  );
}

function QuestionCard({
  step,
  icon: Icon,
  title,
  hint,
  children,
}: {
  step: number;
  icon: React.ElementType;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border-2 border-primary bg-card p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
            Step {step}
          </p>
          <h2 className="text-lg font-extrabold leading-tight">{title}</h2>
          {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">{children}</div>;
}

const CreateYourOwnWorkout = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userTier, isLoading: accessLoading } = useAccessControl();
  const isPremium = userTier === "premium";

  const [goal, setGoal] = useState<string>("");
  const [focus, setFocus] = useState<string>("");
  const showFocus = FOCUS_GOALS.includes(goal);

  const [mood, setMood] = useState<string>("");
  const [minutes, setMinutes] = useState<number | null>(null);
  const [location, setLocation] = useState<string>("");
  const [equipment, setEquipment] = useState<string[]>([]);
  const [otherEquipment, setOtherEquipment] = useState("");
  const [note, setNote] = useState("");
  const [level, setLevel] = useState<string>("");

  const [busy, setBusy] = useState(false);
  const [generationDialogOpen, setGenerationDialogOpen] = useState(false);
  const [confirmHard, setConfirmHard] = useState(false);
  const [name, setName] = useState<string>("");
  const [builtToday, setBuiltToday] = useState<number | null>(null);

  const remaining = builtToday === null ? null : Math.max(0, DAILY_LIMIT - builtToday);
  const limitReached = remaining === 0;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        navigate("/auth", { replace: true });
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      const dayStart = new Date();
      dayStart.setUTCHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("user_custom_workouts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", auth.user.id)
        .gte("created_at", dayStart.toISOString());
      if (cancelled) return;
      setName((profile?.full_name as string) ?? "");
      setBuiltToday(count ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  function toggleEquipment(id: string) {
    setEquipment((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]));
  }

  const canGenerate = Boolean(
    goal && mood && minutes && location && equipment.length > 0 && level && (!showFocus || focus),
  );

  /** Polls the reserved session row until the background build finishes. */
  async function waitForSession(id: string) {
    const deadline = Date.now() + 4 * 60 * 1000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 3000));
      const { data } = await supabase
        .from("user_custom_workouts")
        .select("id,status,review_warnings")
        .eq("id", id)
        .maybeSingle();
      if (!data) {
        throw new Error(
          "Smarty Coach couldn't build a session that meets the coaching standard this time. Please try again.",
        );
      }
      if (data.status !== "generating") return data as { review_warnings?: string[] | null };
    }
    throw new Error("This is taking longer than usual. Check My own workouts in a moment.");
  }

  async function generate(request: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    setGenerationDialogOpen(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-custom-workout", {
        body: request,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // The session is assembled in the background (it takes longer than a
      // single request allows), so wait here until the row is ready.
      const ready = await waitForSession(String(data.id));
      setBuiltToday((n) => (n ?? 0) + 1);
      if (ready.review_warnings?.length) {
        toast({ title: "A note from Smarty Coach", description: ready.review_warnings[0] });
      }
      navigate(`/my-workouts/${data.id}`);
    } catch (e) {
      const message =
        e instanceof Error && e.message && !/non-2xx/i.test(e.message)
          ? e.message
          : "We hit a temporary snag building your workout. Your answers are safe — please try again.";
      toast({ title: "Couldn't build the workout", description: message, variant: "destructive" });
    } finally {
      setGenerationDialogOpen(false);
      setBusy(false);
    }
  }

  function buildRequest(levelOverride?: string) {
    return {
      goal,
      ...(showFocus ? { focus } : {}),
      mood,
      minutes: minutes ?? undefined,
      location,
      equipment: equipment.length ? equipment : ["bodyweight"],
      equipmentOther: equipment.includes("other") ? otherEquipment.trim() : "",
      note: note.trim(),
      level: levelOverride ?? level,
    };
  }

  function requestGenerate() {
    if (limitReached) {
      toast({
        title: "Daily limit reached",
        description: `You can build ${DAILY_LIMIT} workouts a day. Your next one unlocks tomorrow.`,
        variant: "destructive",
      });
      return;
    }
    if (!canGenerate) {
      toast({
        title: "Almost there",
        description: "Please answer all required questions first.",
        variant: "destructive",
      });
      return;
    }
    if (level !== "auto" && Number(level) >= 5 && LOW_ENERGY_MOODS.includes(mood)) {
      setConfirmHard(true);
      return;
    }
    void generate(buildRequest());
  }

  /** Surprise me: a legal random brief, still built by the same rule book. */
  function surpriseMe() {
    if (limitReached) {
      toast({
        title: "Daily limit reached",
        description: `You can build ${DAILY_LIMIT} workouts a day. Your next one unlocks tomorrow.`,
        variant: "destructive",
      });
      return;
    }
    const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]!;
    const surpriseGoal = pick(GOALS.filter((g) => g.id !== "micro")).id;
    const surprise = {
      goal: surpriseGoal,
      ...(FOCUS_GOALS.includes(surpriseGoal) ? { focus: "FULL BODY" } : {}),
      mood: mood || "normal",
      minutes: pick([30, 40, 45]),
      location: location || "anywhere",
      equipment: equipment.length ? equipment : ["bodyweight"],
      equipmentOther: "",
      note: "",
      level: level || "auto",
    };
    void generate(surprise);
  }

  // Premium gate: building workouts is a Premium feature. When Free Access
  // Mode is on, every signed-in member already resolves to "premium" via the
  // access-control context, so this gate disappears automatically.
  if (!accessLoading && !isPremium) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-12 lg:max-w-6xl lg:px-8 lg:py-12">
        <Helmet>
          <title>Create Your Own Workout | Smarty Gym</title>
          <meta
            name="description"
            content="Answer a few questions and Smarty Gym builds you a coach-grade workout from its human-designed exercise library."
          />
          <meta name="robots" content="noindex" />
        </Helmet>

        <DesktopPageIntro icon={Sparkles} title="Create Your Own Workout">
          <p className="font-bold text-foreground">{PAGE_DESCRIPTION}</p>
        </DesktopPageIntro>

        <Card className="lg:hidden mb-8 bg-white dark:bg-card border-2 border-primary/40 shadow-primary">
          <div className="p-4 sm:p-5">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight uppercase mb-3 text-center">
              Create Your Own Workout
            </h1>
            <p className="text-sm text-center text-muted-foreground">{PAGE_DESCRIPTION}</p>
          </div>
        </Card>

        <div className="rounded-3xl border-2 border-primary bg-card p-6 text-center shadow-sm sm:p-8">
          <Crown className="mx-auto h-10 w-10 text-primary" aria-hidden="true" />
          <h2 className="mt-3 text-xl font-extrabold">A Premium feature</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Create Your Own Workout is included with Smarty Gym Premium. Premium members can build
            up to {DAILY_LIMIT} personalised workouts every day — and every workout you build stays
            yours forever, even if your subscription ends.
          </p>
          <Button
            size="lg"
            className="mt-5 h-12 rounded-2xl px-8 font-extrabold"
            onClick={() => navigate("/smarty-premium")}
          >
            <Crown className="mr-2 h-5 w-5" />
            Join Premium
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-12 lg:max-w-6xl lg:px-8 lg:py-12">
      <Helmet>
        <title>Create Your Own Workout | Smarty Gym</title>
        <meta
          name="description"
          content="Answer a few questions and Smarty Gym builds you a coach-grade workout from its human-designed exercise library."
        />
        <meta name="robots" content="noindex" />
      </Helmet>

      <DesktopPageIntro icon={Sparkles} title="Create Your Own Workout">
        <p>{PAGE_DESCRIPTION}</p>
      </DesktopPageIntro>

      <div className="mb-6 lg:hidden">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-primary">
          Create Your Own Workout
        </h1>
        <div className="mt-3 rounded-3xl border-2 border-primary bg-card p-5 shadow-sm">
          {name ? (
            <p className="mb-2 text-sm font-bold text-foreground">
              {name}, what's your workout today?
            </p>
          ) : null}
          <p className="text-sm leading-relaxed text-muted-foreground">{PAGE_DESCRIPTION}</p>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/40 p-4">
        <p className="text-sm text-muted-foreground">
          {remaining === null
            ? "Checking today's allowance…"
            : limitReached
              ? `You've built your ${DAILY_LIMIT} workouts for today. The next one unlocks tomorrow.`
              : `You can build ${remaining} more ${remaining === 1 ? "workout" : "workouts"} today.`}
        </p>
        <Button variant="outline" className="rounded-2xl" onClick={() => navigate("/my-workouts")}>
          <ListChecks className="mr-2 h-4 w-4" />
          My own workouts
        </Button>
      </div>

      <GeneratingDialog
        open={busy && generationDialogOpen}
        onLeave={() => setGenerationDialogOpen(false)}
      />

      <div className="mb-6 rounded-3xl border-2 border-primary bg-primary/5 p-5 text-center">
        <p className="text-sm font-semibold">Don't feel like choosing?</p>
        <Button
          size="lg"
          className="mt-3 h-14 w-full rounded-2xl text-base font-extrabold"
          disabled={busy || limitReached}
          onClick={surpriseMe}
        >
          {busy ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <Wand2 className="mr-2 h-5 w-5" />
          )}
          Surprise me
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          A different pick every day, chosen from what suits you.
        </p>
      </div>

      <div className="space-y-4">
        <QuestionCard step={1} icon={Target} title="What's your goal today?">
          <Grid>
            {GOALS.map((g) => (
              <Chip key={g.id} active={goal === g.id} onClick={() => setGoal(g.id)}>
                {g.label}
              </Chip>
            ))}
          </Grid>
        </QuestionCard>

        {showFocus ? (
          <QuestionCard
            step={2}
            icon={Dumbbell}
            title={goal === "muscle" ? "Which muscles today?" : "Which part of the body?"}
            hint="Smarty Coach only picks exercises that train what you choose."
          >
            <Grid>
              {BODY_FOCUS.map((f) => (
                <Chip key={f.id} active={focus === f.id} onClick={() => setFocus(f.id)}>
                  {f.label}
                </Chip>
              ))}
            </Grid>
          </QuestionCard>
        ) : null}

        <QuestionCard step={showFocus ? 3 : 2} icon={HeartPulse} title="How are you feeling today?">
          <Grid>
            {MOODS.map((m) => (
              <Chip key={m.id} active={mood === m.id} onClick={() => setMood(m.id)}>
                {m.label}
              </Chip>
            ))}
          </Grid>
        </QuestionCard>

        <QuestionCard
          step={showFocus ? 4 : 3}
          icon={Flame}
          title="Choose the difficulty level"
          hint="Beginner, Intermediate or Advanced — or let Smarty decide from your profile and today's mood."
        >
          <div className="mb-2.5">
            <Chip active={level === "auto"} onClick={() => setLevel("auto")}>
              Let Smarty decide
            </Chip>
          </div>
          <div className="space-y-2">
            {LEVEL_GROUPS.map((g) => (
              <div
                key={g.label}
                className="grid grid-cols-2 items-center gap-2 rounded-2xl border border-border bg-background p-2"
              >
                <p className="col-span-2 px-1 text-sm font-semibold">{g.label}</p>
                {g.levels.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setLevel(l.id)}
                    className={`flex flex-col items-start justify-center rounded-xl border px-3 py-2 text-left transition ${
                      level === l.id
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <span className="text-base leading-none tracking-wide text-yellow-400">
                      {"\u2605".repeat(l.stars)}
                      <span className="text-muted-foreground/40">{"\u2606".repeat(6 - l.stars)}</span>
                    </span>
                    <span className="mt-0.5 text-xs text-muted-foreground">{l.hint}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </QuestionCard>

        <QuestionCard step={showFocus ? 5 : 4} icon={Clock} title="Time available">
          <Grid>
            {TIMES.map((t) => (
              <Chip key={t} active={minutes === t} onClick={() => setMinutes(t)}>
                {t} min
              </Chip>
            ))}
          </Grid>
        </QuestionCard>

        <QuestionCard step={showFocus ? 6 : 5} icon={MapPin} title="Where are you training?">
          <Grid>
            {LOCATIONS.map((l) => (
              <Chip key={l.id} active={location === l.id} onClick={() => setLocation(l.id)}>
                {l.label}
              </Chip>
            ))}
          </Grid>
        </QuestionCard>

        <QuestionCard
          step={showFocus ? 7 : 6}
          icon={Dumbbell}
          title="Equipment available"
          hint="Only what you pick will appear in your workout."
        >
          <Grid>
            {EQUIPMENT.map((e) => (
              <Chip
                key={e.id}
                active={equipment.includes(e.id)}
                onClick={() => toggleEquipment(e.id)}
              >
                {e.label}
              </Chip>
            ))}
          </Grid>
          {equipment.includes("other") ? (
            <div className="mt-3">
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                What else do you have? Separate with commas.
              </label>
              <Textarea
                value={otherEquipment}
                onChange={(e) => setOtherEquipment(e.target.value)}
                placeholder="e.g. sandbag, medicine ball, stability ball, rope"
                rows={2}
                className="rounded-2xl"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Smarty Coach only uses it if a matching exercise exists in the library.
              </p>
            </div>
          ) : null}
        </QuestionCard>

        <QuestionCard
          step={showFocus ? 8 : 7}
          icon={MessageSquare}
          title="Anything else?"
          hint="Optional — Smarty Coach reads this too."
        >
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. shoulder is a bit sore, I'd love something for legs"
            rows={3}
            className="rounded-2xl"
          />
        </QuestionCard>
      </div>

      <div className="sticky bottom-4 mt-6">
        <Button
          size="lg"
          className="h-16 w-full rounded-2xl text-base font-extrabold shadow-lg"
          disabled={busy || !canGenerate || limitReached}
          onClick={requestGenerate}
        >
          {busy ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-5 w-5" />
          )}
          {busy ? "Smarty Coach is thinking…" : "Create my workout"}
        </Button>
        {!canGenerate && !busy && !limitReached ? (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Select goal, mood, difficulty, time, location and equipment to build your workout.
          </p>
        ) : null}
      </div>

      <AlertDialog open={confirmHard} onOpenChange={setConfirmHard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Advanced today — are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              You told Smarty Coach you're feeling{" "}
              {MOODS.find((m) => m.id === mood)?.label.toLowerCase() ?? mood}. Advanced means high
              volume, complex movements and short rest. Training hard on a low-energy day raises
              injury risk. Smarty Coach can scale it to match how you feel instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setLevel("auto");
                void generate(buildRequest("auto"));
              }}
            >
              Scale it to my mood
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => void generate(buildRequest())}>
              Yes, go advanced
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CreateYourOwnWorkout;
