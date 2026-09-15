import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RitualAnnouncementModal } from "./RitualAnnouncementModal";
import { ParQReminderModal } from "./ParQReminderModal";
import { getCyprusTodayStr } from "@/lib/cyprusDate";
import { fetchVisibleWorkoutMetadata } from "@/hooks/useTodayWods";

// Delay for PAR-Q popup after first sign-in (30 seconds)
const PARQ_POPUP_DELAY_MS = 30 * 1000;

// Key to track if this is user's first session ever
const FIRST_SIGNIN_KEY = "smartygym_first_signin_completed";
const PARQ_REMINDER_SHOWN_KEY = "smartygym_parq_reminder_shown";
// Key to track if user was EVER authenticated (prevents false triggers)
const USER_AUTHENTICATED_KEY = "smartygym_user_authenticated";

/**
 * Close any open Radix overlays (DropdownMenu, Popover, Tooltip) so an
 * announcement modal doesn't open on top of a stuck Login/Sign-Up dropdown.
 * Radix listens for Escape on the document and closes the active overlay.
 */
const closeOpenOverlays = () => {
  try {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    // Also blur any focused trigger element so the dropdown doesn't reopen.
    (document.activeElement as HTMLElement | null)?.blur?.();
  } catch {
    /* no-op */
  }
};

export const AnnouncementManager = () => {
  const [showRitualModal, setShowRitualModal] = useState(false);
  const [showParQModal, setShowParQModal] = useState(false);
  const parqTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasStartedRef = useRef(false);

  const getTodayKey = (prefix: string) => {
    // Use Cyprus date for localStorage keys to ensure consistency
    const cyprusToday = getCyprusTodayStr();
    return `${prefix}_${cyprusToday}`;
  };

  // The PAR-Q reminder is no longer shown on launch. The health warning is
  // raised only when a member opens a workout or training program
  // (see ParqWaiverGate).

  // Trigger Ritual modal only when today's WODs are genuinely unavailable
  const triggerRitualModalIfNeeded = useCallback(async () => {
    const ritualShownKey = getTodayKey("ritual_announcement_shown");
    const ritualAlreadyShown = localStorage.getItem(ritualShownKey) === "true";
    const ritualDontShow = localStorage.getItem(getTodayKey("ritual_dont_show")) === "true";

    if (ritualAlreadyShown || ritualDontShow) {
      console.log("[AnnouncementManager] Ritual already shown or don't show - skipping");
      return;
    }

    const cyprusToday = getCyprusTodayStr();
    let workouts = [] as any[];
    try {
      workouts = await fetchVisibleWorkoutMetadata(null);
    } catch (error) {
      console.error("[AnnouncementManager] Could not verify WOD availability:", error);
      return;
    }

    const todaysWods = workouts.filter(
      (wod: any) => wod.is_workout_of_day === true && wod.generated_for_date === cyprusToday
    );

    if (todaysWods.length > 0) {
      console.log("[AnnouncementManager] Today's WODs available - skipping Ritual fallback");
      return;
    }

    console.log("[AnnouncementManager] Triggering Ritual modal (WOD was skipped/unavailable)");
    setTimeout(() => {
      closeOpenOverlays();
      setShowRitualModal(true);
    }, 2000); // Short delay when no WOD
  }, []);

  // Initialize on mount
  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    const init = async () => {
      // Small delay to let page render first
      await new Promise(resolve => setTimeout(resolve, 1000));
      triggerRitualModalIfNeeded();
    };

    init();
  }, [triggerRitualModalIfNeeded]);

  // Handle Ritual modal close
  const handleRitualClose = useCallback((dontShowAgain?: boolean) => {
    setShowRitualModal(false);
    
    // Mark Ritual modal as shown today (using Cyprus date)
    const ritualShownKey = getTodayKey("ritual_announcement_shown");
    localStorage.setItem(ritualShownKey, "true");
    
    if (dontShowAgain) {
      const ritualDontShowKey = getTodayKey("ritual_dont_show");
      localStorage.setItem(ritualDontShowKey, "true");
    }
  }, []);

  // Handle PAR-Q modal close
  const handleParQClose = useCallback((dontShowAgain?: boolean) => {
    setShowParQModal(false);
    
    // Always mark as shown (we only show once ever)
    localStorage.setItem(PARQ_REMINDER_SHOWN_KEY, new Date().toISOString());
    
    if (parqTimerRef.current) {
      clearTimeout(parqTimerRef.current);
      parqTimerRef.current = null;
    }
  }, []);

  return (
    <>
      <RitualAnnouncementModal 
        open={showRitualModal} 
        onClose={handleRitualClose} 
      />
      <ParQReminderModal
        open={showParQModal}
        onClose={handleParQClose}
      />
    </>
  );
};
