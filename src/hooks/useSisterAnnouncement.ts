import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const SISTER_ANNOUNCEMENT_SETTING_KEY = "sister_announcement_enabled";

let cached: boolean | null = null;
let inflight: Promise<boolean> | null = null;
const listeners = new Set<(v: boolean) => void>();

/**
 * Admin → Announcement: master switch for the sister-apps popup.
 * Fails OPEN is NOT desired here — on read errors we keep it hidden only if
 * explicitly disabled; default (no row / error) is enabled.
 */
export const fetchSisterAnnouncementEnabled = async (force = false): Promise<boolean> => {
  if (!force && cached !== null) return cached;
  if (!force && inflight) return inflight;

  inflight = (async () => {
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("setting_value")
        .eq("setting_key", SISTER_ANNOUNCEMENT_SETTING_KEY)
        .maybeSingle();
      const value = data?.setting_value as unknown;
      cached = error ? true : !(value === false || value === "false");
    } catch {
      cached = true;
    }
    listeners.forEach((l) => l(cached!));
    inflight = null;
    return cached!;
  })();

  return inflight;
};

export const setSisterAnnouncementCache = (value: boolean) => {
  cached = value;
  listeners.forEach((l) => l(value));
};

export const useSisterAnnouncement = () => {
  const [enabled, setEnabled] = useState<boolean>(cached ?? false);
  const [loading, setLoading] = useState(cached === null);

  useEffect(() => {
    let mounted = true;
    const listener = (v: boolean) => {
      if (mounted) setEnabled(v);
    };
    listeners.add(listener);

    fetchSisterAnnouncementEnabled().then((v) => {
      if (!mounted) return;
      setEnabled(v);
      setLoading(false);
    });

    return () => {
      mounted = false;
      listeners.delete(listener);
    };
  }, []);

  return { enabled, loading };
};
