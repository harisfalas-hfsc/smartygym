import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { offlineQueryFn } from "@/lib/offline";
import { getCyprusTodayStr } from "@/lib/cyprusDate";
import type { WorkoutData } from "@/hooks/useWorkoutData";

const todayWodCache = new Map<string, WorkoutData[]>();

export const normalizeWodEquipment = (equipment?: string | null) => {
  const value = (equipment || "").trim().toUpperCase();

  if (["BODYWEIGHT", "NO EQUIPMENT", "NONE", "HOME"].includes(value)) return "BODYWEIGHT";
  if (["EQUIPMENT", "WITH EQUIPMENT", "GYM"].includes(value)) return "EQUIPMENT";
  if (["VARIOUS", "MIXED", "MIXED/MINIMAL", "MINIMAL"].includes(value)) return "VARIOUS";

  return value;
};

export const fetchVisibleWorkoutMetadata = async (workoutId: string | null = null) => {
  const { data, error } = await (supabase as any)
    .rpc("get_visible_workout_metadata", { _workout_id: workoutId });

  if (error) throw error;
  return (data || []) as WorkoutData[];
};

export const useTodayWods = (enabled = true) => {
  const cyprusToday = getCyprusTodayStr();

  const query = useQuery({
    queryKey: ["today-wods", cyprusToday],
    queryFn: offlineQueryFn(`wod:today:${cyprusToday}`, async () => {
      const workouts = await fetchVisibleWorkoutMetadata(null);
      const todayWods = workouts.filter(
        (wod) => wod.is_workout_of_day === true && wod.generated_for_date === cyprusToday
      );
      if (todayWods.length > 0) {
        todayWodCache.set(cyprusToday, todayWods);
      }
      return todayWods;
    }),
    enabled,
    staleTime: 1000 * 60 * 5,
    retry: 2,
    placeholderData: () => todayWodCache.get(cyprusToday),
    refetchOnWindowFocus: false,
  });

  const normalized = useMemo(() => {
    const cachedTodayWods = todayWodCache.get(cyprusToday) || [];
    const allTodayWods = query.data && query.data.length > 0
      ? query.data
      : cachedTodayWods;
    const bodyweightWod = allTodayWods.find((wod) => normalizeWodEquipment(wod.equipment) === "BODYWEIGHT");
    const equipmentWod = allTodayWods.find((wod) => normalizeWodEquipment(wod.equipment) === "EQUIPMENT");
    const variousWod = allTodayWods.find((wod) => normalizeWodEquipment(wod.equipment) === "VARIOUS");
    const isRecoveryDay = !!variousWod && !bodyweightWod && !equipmentWod;

    return {
      allTodayWods,
      bodyweightWod,
      equipmentWod,
      variousWod,
      isRecoveryDay,
      hasWods: allTodayWods.length > 0,
    };
  }, [query.data]);

  return {
    ...query,
    isLoading: query.isLoading && !todayWodCache.has(cyprusToday),
    cyprusToday,
    ...normalized,
  };
};