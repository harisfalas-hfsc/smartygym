import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { useAutoLogout } from "@/hooks/useAutoLogout";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { OfflineBanner } from "@/components/OfflineBanner";
import { cacheSessionForOffline, restoreCachedSessionOffline, setCurrentUserId } from "@/lib/offline";

export const AuthenticatedLayout = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { isOnline, isOffline } = useNetworkStatus();
  
  // Enable automatic logout on inactivity (30 min) and browser close
  useAutoLogout();

  useEffect(() => {
    // Check if user is authenticated
    const checkAuth = async () => {
      // If offline, try to use cached session
      if (isOffline) {
        const restored = await restoreCachedSessionOffline();
        if (restored) {
          setCurrentUserId(restored.user.id);
          setUser(restored.user);
          setLoading(false);
          return;
        }
        // No cached session and offline - redirect to auth
        navigate("/auth");
        return;
      }

      // Online - check with Supabase
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      // Cache the session for offline use
      void cacheSessionForOffline(session);
      setCurrentUserId(session.user.id);
      setUser(session.user);
      setLoading(false);
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        if (isOnline) {
          navigate("/auth");
        }
      } else {
        void cacheSessionForOffline(session);
        setCurrentUserId(session.user.id);
        setUser(session.user);
      }
    });

    // Listen for session refresh messages from service worker (when notification clicked)
    if ('serviceWorker' in navigator) {
      const messageHandler = async (event: MessageEvent) => {
        if (event.data.type === 'REFRESH_SESSION') {
          console.log('Refreshing session from notification click');
          const { data: { session }, error } = await supabase.auth.refreshSession();
          if (session && !error) {
            void cacheSessionForOffline(session);
            console.log('Session refreshed successfully');
          }
        }
      };
      
      navigator.serviceWorker.addEventListener('message', messageHandler);
      
      // Check URL for refresh_session flag
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('refresh_session') === 'true') {
        supabase.auth.refreshSession().then(({ data: { session }, error }) => {
          if (session && !error) {
            void cacheSessionForOffline(session);
            console.log('Session refreshed from notification click');
          }
        });
        
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
      }
      
      return () => {
        navigator.serviceWorker.removeEventListener('message', messageHandler);
        subscription.unsubscribe();
      };
    }

    return () => subscription.unsubscribe();
  }, [navigate, isOnline, isOffline]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <OfflineBanner />
      <Outlet />
    </div>
  );
};