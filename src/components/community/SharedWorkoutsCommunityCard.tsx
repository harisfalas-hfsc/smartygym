import { Link } from "react-router-dom";
import { Clock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSharedWorkouts } from "@/hooks/useSharedWorkouts";

const FALLBACK_IMAGE = "/images/workouts/shared-workouts-card-mobile.jpg";

/**
 * Community card listing the latest workouts members shared with everyone.
 * The full list lives in the Shared Workouts category.
 */
export function SharedWorkoutsCommunityCard({ limit = 6 }: { limit?: number }) {
  const { data: workouts = [], isLoading } = useSharedWorkouts();
  const latest = workouts.slice(0, limit);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading shared workouts…</p>;
  }

  if (latest.length === 0) {
    return (
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          No one has shared a workout yet. Build one and be the first.
        </p>
        <Button asChild className="mt-4 rounded-2xl font-bold">
          <Link to="/create-your-own-workout">Create your own workout</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {latest.map((w) => (
        <Link
          key={w.id}
          to={`/workout/shared/${w.id}`}
          className="flex items-center gap-3 rounded-xl border border-border p-2 transition hover:border-primary"
        >
          <img
            src={w.image_url || FALLBACK_IMAGE}
            alt={w.name}
            loading="lazy"
            className="h-14 w-14 flex-shrink-0 rounded-lg object-cover"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{w.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {w.category} · {w.duration_label ?? `${w.duration_min} min`}
            </p>
            <p className="flex items-center gap-1 text-xs text-primary">
              <Users className="h-3 w-3" />
              Shared by {w.shared_by_name || "a member"}
            </p>
          </div>
          <Clock className="ml-auto hidden h-4 w-4 text-muted-foreground sm:block" />
        </Link>
      ))}
      <Button asChild variant="outline" className="w-full rounded-2xl">
        <Link to="/workout/shared">See all shared workouts</Link>
      </Button>
    </div>
  );
}
