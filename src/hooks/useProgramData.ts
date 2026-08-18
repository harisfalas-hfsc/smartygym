import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { offlineQueryFn } from "@/lib/offline";

export const useProgramData = (programId: string | undefined) => {
  return useQuery({
    queryKey: ["program", programId],
    queryFn: offlineQueryFn(`detail:program:${programId}`, async () => {
      if (!programId) return null;
      
      const { data, error } = await supabase
        .from("admin_training_programs")
        .select("*")
        .eq("id", programId)
        .maybeSingle();

      if (error) {
        if (import.meta.env.DEV) {
          console.error("Error fetching program:", error);
        }
        return null;
      }

      if (!data) {
        const { data: metadata, error: metadataError } = await (supabase as any)
          .rpc("get_visible_program_metadata", { _program_id: programId });

        if (metadataError) {
          if (import.meta.env.DEV) {
            console.error("Error fetching program metadata:", metadataError);
          }
          return null;
        }

        return Array.isArray(metadata) ? metadata[0] || null : metadata;
      }

      return data;
    }),
    enabled: !!programId,
  });
};

export const useAllPrograms = () => {
  return useQuery({
    queryKey: ["all-programs"],
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: offlineQueryFn("programs:list:all", async () => {
      const { data, error } = await supabase
        .rpc("get_visible_program_metadata" as never, { _program_id: null } as never);

      if (import.meta.env.DEV) {
        console.log("📦 Programs data:", data);
        console.log("❌ Programs error:", error);
      }

      if (error) {
        if (import.meta.env.DEV) {
          console.error("Error fetching programs:", error);
        }
        return [];
      }

      return (data || []).sort((a: any, b: any) => a.name.localeCompare(b.name));
    }),
  });
};
