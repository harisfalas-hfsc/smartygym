import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const FREE_ACCESS_SETTING_KEY = "free_access_mode";

let cached: boolean | null = null;
let inflight: Promise<boolean> | null = null;
const listeners = new Set<(v: boolean) => void>();

/**
 * Global "Free Access Mode" (Admin → Payments).
 * When ON: every signed-in user is treated as premium and all purchase,
 * pricing and external-purchase references are hidden (App Store submission).
 * Fails CLOSED (mode off) on read errors, i.e. normal paid behaviour.
 */
export const fetchFreeAccessMode = async (force = false): Promise<boolean> => {
  if (!force && cached !== null) return cached;
  if (!force && inflight) return inflight;

  inflight = (async () => {
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("setting_value")
        .eq("setting_key", FREE_ACCESS_SETTING_KEY)
        .maybeSingle();
      const value = data?.setting_value;
      cached = !error && (value === true || (value as unknown) === "true");
    } catch {
      cached = false;
    }
    listeners.forEach((l) => l(cached!));
    inflight = null;
    return cached!;
  })();

  return inflight;
};

export const setFreeAccessModeCache = (value: boolean) => {
  cached = value;
  listeners.forEach((l) => l(value));
};

export const useFreeAccessMode = () => {
  const [freeAccessMode, setValue] = useState<boolean>(cached ?? false);
  const [loading, setLoading] = useState(cached === null);

  useEffect(() => {
    let mounted = true;
    const listener = (v: boolean) => {
      if (mounted) setValue(v);
    };
    listeners.add(listener);

    fetchFreeAccessMode().then((v) => {
      if (!mounted) return;
      setValue(v);
      setLoading(false);
    });

    return () => {
      mounted = false;
      listeners.delete(listener);
    };
  }, []);

  return { freeAccessMode, loading };
};
