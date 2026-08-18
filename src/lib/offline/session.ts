// Tracks the current user id synchronously so offline reads can be scoped
// without awaiting Supabase on every query.
import { supabase } from "@/integrations/supabase/client";

let currentUserId: string | null = null;
let initialised = false;

export const getCurrentUserId = () => currentUserId;

export const setCurrentUserId = (id: string | null) => {
  currentUserId = id;
};

export const initOfflineSessionTracking = () => {
  if (initialised) return;
  initialised = true;

  try {
    const raw = localStorage.getItem("smartygym_offline_user_id");
    if (raw) currentUserId = raw;
  } catch {
    // ignore
  }

  void supabase.auth.getSession().then(({ data }) => {
    currentUserId = data.session?.user.id ?? currentUserId;
    persist();
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user?.id) {
      currentUserId = session.user.id;
      persist();
    }
  });
};

const persist = () => {
  try {
    if (currentUserId) localStorage.setItem("smartygym_offline_user_id", currentUserId);
  } catch {
    // ignore
  }
};
