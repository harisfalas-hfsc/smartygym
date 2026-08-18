import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { fetchFreeAccessMode } from "@/hooks/useFreeAccessMode";
import { readOffline, saveOffline, setCurrentUserId } from "@/lib/offline";

const ENTITLEMENT_KEY = "entitlements:snapshot";

interface EntitlementSnapshot {
  userTier: UserTier;
  productId: string | null;
  purchasedContent: string[];
}

export type UserTier = "guest" | "subscriber" | "premium";

interface AccessControlState {
  user: User | null;
  userTier: UserTier;
  isLoading: boolean;
  productId: string | null;
  purchasedContent: Set<string>;
}

interface AccessControlContextType extends AccessControlState {
  canAccessContent: (contentType: string, contentId?: string) => boolean;
  canInteract: (contentType: string, contentId?: string) => boolean;
  hasPurchased: (contentId: string, contentType: string) => boolean;
  refreshAccess: () => Promise<void>;
}

const AccessControlContext = createContext<AccessControlContextType | undefined>(undefined);

export const AccessControlProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AccessControlState>({
    user: null,
    userTier: "guest",
    isLoading: true,
    productId: null,
    purchasedContent: new Set(),
  });

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let mounted = true;
    
    const init = async () => {
      // Set timeout for loading check with better UX
      timeoutId = setTimeout(() => {
        if (mounted) {
          setState(prev => {
            if (prev.isLoading) {
              console.warn("Access control check timed out after 5s - defaulting to guest");
              return { 
                user: null,
                userTier: "guest",
                isLoading: false,
                productId: null,
                purchasedContent: new Set(),
              };
            }
            return prev;
          });
        }
      }, 5000);
      
      await checkAccess();
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;
        
        if (session?.user) {
          // Defer Supabase calls to prevent deadlock
          setTimeout(() => {
            if (mounted) {
              checkSubscription(session.user);
            }
          }, 0);
        } else {
          setState({
            user: null,
            userTier: "guest",
            isLoading: false,
            productId: null,
            purchasedContent: new Set(),
          });
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []);

  const checkAccess = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        // Offline with a cached session? keep the member signed in read-only.
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          const { restoreCachedSessionOffline } = await import("@/lib/offline");
          const restored = await restoreCachedSessionOffline();
          if (restored?.user) {
            setCurrentUserId(restored.user.id);
            await checkSubscription(restored.user);
            return;
          }
        }
        setState({
          user: null,
          userTier: "guest",
          isLoading: false,
          productId: null,
          purchasedContent: new Set(),
        });
        return;
      }

      await checkSubscription(session.user);
    } catch (error) {
      console.error("Error checking access:", error);
      setState({
        user: null,
        userTier: "guest",
        isLoading: false,
        productId: null,
        purchasedContent: new Set(),
      });
    }
  };

  const checkSubscription = async (user: User) => {
    setCurrentUserId(user.id);

    // OFFLINE: reuse the exact entitlement level captured on this device the
    // last time we were online. Never elevate, never downgrade.
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const snap = await readOffline<EntitlementSnapshot>(ENTITLEMENT_KEY, user.id);
      setState({
        user,
        userTier: snap?.data.userTier ?? "guest",
        isLoading: false,
        productId: snap?.data.productId ?? null,
        purchasedContent: new Set(snap?.data.purchasedContent ?? []),
      });
      return;
    }

    try {
      setState(prev => ({ ...prev, isLoading: true }));
      
      let { data: dbData, error: dbError } = await supabase
        .from('user_subscriptions')
        .select('plan_type, status, current_period_end, stripe_subscription_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (dbError && dbError.code !== 'PGRST116') {
        console.error("Database subscription error:", dbError);
      }

      // If no subscription record exists or it's free, trigger Stripe sync
      // This ensures users returning from checkout get their subscription synced immediately
      if (!dbData || dbData.plan_type === 'free') {
        try {
          const { data: syncResult, error: syncError } = await supabase.functions.invoke('check-subscription');
          if (!syncError && syncResult?.subscribed) {
            // Re-read the database after sync
            const { data: refreshedData } = await supabase
              .from('user_subscriptions')
              .select('plan_type, status, current_period_end, stripe_subscription_id')
              .eq('user_id', user.id)
              .maybeSingle();
            if (refreshedData) {
              dbData = refreshedData;
            }
          }
        } catch (syncErr) {
          // Sync failure is non-critical, continue with existing data
          console.warn("Stripe sync failed (non-critical):", syncErr);
        }
      }

      // Fetch purchased content (only valid, non-deleted content)
      const { data: purchases } = await supabase
        .from('user_purchases')
        .select('content_id, content_type')
        .eq('user_id', user.id)
        .eq('content_deleted', false);

      const purchasedContent = new Set(
        purchases?.map(p => `${p.content_type}:${p.content_id}`) || []
      );

      // Check if user is an admin (admins bypass all access locks)
      const { data: adminRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      
      const isAdmin = !!adminRole;

      // Check if user is a corporate admin (has active corporate subscription)
      const { data: corpAdmin } = await supabase
        .from('corporate_subscriptions')
        .select('id, plan_type, status')
        .eq('admin_user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      // Check if user is a corporate member (added by a corporate admin)
      const { data: corpMember } = await supabase
        .from('corporate_members')
        .select('id, corporate_subscription_id')
        .eq('user_id', user.id)
        .maybeSingle();

      // Verify corporate member's subscription is still active
      let isCorporateMemberActive = false;
      if (corpMember) {
        const { data: corpSubStatus } = await supabase
          .from('corporate_subscriptions')
          .select('status')
          .eq('id', corpMember.corporate_subscription_id)
          .eq('status', 'active')
          .maybeSingle();
        isCorporateMemberActive = !!corpSubStatus;
      }

      // User is premium if they have:
      // 1. An active Lifetime / Premium / legacy_premium subscription, OR
      // 2. Active corporate admin subscription, OR
      // 3. Active corporate member status, OR
      // 4. Admin role (admins bypass all access locks)
      const isPersonalPremium = dbData?.status === 'active' &&
                         ['lifetime', 'premium', 'legacy_premium'].includes(dbData?.plan_type ?? '');
      const isCorporatePremium = !!corpAdmin || isCorporateMemberActive;
      // Global Free Access Mode (Admin → Payments): every signed-in user is premium.
      const freeAccessMode = await fetchFreeAccessMode();
      const isPremium = isPersonalPremium || isCorporatePremium || isAdmin || freeAccessMode;

      const userTier: UserTier = isPremium ? "premium" : "subscriber";
      const productId = dbData?.plan_type || (isCorporatePremium ? 'corporate' : null);

      setState({ user, userTier, isLoading: false, productId, purchasedContent });

      // Persist the resolved entitlement for offline sessions.
      void saveOffline<EntitlementSnapshot>(
        ENTITLEMENT_KEY,
        { userTier, productId, purchasedContent: [...purchasedContent] },
        user.id,
      );
    } catch (error) {
      console.error("Error checking subscription:", error);
      setState({
        user,
        // SECURITY: Fail closed to "guest" on error — never grant elevated access on failure
        userTier: "guest",
        isLoading: false,
        productId: null,
        purchasedContent: new Set(),
      });
    }
  };

  const canAccessContent = (contentType: string, contentId?: string): boolean => {
    const { userTier, purchasedContent } = state;

    // Public content accessible to all
    if (contentType === "exercise-library" || contentType === "blog" || contentType === "article" || contentType === "calculator" || contentType === "tool") {
      return true;
    }

    // Guests can only access public content
    if (userTier === "guest") {
      return false;
    }

    // Check if content was individually purchased.
    // Purchases are stored with normalized type ("workout" / "program"), so
    // strip the "free-" prefix before looking up.
    const normalizedType = contentType.replace(/^free-/, "");
    if (contentId && purchasedContent.has(`${normalizedType}:${contentId}`)) {
      return true;
    }

    // Premium users can access everything
    if (userTier === "premium") {
      return true;
    }

    // Subscribers can access free content, tools, and dashboard
    // NOTE: For workouts and programs, this returns true to let the page render,
    // but the *real* is_premium check is enforced server-side by RLS and at the
    // component level by <AccessGate>, which calls hasPurchased() and verifies
    // the database is_premium flag. Do not rely on this function alone for gating.
    if (userTier === "subscriber") {
      return contentType === "tool" || 
             contentType === "calculator" ||
             contentType === "dashboard" ||
             contentType === "workout" ||
             contentType === "program";
    }

    return false;
  };

  const hasPurchased = (contentId: string, contentType: string): boolean => {
    // Normalize "free-workout" / "free-program" to the stored purchase type.
    const normalizedType = contentType.replace(/^free-/, "");
    return state.purchasedContent.has(`${normalizedType}:${contentId}`);
  };

  const canInteract = (contentType: string, contentId?: string): boolean => {
    const { userTier, purchasedContent } = state;

    // Guests can't interact with anything
    if (userTier === "guest") return false;

    // Premium users can interact with ALL content (free and premium)
    if (userTier === "premium") return true;

    // Check if user purchased this specific content (normalize free- prefix).
    const normalizedType = contentType.replace(/^free-/, "");
    if (contentId && purchasedContent.has(`${normalizedType}:${contentId}`)) {
      return true;
    }

    // Subscribers can only interact with free content
    if (userTier === "subscriber") {
      return contentType === "free-workout" || contentType === "free-program";
    }

    return false;
  };

  return (
    <AccessControlContext.Provider value={{
      ...state,
      canAccessContent,
      canInteract,
      hasPurchased,
      refreshAccess: checkAccess,
    }}>
      {children}
    </AccessControlContext.Provider>
  );
};

export const useAccessControl = () => {
  const context = useContext(AccessControlContext);
  if (context === undefined) {
    throw new Error("useAccessControl must be used within AccessControlProvider");
  }
  return context;
};
