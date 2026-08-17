import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isAndroidDevice, isIOSDevice } from "@/utils/platform";
import { fetchFreeAccessMode } from "@/hooks/useFreeAccessMode";

export type PaymentPlatform = "ios" | "android" | "web";

export const getPaymentPlatform = (): PaymentPlatform => {
  try {
    if (isIOSDevice()) return "ios";
    if (isAndroidDevice()) return "android";
    return "web";
  } catch {
    return "web";
  }
};

const SETTING_KEYS: Record<PaymentPlatform, string | null> = {
  ios: "payments_enabled_ios",
  android: "payments_enabled_android",
  web: null, // web always sells
};

/**
 * Reads the per-platform purchase kill switch from system_settings.
 * When disabled, purchase CTAs must be replaced with <PaymentsDisabledNotice />.
 */
export const usePaymentsEnabled = () => {
  const platform = getPaymentPlatform();
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const key = SETTING_KEYS[platform];
    let cancelled = false;
    (async () => {
      // Global Free Access Mode is the master switch: it forces every
      // platform (web included) into "no purchases" state.
      const freeMode = await fetchFreeAccessMode();
      if (cancelled) return;
      if (freeMode) {
        setEnabled(false);
        setLoading(false);
        return;
      }

      if (!key) {
        setEnabled(true);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("system_settings")
        .select("setting_value")
        .eq("setting_key", key)
        .maybeSingle();

      if (cancelled) return;
      // Fail CLOSED on mobile: a missing row or a failed read blocks purchasing.
      const value = data?.setting_value;
      setEnabled(!error && (value === true || value === "true"));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [platform]);

  return { platform, paymentsEnabled: enabled, loading };
};