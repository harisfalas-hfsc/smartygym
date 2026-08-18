import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchVisibleWorkoutMetadata } from "@/hooks/useTodayWods";
import { buildUniqueContentSlugs, slugifyContentName } from "@/lib/seo-slugs";
import { offlineQueryFn } from "@/lib/offline";

export interface WorkoutData {
  id: string;
  canonical_slug?: string | null;
  category: string;
  name: string;
  difficulty_stars: number | null;
  difficulty: string | null;
  equipment: string | null;
  duration: string | null;
  format: string | null;
  image_url: string | null;
  description: string | null;
  instructions: string | null;
  tips: string | null;
  is_premium: boolean | null;
  is_standalone_purchase: boolean | null;
  price: number | null;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  type: string;
  warm_up: string | null;
  main_workout: string | null;
  cool_down: string | null;
  activation: string | null;
  finisher: string | null;
  notes: string | null;
  focus: string | null;
  is_workout_of_day: boolean | null;
  generated_for_date: string | null;
  wod_source: string | null;
  created_at: string | null;
}

export const useWorkoutData = (workoutId: string | undefined) => {
  return useQuery({
    queryKey: ["workout", workoutId],
    queryFn: offlineQueryFn(`detail:workout:${workoutId}`, async () => {
      if (!workoutId) throw new Error("Workout ID is required");
      const resolveFromMetadata = async () => {
        const metadata = await fetchVisibleWorkoutMetadata(null);
        const uniqueSlugs = buildUniqueContentSlugs(metadata);
        const workout = metadata.find(
          (workout) =>
            workout.id === workoutId ||
            slugifyContentName(workout.name || workout.id) === workoutId ||
            uniqueSlugs.get(workout.id) === workoutId,
        );
        return workout ? { ...workout, canonical_slug: uniqueSlugs.get(workout.id) || slugifyContentName(workout.name || workout.id) } : undefined;
      };

      const metadataMatch = await resolveFromMetadata();
      // If metadata matched but section content is null (premium content hidden by RPC),
      // fall through to a direct table query — RLS will enforce access for entitled users.
      const hasFullContent =
        metadataMatch &&
        (metadataMatch.main_workout || metadataMatch.warm_up || metadataMatch.activation);
      if (metadataMatch && hasFullContent) return metadataMatch as WorkoutData;

      const resolvedId = metadataMatch?.id || workoutId;
      const { data, error } = await supabase
        .from("admin_workouts")
        .select("*")
        .eq("id", resolvedId)
        .neq("is_visible", false)
        .maybeSingle();

      if (error) {
        // If RLS blocked the direct fetch and we have metadata, return metadata so the
        // paywall renders correctly instead of a "not found" state.
        if (metadataMatch) return metadataMatch as WorkoutData;
        throw error;
      }
      if (!data) {
        if (metadataMatch) return metadataMatch as WorkoutData;
        throw new Error("Workout not found");
      }

      return {
        ...data,
        canonical_slug:
          (metadataMatch as any)?.canonical_slug || slugifyContentName(data.name || data.id),
      } as WorkoutData;
    }),
    enabled: !!workoutId,
    // Ensure detail pages always reflect latest backend content updates
    staleTime: 0,
    gcTime: 60 * 60 * 1000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
};

export const useAllWorkouts = () => {
  return useQuery({
    queryKey: ["all-workouts"],
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: offlineQueryFn("workouts:list:all", async () => {
      const data = await fetchVisibleWorkoutMetadata(null);
      return (data || []) as WorkoutData[];
    }),
  });
};
