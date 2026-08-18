import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { restoreCachedSessionOffline, setCurrentUserId } from "@/lib/offline";
import { isReachable } from "@/lib/offline/connectivity";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      const { data } = await supabase.auth.getSession();
      let current = data.session;

      // Offline: fall back to the session cached on this device so saved
      // content stays reachable with no internet.
      // "Offline" also covers: network present but the backend unreachable.
      if (!current && (!isReachable() || (typeof navigator !== "undefined" && !navigator.onLine))) {
        current = await restoreCachedSessionOffline();
      }

      if (cancelled) return;
      if (current) setCurrentUserId(current.user.id);
      setSession(current);
      setLoading(false);
    };

    void resolve();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // Never bounce an authenticated member to /auth just because the
      // backend cannot be reached — only a real sign-out clears the session.
      if (!session && !isReachable()) return;
      if (session) setCurrentUserId(session.user.id);
      setSession(session);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  if (!session) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth?redirect=${redirect}`} replace />;
  }

  return <>{children}</>;
};
