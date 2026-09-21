import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, BookOpen, Clock, Dumbbell, MapPin, Play, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ExerciseHTMLContent } from "@/components/ExerciseHTMLContent";
import { ReaderModeDialog } from "@/components/ReaderModeDialog";
import { WorkoutPlayerDialog } from "@/components/WorkoutPlayerDialog";
import { WorkoutToolsCards } from "@/components/WorkoutToolsCards";
import { normalizeWorkoutHtml } from "@/utils/htmlNormalizer";
import { parseWorkoutSteps } from "@/utils/parseWorkoutSteps";
import { CustomWorkoutActions } from "@/components/workout/CustomWorkoutActions";
import { ParqWaiverGate } from "@/components/ParqWaiverGate";
import { ShareWorkoutToggle } from "@/components/workout/ShareWorkoutToggle";

interface CustomWorkoutDetail {
  id: string;
  name: string;
  category: string;
  format: string | null;
  focus: string | null;
  difficulty_stars: number;
  difficulty_label: string | null;
  duration_label: string | null;
  duration_min: number;
  equipment: string[] | null;
  location: string | null;
  mood: string | null;
  description_html: string | null;
  instructions_html: string | null;
  tips_html: string | null;
  main_workout: string | null;
  is_favorite: boolean | null;
  completed_at: string | null;
  has_viewed: boolean | null;
  rating: number | null;
  is_shared?: boolean | null;
  image_url?: string | null;
  needs_review: boolean;
  review_warnings: string[] | null;
  created_at: string;
  status: string;
  generation_error: string | null;
}

const MyOwnWorkoutDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [readerOpen, setReaderOpen] = useState(false);
  const [playerOpen, setPlayerOpen] = useState(false);

  const { data: workout, isLoading } = useQuery({
    queryKey: ["my-own-workout", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_custom_workouts")
        .select("*")
        .eq("id", id ?? "")
        .maybeSingle();
      if (error) throw error;
      return (data as CustomWorkoutDetail) ?? null;
    },
    refetchInterval: (query) => query.state.data?.status === "generating" ? 3000 : false,
  });

  // Opening a session counts as viewing it (private tracking only).
  useEffect(() => {
    if (!workout || workout.status !== "created" || workout.has_viewed) return;
    void supabase
      .from("user_custom_workouts")
      .update({ has_viewed: true, viewed_at: new Date().toISOString() })
      .eq("id", workout.id);
  }, [workout]);

  const bodyHtml = useMemo(
    () => (workout?.main_workout ? normalizeWorkoutHtml(workout.main_workout) : ""),
    [workout?.main_workout],
  );
  const steps = useMemo(() => (bodyHtml ? parseWorkoutSteps(bodyHtml) : []), [bodyHtml]);

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-10 lg:max-w-5xl">
        <Skeleton className="h-10 w-2/3 rounded-xl" />
        <Skeleton className="mt-4 h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!workout) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-extrabold">Workout not found</h1>
        <p className="mt-2 text-muted-foreground">
          This workout may have been deleted, or it belongs to another account.
        </p>
        <Button className="mt-6 rounded-2xl" onClick={() => navigate("/my-workouts")}>
          Back to my workouts
        </Button>
      </div>
    );
  }

  if (workout.status !== "created") {
    const failed = workout.status === "failed";
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-extrabold">{failed ? "Workout build failed" : "Building your workout…"}</h1>
        <p className="mt-2 text-muted-foreground">{failed ? workout.generation_error ?? "Please try building another workout." : "You can leave this page. We will message you when it is ready."}</p>
        <Button className="mt-6 rounded-2xl" onClick={() => navigate(failed ? "/create-your-own-workout" : "/my-workouts")}>{failed ? "Try again" : "My own workouts"}</Button>
      </div>
    );
  }

  return (
    <ParqWaiverGate confirmLabel="I confirm — open my workout">
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-10 lg:max-w-5xl lg:px-8">
      <Helmet>
        <title>{`${workout.name} | My Own Workouts`}</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <Button
        variant="ghost"
        className="mb-4 -ml-2 rounded-xl"
        onClick={() => navigate("/my-workouts")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        My own workouts
      </Button>

      <header className="mb-5">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-primary sm:text-3xl">
          {workout.name}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{workout.category}</Badge>
          {workout.focus ? <Badge variant="outline">{workout.focus}</Badge> : null}
          {workout.format ? <Badge variant="outline">{workout.format}</Badge> : null}
          {workout.difficulty_label ? (
            <Badge variant="outline">{workout.difficulty_label}</Badge>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {workout.duration_label ?? `${workout.duration_min} min`}
          </span>
          {workout.location ? (
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {workout.location}
            </span>
          ) : null}
          {workout.equipment?.length ? (
            <span className="flex items-center gap-1">
              <Dumbbell className="h-4 w-4" />
              {workout.equipment.join(", ")}
            </span>
          ) : null}
          <span className="flex items-center gap-0.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Star
                key={i}
                className={`h-3.5 w-3.5 ${i < workout.difficulty_stars ? "fill-primary text-primary" : "text-muted-foreground/40"}`}
              />
            ))}
          </span>
        </div>
      </header>

      {workout.description_html ? (
        <Card className="mb-5 rounded-2xl border-2 border-primary/20">
          <CardContent className="p-5">
            <ExerciseHTMLContent content={workout.description_html} />
          </CardContent>
        </Card>
      ) : null}

      <Card className="mb-5 rounded-2xl border-2 border-primary/20">
        <CardContent className="space-y-3 p-4 sm:p-5">
          <CustomWorkoutActions workout={workout} />
          <ShareWorkoutToggle workout={workout} />
        </CardContent>
      </Card>

      <div className="mb-5 flex flex-wrap gap-2">
        <Button variant="outline" className="rounded-2xl" onClick={() => setReaderOpen(true)}>
          <BookOpen className="mr-2 h-4 w-4" />
          Reader's mode
        </Button>
      </div>

      <WorkoutToolsCards />

      {steps.length > 0 ? (
        <button
          type="button"
          onClick={() => setPlayerOpen(true)}
          className="mb-6 mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-base font-extrabold text-primary-foreground shadow-lg transition hover:opacity-90"
        >
          <Play className="h-5 w-5" />
          Start your workout
        </button>
      ) : null}

      <Card className="rounded-2xl border-2 border-primary/20">
        <CardContent className="p-5 sm:p-6">
          <div className="workout-content">
            <ExerciseHTMLContent content={bodyHtml} />
          </div>
        </CardContent>
      </Card>

      {workout.instructions_html ? (
        <Card className="mt-5 rounded-2xl">
          <CardContent className="p-5">
            <h2 className="mb-3 text-lg font-extrabold">How to run this session</h2>
            <ExerciseHTMLContent content={workout.instructions_html} />
          </CardContent>
        </Card>
      ) : null}

      {workout.tips_html ? (
        <Card className="mt-5 rounded-2xl">
          <CardContent className="p-5">
            <h2 className="mb-3 text-lg font-extrabold">Coach tips</h2>
            <ExerciseHTMLContent content={workout.tips_html} />
          </CardContent>
        </Card>
      ) : null}

      {/* Internal build notes stay internal — admin only, never shown to members. */}


      <ReaderModeDialog
        open={readerOpen}
        onOpenChange={setReaderOpen}
        title={workout.name}
        content={bodyHtml}
        metadata={{
          duration: workout.duration_label ?? `${workout.duration_min} min`,
          equipment: workout.equipment?.join(", ") ?? undefined,
          difficulty: workout.difficulty_label ?? undefined,
          category: workout.category,
        }}
      />

      <WorkoutPlayerDialog
        open={playerOpen}
        onOpenChange={setPlayerOpen}
        title={workout.name}
        steps={steps}
      />
    </div>
    </ParqWaiverGate>
  );
};

export default MyOwnWorkoutDetail;
