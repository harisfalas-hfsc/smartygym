import { cn } from "@/lib/utils";
import { useFreeAccessMode } from "@/hooks/useFreeAccessMode";

interface PaymentsDisabledNoticeProps {
  className?: string;
  compact?: boolean;
}

/**
 * Shown in place of any purchase CTA when purchasing is switched off
 * for the current platform (Admin → Payments).
 */
export const PaymentsDisabledNotice = ({ className, compact }: PaymentsDisabledNoticeProps) => {
  const { freeAccessMode, loading } = useFreeAccessMode();

  // Global Free Access Mode: never point anywhere external to buy.
  if (loading || freeAccessMode) return null;

  return (
    <div
      className={cn(
        "w-full rounded-lg border border-primary/30 bg-primary/5 text-left",
        compact ? "p-3" : "p-4",
        className
      )}
    >
      <p className={cn("font-semibold text-foreground", compact ? "text-xs" : "text-sm")}>
        In-app purchases are not available.
      </p>
      <p className={cn("mt-1 text-muted-foreground", compact ? "text-xs" : "text-xs sm:text-sm")}>
        Memberships, workouts and training programs are purchased on our website. Visit{" "}
        <span className="text-primary font-semibold">smartygym.com</span> from any computer to
        subscribe or buy, then sign in here with the same account and your access appears
        automatically.
      </p>
    </div>
  );
};