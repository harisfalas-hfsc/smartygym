import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAccessControl } from "@/hooks/useAccessControl";
import { useNavigationHistory } from "@/contexts/NavigationHistoryContext";
import { useLocation, useNavigate } from "react-router-dom";
import { platformHeader } from "@/utils/platform";
import { usePaymentsEnabled } from "@/hooks/usePaymentsEnabled";
import { useFreeAccessMode } from "@/hooks/useFreeAccessMode";
import { PaymentsDisabledNotice } from "@/components/PaymentsDisabledNotice";
import { openExternal } from "@/utils/native";

interface PurchaseButtonProps {
  contentId: string;
  contentType: "workout" | "program";
  contentName: string;
  price: number;
  stripeProductId?: string | null;
  stripePriceId?: string | null;
}

export const PurchaseButton = ({
  contentId,
  contentType,
  contentName,
  price,
  stripeProductId,
  stripePriceId,
}: PurchaseButtonProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const { user, hasPurchased, userTier } = useAccessControl();
  const { history } = useNavigationHistory();
  const navigate = useNavigate();
  const location = useLocation();
  const { paymentsEnabled, loading: paymentsLoading } = usePaymentsEnabled();
  const { freeAccessMode, loading: freeAccessLoading } = useFreeAccessMode();

  // Check if already purchased
  const alreadyPurchased = hasPurchased(contentId, contentType);
  const currentPath = `${location.pathname}${location.search}`;

  const stripCheckoutReturn = (path: string) => {
    const [pathname, search = ""] = path.split("?");
    const normalizedPathname = pathname !== "/" ? pathname.replace(/\.html$/i, "") : pathname;
    if (!search) return normalizedPathname;

    const params = new URLSearchParams(search);
    params.delete("checkout_return");
    const nextSearch = params.toString();
    return nextSearch ? `${normalizedPathname}?${nextSearch}` : normalizedPathname;
  };

  const addCheckoutReturn = (path: string, returnPath: string) => {
    const [pathname, search = ""] = path.split("?");
    const params = new URLSearchParams(search);
    params.set("checkout_return", returnPath);
    return `${pathname}?${params.toString()}`;
  };

  const exactCheckoutReturnPath = stripCheckoutReturn(currentPath);
  const exactCheckoutReturnBasePath = exactCheckoutReturnPath.split("?")[0];
  const preCheckoutPath = [...history]
    .reverse()
    .map(stripCheckoutReturn)
    .find((path) => path !== exactCheckoutReturnPath && !path.startsWith(exactCheckoutReturnBasePath))
    || (contentType === "workout" ? "/workout" : "/trainingprogram");
  const checkoutCancelPath = addCheckoutReturn(exactCheckoutReturnPath, preCheckoutPath);
  
  // NEW: Check if user is premium (cannot purchase)
  const isPremium = userTier === "premium";

  const handlePurchase = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to purchase content.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    setIsProcessing(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("No active session");
      }

      const { data, error } = await supabase.functions.invoke(
        "create-individual-purchase-checkout",
        {
          body: {
            contentId,
            contentType,
            contentName,
            price,
            stripeProductId,
            stripePriceId,
            cancelPath: checkoutCancelPath,
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            ...platformHeader(),
          },
        }
      );

      if (error) throw error;

      if (data?.url) {
        await openExternal(data.url);
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error) {
      console.error("Purchase error:", error);
      toast({
        title: "Error",
        description: "Failed to initiate purchase. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Global Free Access Mode: no purchase UI at all.
  if (freeAccessLoading) return null;
  if (freeAccessMode) return null;

  // 🚨 CRITICAL: Premium users cannot purchase standalone content
  if (isPremium) {
    return (
      <Button disabled className="w-full" variant="outline">
        ✓ Included in Your Premium Plan
      </Button>
    );
  }

  if (alreadyPurchased) {
    return (
      <Button disabled className="w-full">
        Already Purchased
      </Button>
    );
  }

  // Platform purchase kill switch (Admin → Payments)
  if (paymentsLoading) return null;
  if (!paymentsEnabled) {
    return <PaymentsDisabledNotice />;
  }

  return (
    <Button
      onClick={handlePurchase}
      disabled={isProcessing}
      className="w-full"
      size="lg"
    >
      {isProcessing ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Processing...
        </>
      ) : (
        <>
          <ShoppingCart className="mr-2 h-4 w-4" />
          Purchase for €{price.toFixed(2)}
        </>
      )}
    </Button>
  );
};
