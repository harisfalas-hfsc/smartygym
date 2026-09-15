import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SharedWorkoutRow {
  id: string;
  user_id: string;
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
  image_url: string | null;
  shared_by_name: string | null;
  shared_at: string | null;
  created_at: string;
}

const SHARED_COLUMNS =
  "id,user_id,name,category,format,focus,difficulty_stars,difficulty_label,duration_label,duration_min,equipment,location,description_html,image_url,shared_by_name,shared_at,created_at";

/** Every workout a member has shared with the community, newest first. */
export function useSharedWorkouts() {
  return useQuery({
    queryKey: ["shared-workouts-live"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_custom_workouts")
        .select(SHARED_COLUMNS)
        .eq("is_shared", true)
        .order("shared_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SharedWorkoutRow[];
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
  });
}

/** Count of shared workouts — used for the category card badge. */
export function useSharedWorkoutCount() {
  return useQuery({
    queryKey: ["shared-workouts-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("user_custom_workouts")
        .select("id", { count: "exact", head: true })
        .eq("is_shared", true);
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });
}
