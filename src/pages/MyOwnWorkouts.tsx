import { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarClock, Clock, Dumbbell, ListChecks, MapPin, Plus, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DesktopPageIntro } from "@/components/DesktopPageIntro";
import { CustomWorkoutActions } from "@/components/workout/CustomWorkoutActions";
import { useScheduledWorkouts } from "@/hooks/useScheduledWorkouts";
import { CompactFilters } from "@/components/CompactFilters";

type StatusFilter = "all" | "favorites" | "completed" | "viewed" | "rated" | "scheduled";
type SortOrder = "newest" | "oldest";

export interface CustomWorkoutRow {
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
  is_favorite: boolean | null;
  completed_at: string | null;
  has_viewed: boolean | null;
  rating: number | null;
  created_at: string;
}

const Stars = ({ count }: { count: number }) => (
  <span className="flex items-center gap-0.5" aria-label={`${count} out of 6`}>
    {Array.from({ length: 6 }).map((_, i) => (
      <Star
        key={i}
        className={`h-3.5 w-3.5 ${i < count ? "fill-primary text-primary" : "text-muted-foreground/40"}`}
      />
    ))}
  </span>
);

const MyOwnWorkouts = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const { scheduledWorkouts, refetch: refetchScheduled } = useScheduledWorkouts(userId);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) navigate("/auth", { replace: true });
      else setUserId(data.user.id);
    });
  }, [navigate]);

  const { data: workouts = [], isLoading } = useQuery({
    queryKey: ["my-own-workouts", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_custom_workouts")
        .select(
          "id,name,category,format,focus,difficulty_stars,difficulty_label,duration_label,duration_min,equipment,location,is_favorite,completed_at,has_viewed,rating,created_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CustomWorkoutRow[];
    },
  });

  const scheduledByWorkoutId = new Map(
    scheduledWorkouts
      .filter((item) => item.content_type === "custom_workout")
      .map((item) => [item.content_id, item.scheduled_date]),
  );

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "favorites", label: "Favorites" },
    { value: "completed", label: "Completed" },
    { value: "viewed", label: "Viewed" },
    { value: "rated", label: "Rated" },
    { value: "scheduled", label: "Scheduled" },
  ];

  const countForStatus = (status: StatusFilter) => workouts.filter((workout) => {
    switch (status) {
      case "favorites": return !!workout.is_favorite;
      case "completed": return !!workout.completed_at;
      case "viewed": return !!workout.has_viewed;
      case "rated": return workout.rating != null && workout.rating > 0;
      case "scheduled": return scheduledByWorkoutId.has(workout.id);
      default: return true;
    }
  }).length;

  const filteredWorkouts = workouts
    .filter((w) => {
      switch (statusFilter) {
        case "favorites":
          return !!w.is_favorite;
        case "completed":
          return !!w.completed_at;
        case "viewed":
          return !!w.has_viewed;
        case "rated":
          return w.rating != null && w.rating > 0;
        case "scheduled":
          return scheduledByWorkoutId.has(w.id);
        default:
          return true;
      }
    })
    .sort((a, b) =>
      sortOrder === "newest"
        ? b.created_at.localeCompare(a.created_at)
        : a.created_at.localeCompare(b.created_at),
    );

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-12 lg:max-w-6xl lg:px-8 lg:py-12">
      <Helmet>
        <title>My Own Workouts | Smarty Gym</title>
        <meta
          name="description"
          content="Every workout you built with Smarty Gym's Create Your Own Workout, ready to open and train."
        />
        <meta name="robots" content="noindex" />
      </Helmet>

      <DesktopPageIntro icon={ListChecks} title="My Own Workouts">
        <p>
          Every session you built yourself lives here. Open one to train it, or build a new one
          whenever you like.
        </p>
      </DesktopPageIntro>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold uppercase tracking-tight text-primary lg:hidden">
          My Own Workouts
        </h1>
        <Button className="rounded-2xl font-bold" onClick={() => navigate("/create-your-own-workout")}>
          <Plus className="mr-2 h-4 w-4" />
          Create a workout
        </Button>
      </div>

      {!isLoading && workouts.length > 0 && (
        <CompactFilters
          compact
          filters={[
            {
              name: "Status",
              value: statusFilter,
              onChange: (value) => setStatusFilter(value as StatusFilter),
              options: statusOptions.map((option) => ({
                value: option.value,
                label: `${option.label} (${countForStatus(option.value)})`,
              })),
            },
            {
              name: "Sort",
              value: sortOrder,
              onChange: (value) => setSortOrder(value as SortOrder),
              options: [
                { value: "newest", label: "Newest first" },
                { value: "oldest", label: "Oldest first" },
              ],
            },
          ]}
        />
      )}

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
      ) : workouts.length === 0 ? (
        <Card className="rounded-3xl border-2 border-primary/30">
          <CardContent className="p-8 text-center">
            <p className="text-base font-semibold">You haven't built a workout yet.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Answer a few questions and Smarty Coach builds one around your goal, your time and
              your equipment.
            </p>
            <Button
              className="mt-5 h-12 rounded-2xl font-bold"
              onClick={() => navigate("/create-your-own-workout")}
            >
              Create your first workout
            </Button>
          </CardContent>
        </Card>
      ) : filteredWorkouts.length === 0 ? (
        <Card className="rounded-3xl border-2 border-border">
          <CardContent className="p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No workouts match this filter yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredWorkouts.map((w) => (
            <Card
              key={w.id}
              className="cursor-pointer rounded-2xl border-2 border-border transition hover:border-primary"
              onClick={() => navigate(`/my-workouts/${w.id}`)}
            >
              <CardContent className="flex items-start justify-between gap-3 p-4 sm:p-5">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-extrabold sm:text-lg">{w.name}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {w.category}
                    </Badge>
                    {w.focus ? (
                      <Badge variant="outline" className="text-xs">
                        {w.focus}
                      </Badge>
                    ) : null}
                    {w.format ? (
                      <Badge variant="outline" className="text-xs">
                        {w.format}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {w.duration_label ?? `${w.duration_min} min`}
                    </span>
                    {w.location ? (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {w.location}
                      </span>
                    ) : null}
                    {w.equipment?.length ? (
                      <span className="flex items-center gap-1">
                        <Dumbbell className="h-3.5 w-3.5" />
                        {w.equipment.join(", ")}
                      </span>
                    ) : null}
                    <Stars count={w.difficulty_stars} />
                     {scheduledByWorkoutId.has(w.id) ? (
                       <span className="flex items-center gap-1 text-primary">
                         <CalendarClock className="h-3.5 w-3.5" />
                         {new Date(`${scheduledByWorkoutId.get(w.id)}T00:00:00`).toLocaleDateString()}
                       </span>
                     ) : null}
                  </div>
                  <div onClick={(e) => e.stopPropagation()} className="mt-3">
                     <CustomWorkoutActions workout={w} compact onScheduled={() => void refetchScheduled()} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        className="mt-6 min-h-11 w-full gap-2"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>
    </div>
  );
};

export default MyOwnWorkouts;
