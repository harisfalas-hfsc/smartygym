import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, CheckCircle, Heart, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { ScheduleWorkoutDialog } from "@/components/ScheduleWorkoutDialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export interface CustomWorkoutFlags {
  id: string;
  name: string;
  is_favorite?: boolean | null;
  completed_at?: string | null;
  has_viewed?: boolean | null;
  rating?: number | null;
}

interface Props {
  workout: CustomWorkoutFlags;
  compact?: boolean;
  onScheduled?: () => void;
}

/**
 * Private tracking controls for a user-created workout.
 * Ratings here are personal only — they never feed the community pages,
 * comments or leaderboards.
 */
export const CustomWorkoutActions = ({ workout, compact = false, onScheduled }: Props) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const isFavorite = !!workout.is_favorite;
  const isCompleted = !!workout.completed_at;
  const rating = workout.rating ?? 0;

  const patch = async (values: TablesUpdate<"user_custom_workouts">, message: string) => {
    setSaving(true);
    const { error } = await supabase
      .from("user_custom_workouts")
      .update(values)
      .eq("id", workout.id);
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: message });
    void queryClient.invalidateQueries({ queryKey: ["my-own-workouts"] });
    void queryClient.invalidateQueries({ queryKey: ["my-own-workout", workout.id] });
  };

  return (
    <>
      <div className={cn("flex flex-wrap items-center gap-2", compact && "gap-1.5")}>
        <Button
          type="button"
          variant="outline"
          size={compact ? "sm" : "default"}
          disabled={saving}
          className="rounded-2xl"
          onClick={() =>
            patch(
              { is_favorite: !isFavorite },
              isFavorite ? "Removed from favorites" : "Added to favorites",
            )
          }
        >
          <Heart className={cn("mr-2 h-4 w-4", isFavorite && "fill-red-500 text-red-500")} />
          {isFavorite ? "Favorited" : "Favorite"}
        </Button>

        <Button
          type="button"
          variant="outline"
          size={compact ? "sm" : "default"}
          disabled={saving}
          className="rounded-2xl"
          onClick={() =>
            patch(
              { completed_at: isCompleted ? null : new Date().toISOString() },
              isCompleted ? "Marked as not completed" : "Marked as completed",
            )
          }
        >
          <CheckCircle className={cn("mr-2 h-4 w-4", isCompleted && "text-green-500")} />
          {isCompleted ? "Completed" : "Mark completed"}
        </Button>

        <Button
          type="button"
          variant="outline"
          size={compact ? "sm" : "default"}
          className="rounded-2xl"
          onClick={() => setScheduleOpen(true)}
        >
          <CalendarPlus className="mr-2 h-4 w-4" />
          Schedule
        </Button>

        <div className="flex items-center gap-1" aria-label="Your private rating">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              disabled={saving}
              aria-label={`Rate ${value} out of 5`}
              onClick={() =>
                patch(
                  {
                    rating: rating === value ? null : value,
                    rated_at: rating === value ? null : new Date().toISOString(),
                  },
                  rating === value ? "Rating removed" : "Rating saved (private)",
                )
              }
              className="p-0.5"
            >
              <Star
                className={cn(
                  "h-5 w-5 transition",
                  value <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40",
                )}
              />
            </button>
          ))}
        </div>
      </div>

      {!compact && (
        <p className="mt-2 text-xs text-muted-foreground">
          Your rating stays private — your own workouts are never shared, commented on, or listed in
          the community pages.
        </p>
      )}

      <ScheduleWorkoutDialog
        isOpen={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        contentId={workout.id}
        contentName={workout.name}
        contentType="custom_workout"
        contentRouteType="custom"
        onScheduled={onScheduled}
      />
    </>
  );
};
