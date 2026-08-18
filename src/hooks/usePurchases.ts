import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { offlineQueryFn } from "@/lib/offline";

interface Purchase {
  id: string;
  content_id: string;
  content_type: string;
  content_name: string;
  price: number;
  purchased_at: string;
  content_deleted?: boolean;
}

export const usePurchases = (userId: string | undefined) => {
  return useQuery({
    queryKey: ["purchases", userId],
    queryFn: offlineQueryFn("purchases:list", async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("user_purchases")
        .select("id, content_id, content_type, content_name, price, purchased_at, content_deleted")
        .eq("user_id", userId)
        .order("purchased_at", { ascending: false });

      if (error) {
        console.error("Error fetching purchases:", error);
        return [];
      }

      return data as Purchase[];
    }),
    enabled: !!userId,
  });
};
