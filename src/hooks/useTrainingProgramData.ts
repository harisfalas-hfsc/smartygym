import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { offlineQueryFn } from "@/lib/offline";
import { buildUniqueContentSlugs, slugifyContentName } from "@/lib/seo-slugs";

export interface TrainingProgramData {
  id: string;
  canonical_slug?: string | null;
  category: string;
  name: string;
  difficulty: string | null;
  difficulty_stars: number | null;
  weeks: number | null;
  days_per_week: number | null;
  equipment: string | null;
  image_url: string | null;
  description: string | null;
  overview: string | null;
  weekly_schedule: string | null;
  program_structure: string | null;
  progression_plan: string | null;
  expected_results: string | null;
  nutrition_tips: string | null;
  target_audience: string | null;
  is_premium: boolean | null;
  is_standalone_purchase: boolean | null;
  price: number | null;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  duration: string | null;
}

export const useTrainingProgramData = (programId: string | undefined) => {
  return useQuery({
    queryKey: ["training-program", programId],
    queryFn: offlineQueryFn(`detail:training-program:${programId}`, async () => {
      if (!programId) throw new Error("Program ID is required");
      const resolveFromMetadata = async () => {
        const { data: metadata, error: metadataError } = await supabase
          .rpc("get_visible_program_metadata", { _program_id: null });

        if (metadataError) throw metadataError;
        const programs = (Array.isArray(metadata) ? metadata : []) as TrainingProgramData[];
        const uniqueSlugs = buildUniqueContentSlugs(programs);
        const program = programs.find(
          (program: TrainingProgramData) =>
            program.id === programId ||
            slugifyContentName(program.name || program.id) === programId ||
            uniqueSlugs.get(program.id) === programId,
        );
        return program ? { ...program, canonical_slug: uniqueSlugs.get(program.id) || slugifyContentName(program.name || program.id) } : undefined;
      };

      const metadataMatch = await resolveFromMetadata();
      if (metadataMatch) {
        // The metadata RPC strips content fields (overview, schedule, etc.) for premium
        // programs. Always try to fetch the FULL row directly — RLS grants it to
        // admins, premium users, and purchasers. Fall back to metadata if denied.
        const { data: fullRow, error: fullError } = await supabase
          .from("admin_training_programs")
          .select("*")
          .eq("id", metadataMatch.id)
          .maybeSingle();

        if (!fullError && fullRow) {
          return { ...fullRow, canonical_slug: metadataMatch.canonical_slug } as TrainingProgramData;
        }
        return metadataMatch as TrainingProgramData;
      }

      const { data, error } = await supabase
        .from("admin_training_programs")
        .select("*")
        .eq("id", programId)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Training program not found");

      return { ...data, canonical_slug: slugifyContentName(data.name || data.id) } as TrainingProgramData;
    }),
    enabled: !!programId,
  });
};
