import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAccessControl } from "@/hooks/useAccessControl";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, X } from "lucide-react";
import popupImg from "@/assets/popup-free-trial-bright.jpg";
import { useFreeAccessMode } from "@/hooks/useFreeAccessMode";

const REPEAT_DELAY_MS = 60 * 60 * 1000;
const DEFAULT_INITIAL_DELAY_MS = 10_000;
const DISMISS_KEY = "free-trial-popup-dismissed-until";

// Routes where the popup must NEVER appear (functional / auth / checkout flows)
const BLOCKED_ROUTE_PREFIXES = [
  "/auth",
  "/reset-password",
  "/userdashboard",
  "/dashboard",
  "/calculator-history",
  "/admin",
  "/payment",
  "/checkout",
  "/unsubscribe",
  "/newsletter-thank-you",
  "/corporate-admin",
];

export function FreeTrialPopup() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [hasSubscriptionHistory, setHasSubscriptionHistory] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userTier, isLoading } = useAccessControl();

  const isAboutPage = ["/about", "/takeatour", "/take-a-tour"].includes(location.pathname);
  const isCriticalContentRoute = ["/", "/home", "/workout", "/workout/wod"].includes(location.pathname);
  const isBlockedRoute = BLOCKED_ROUTE_PREFIXES.some(p => location.pathname.startsWith(p));
  const initialDelay = isAboutPage ? 0 : DEFAULT_INITIAL_DELAY_MS;

  // Hydrate dismissal from sessionStorage so it doesn't reappear during the same visit
  useEffect(() => {
    try {
      const until = sessionStorage.getItem(DISMISS_KEY);
      if (until && Number(until) > Date.now()) {
        setDismissed(true);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!user || userTier !== "subscriber") {
      setHasSubscriptionHistory(null);
      return;
    }
    const check = async () => {
      const { data } = await supabase
        .from("user_subscriptions")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      setHasSubscriptionHistory(!!data);
    };
    check();
  }, [user, userTier]);

  const shouldShowPopup = useCallback((): boolean => {
    if (isLoading) return false;
    if (isBlockedRoute) return false;
    if (isCriticalContentRoute) return false;
    if (!user) return true;
    if (userTier === "premium") return false;
    if (userTier === "subscriber" && hasSubscriptionHistory === false) return true;
    return false;
  }, [user, userTier, isLoading, hasSubscriptionHistory, isCriticalContentRoute, isBlockedRoute]);

  const triggerPopup = useCallback(() => {
    if (shouldShowPopup()) setShow(true);
  }, [shouldShowPopup]);

  useEffect(() => {
    if (dismissed || isLoading) return;
    if (!shouldShowPopup()) return;
    const timer = setTimeout(triggerPopup, initialDelay);
    return () => clearTimeout(timer);
  }, [dismissed, triggerPopup, initialDelay, isLoading, shouldShowPopup]);

  useEffect(() => {
    if (!dismissed) return;
    const timer = setTimeout(() => setDismissed(false), REPEAT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [dismissed]);

  const { freeAccessMode } = useFreeAccessMode();

  const handleDismiss = () => {
    setShow(false);
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, String(Date.now() + REPEAT_DELAY_MS));
    } catch {}
  };

  if (freeAccessMode) return null;

  if (!isLoading && user && (userTier === "premium" || hasSubscriptionHistory === true)) {
    return null;
  }

  const handleCTA = () => {
    handleDismiss();
    if (user) {
      navigate("/smarty-premium");
    } else {
      navigate("/auth?mode=signup&trial=true");
    }
  };

  return (
    <Dialog open={show} onOpenChange={(open) => { if (!open) handleDismiss(); }}>
      <DialogContent className="p-0 border-0 overflow-hidden max-w-sm w-[95vw] sm:w-full rounded-xl bg-card border-2 border-primary/40 shadow-2xl [&>button]:hidden">
        <div className="flex flex-col">
          {/* Bright image section */}
          <div className="relative h-32 overflow-hidden">
            <img
              src={popupImg}
              alt="Premium fitness experience"
              className="w-full h-full object-cover"
              loading="eager"
            />
            <button
              onClick={handleDismiss}
              className="absolute top-3 right-3 z-20 p-1.5 rounded-full bg-background/80 hover:bg-background text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content section */}
          <div className="flex flex-col p-4">
            <div className="mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-bold uppercase tracking-wider">
                <Crown className="w-3.5 h-3.5" /> 3-Day Free Trial
              </span>
            </div>

            <h2 className="text-xl font-bold text-foreground leading-tight mb-2">
              Try Premium Free<br />for 3 Days
            </h2>

            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              Get unlimited access to all workouts, training programs, and premium tools. No charge for 3 days — cancel anytime.
            </p>

            <div className="flex items-center gap-3 mb-3">
              <p className="text-xs font-medium text-emerald-500 flex items-center gap-1.5">
                <span className="inline-flex w-4 h-4 rounded-full bg-emerald-500/20 items-center justify-center text-emerald-500">✓</span>
                Cancel anytime
              </p>
              <p className="text-xs font-medium text-emerald-500 flex items-center gap-1.5">
                <span className="inline-flex w-4 h-4 rounded-full bg-emerald-500/20 items-center justify-center text-emerald-500">✓</span>
                No commitment
              </p>
            </div>

            <Button
              size="lg"
              className="w-full text-sm gap-2 h-11 font-bold shadow-lg shadow-primary/30"
              onClick={handleCTA}
              data-track-cta="free-trial-popup"
            >
              <Crown className="w-4 h-4" />
              Start Your Free Trial
            </Button>

            <button
              onClick={handleDismiss}
              className="mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
            >
              No thanks, I'll pass
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
