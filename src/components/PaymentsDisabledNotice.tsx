import { cn } from "@/lib/utils";
import { getPaymentPlatform } from "@/hooks/usePaymentsEnabled";

interface PaymentsDisabledNoticeProps {
  className?: string;
  compact?: boolean;
}

/**
 * Shown in place of any purchase CTA when purchasing is switched off
 * for the current platform (Admin → Payments).
 */
export const PaymentsDisabledNotice = ({ className, compact }: PaymentsDisabledNoticeProps) => {
  const platform = getPaymentPlatform();
  const isIOS = platform === "ios";

  return (
    <div
      className={cn(
        "w-full text-center rounded border text-muted-foreground",
        compact ? "p-2 text-xs" : "p-3 text-xs sm:text-sm",
        className
      )}
    >
      {isIOS ? (
        <>Purchases are not available on iPhone right now. Please use a desktop or Android device to upgrade.</>
      ) : (
        <>
          Purchases are managed on our website. Visit{" "}
          <span className="text-primary font-semibold">smartygym.com</span> to upgrade.
        </>
      )}
    </div>
  );
};