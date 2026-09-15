import { useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Clock, Dumbbell, MapPin, Play, Star, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AccessGate } from "@/components/AccessGate";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { ExerciseHTMLContent } from "@/components/ExerciseHTMLContent";
import { ReaderModeDialog } from "@/components/ReaderModeDialog";
import { WorkoutPlayerDialog } from "@/components/WorkoutPlayerDialog";
import { WorkoutToolsCards } from "@/components/WorkoutToolsCards";
import { ParqWaiverGate } from "@/components/ParqWaiverGate";
import { normalizeWorkoutHtml } from "@/utils/htmlNormalizer";
import { parseWorkoutSteps } from "@/utils/parseWorkoutSteps";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useToast } from "@/hooks/use-toast";

interface SharedWorkoutDetailRow {
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
  description_html: string | null;
  instructions_html: string | null;
  tips_html: string | null;
  main_workout: string | null;
  image_url: string | null;
  shared_by_name: string | null;
  is_shared: boolean;
}

const SharedWorkoutDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin } = useAdminRole();
  const [readerOpen, setReaderOpen] = useState(false);
  const [playerOpen, setPlayerOpen] = useState(false);

  const { data: workout, isLoading, refetch } = useQuery({
    queryKey: ["shared-workout", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_custom_workouts")
        .select("*")
        .eq("id", id!)
        .eq("is_shared", true)
        .maybeSingle();
      if (error) throw error;
      return (data as SharedWorkoutDetailRow) ?? null;
    },
    staleTime: 0,
    gcTime: 0,
  });

  const bodyHtml = useMemo(
    () => (workout?.main_workout ? normalizeWorkoutHtml(workout.main_workout) : ""),
    [workout?.main_workout],
  );
  const steps = useMemo(() => (bodyHtml ? parseWorkoutSteps(bodyHtml) : []), [bodyHtml]);

  const adminUnshare = async () => {
    if (!workout) return;
    const { error } = await supabase
      .from("user_custom_workouts")
      .update({ is_shared: false, shared_at: null })
      .eq("id", workout.id);
    if (error) {
      toast({ title: "Could not remove this workout", variant: "destructive" });
      return;
    }
    toast({ title: "Removed from Shared Workouts" });
    void refetch();
    navigate("/workout/shared");
  };

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
        <h1 className="text-2xl font-extrabold">Workout not available</h1>
        <p className="mt-2 text-muted-foreground">
          This workout is no longer shared with the community.
        </p>
        <Button className="mt-6 rounded-2xl" onClick={() => navigate("/workout/shared")}>
          Back to shared workouts
        </Button>
      </div>
    );
  }

  return (
    <AccessGate requireAuth requirePremium contentType="workout" contentName={workout.name}>
      <ParqWaiverGate confirmLabel="I confirm — open this workout">
        <div className="mx-auto w-full max-w-4xl px-4 py-4 sm:py-6 lg:max-w-5xl lg:px-8">
          <Helmet>
            <title>{`${workout.name} | Shared Workouts`}</title>
            <meta name="robots" content="noindex" />
          </Helmet>

          <PageBreadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Smarty Workouts", href: "/workout" },
              { label: "Shared Workouts", href: "/workout/shared" },
              { label: workout.name },
            ]}
          />

          <header className="mb-5">
            <h1 className="text-2xl font-extrabold uppercase tracking-tight text-primary sm:text-3xl">
              {workout.name}
            </h1>
            <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4 text-primary" />
              Shared by {workout.shared_by_name || "a member"}
            </p>
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

          <img
            src={SHARED_WORKOUTS_IMAGE}
            alt={workout.name}
            loading="lazy"
            className="mb-5 h-56 w-full rounded-2xl object-cover sm:h-72"
          />

          {workout.description_html ? (
            <Card className="mb-5 rounded-2xl border-2 border-primary/20">
              <CardContent className="p-5">
                <ExerciseHTMLContent content={workout.description_html} />
              </CardContent>
            </Card>
          ) : null}

          <div className="mb-5 flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-2xl" onClick={() => setReaderOpen(true)}>
              <BookOpen className="mr-2 h-4 w-4" />
              Reader's mode
            </Button>
            {isAdmin ? (
              <Button variant="destructive" className="rounded-2xl" onClick={() => void adminUnshare()}>
                Remove from Shared Workouts
              </Button>
            ) : null}
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

          <Button
            type="button"
            variant="outline"
            className="mt-6 min-h-11 w-full gap-2"
            onClick={() => navigate("/workout/shared")}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to shared workouts
          </Button>

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
    </AccessGate>
  );
};

export default SharedWorkoutDetail;
