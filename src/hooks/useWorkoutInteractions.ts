import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { offlineQueryFn } from "@/lib/offline";

export const useWorkoutInteractions = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["workout-interactions", userId],
    queryFn: offlineQueryFn("favorites:workout-interactions", async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from("workout_interactions")
        .select("*")
        .eq("user_id", userId);

      if (error) {
        console.error("Error fetching workout interactions:", error);
        return [];
      }

      return data || [];
    }),
    enabled: !!userId,
  });
};
