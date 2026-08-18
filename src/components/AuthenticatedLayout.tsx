import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { useAutoLogout } from "@/hooks/useAutoLogout";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { OfflineBanner } from "@/components/OfflineBanner";
import { restoreCachedSessionOffline, setCurrentUserId } from "@/lib/offline";

const SESSION_CACHE_KEY = 'smartygym_cached_session';

export const AuthenticatedLayout = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { isOnline, isOffline } = useNetworkStatus();
  
  // Enable automatic logout on inactivity (30 min) and browser close
  useAutoLogout();

  // Cache session to localStorage for offline access
  const cacheSession = (session: Session | null) => {
    if (session) {
      try {
        localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify({
          user: session.user,
          cachedAt: Date.now()
        }));
      } catch (e) {
        console.error('Failed to cache session:', e);
      }
    }
  };

  // Get cached session from localStorage
  const getCachedSession = (): { user: User; cachedAt: number } | null => {
    try {
      const cached = localStorage.getItem(SESSION_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        // Cache valid for 30 days
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
        if (Date.now() - parsed.cachedAt < thirtyDays) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to get cached session:', e);
    }
    return null;
  };

  // Clear cached session
  const clearCachedSession = () => {
    try {
      localStorage.removeItem(SESSION_CACHE_KEY);
    } catch (e) {
      console.error('Failed to clear cached session:', e);
    }
  };

  useEffect(() => {
    // Check if user is authenticated
    const checkAuth = async () => {
      // If offline, try to use cached session
      if (isOffline) {
        const cached = getCachedSession();
        if (cached) {
          setCurrentUserId(cached.user.id);
          setUser(cached.user);
          setLoading(false);
          return;
        }
        // Fall back to the IndexedDB-cached Supabase session.
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
        clearCachedSession();
        navigate("/auth");
        return;
      }

      // Cache the session for offline use
      cacheSession(session);
      setCurrentUserId(session.user.id);
      setUser(session.user);
      setLoading(false);
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        clearCachedSession();
        if (isOnline) {
          navigate("/auth");
        }
      } else {
        cacheSession(session);
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
            cacheSession(session);
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
            cacheSession(session);
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