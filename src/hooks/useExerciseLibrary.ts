import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { offlineQueryFn } from "@/lib/offline";
import { findBestMatch, normalizeExerciseName, MatchResult } from "@/utils/exerciseMatching";

export interface Exercise {
  id: string;
  name: string;
  body_part: string;
  equipment: string;
  target: string;
  secondary_muscles: string[];
  instructions: string[];
  gif_url: string | null;
  description: string | null;
  difficulty: string | null;
  category: string | null;
}

interface ExerciseBasic {
  id: string;
  name: string;
  body_part: string;
  equipment: string;
  target: string;
}

const BATCH_SIZE = 1000;

/**
 * Fetch all exercises from the database with pagination
 */
const fetchAllExercises = async (): Promise<ExerciseBasic[]> => {
  const allExercises: ExerciseBasic[] = [];
  let offset = 0;
  let hasMore = true;
  
  while (hasMore) {
    const { data, error } = await supabase
      .from('exercises')
      .select('id, name, body_part, equipment, target')
      .range(offset, offset + BATCH_SIZE - 1)
      .order('name');
    
    if (error) {
      console.error('Error fetching exercises:', error);
      throw error;
    }
    
    if (data && data.length > 0) {
      allExercises.push(...data);
      offset += BATCH_SIZE;
      hasMore = data.length === BATCH_SIZE;
    } else {
      hasMore = false;
    }
  }
  
  return allExercises;
};

/**
 * Fetch full exercise details by ID
 */
const fetchExerciseById = async (id: string): Promise<Exercise | null> => {
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    console.error('Error fetching exercise:', error);
    return null;
  }
  
  return data;
};

/**
 * Hook to get all exercises for matching
 */
export const useExerciseLibrary = () => {
  const { data: exercises = [], isLoading, error } = useQuery({
    queryKey: ['exercise-library-all'],
    queryFn: offlineQueryFn("library:list:exercises", fetchAllExercises),
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  });
  
  /**
   * Search exercises by name (simple filter)
   */
  const searchExercises = (query: string, limit: number = 20): ExerciseBasic[] => {
    if (!query || query.length < 2) return [];
    
    const queryNorm = normalizeExerciseName(query);
    
    return exercises
      .filter(ex => {
        const nameNorm = normalizeExerciseName(ex.name);
        return nameNorm.includes(queryNorm) || queryNorm.includes(nameNorm);
      })
      .slice(0, limit);
  };
  
  /**
   * Find matching exercise using fuzzy matching
   */
  const findMatchingExercise = (name: string, threshold: number = 0.75): MatchResult | null => {
    if (!exercises.length) return null;
    return findBestMatch(name, exercises, threshold);
  };
  
  /**
   * Get exercise by ID with full details
   */
  const getExerciseById = async (id: string): Promise<Exercise | null> => {
    return fetchExerciseById(id);
  };
  
  return {
    exercises,
    isLoading,
    error,
    searchExercises,
    findMatchingExercise,
    getExerciseById,
  };
};

/**
 * Hook to fetch full exercise details
 */
export const useExerciseDetails = (exerciseId: string | null) => {
  return useQuery({
    queryKey: ['exercise-details', exerciseId],
    queryFn: offlineQueryFn(`library:exercise:${exerciseId}`, async () => (exerciseId ? fetchExerciseById(exerciseId) : null)),
    enabled: !!exerciseId,
    staleTime: 30 * 60 * 1000,
  });
};
