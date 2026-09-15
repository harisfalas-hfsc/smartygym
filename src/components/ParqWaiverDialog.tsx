import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface ParqWaiverDialogProps {
  open: boolean;
  flags: string[];
  /** "missing" = no PAR-Q on file, "flagged" = completed with a YES answer. */
  reason?: "missing" | "flagged" | "none";
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Waiver / release of liability shown every session to a member whose PAR-Q
 * health assessment has a YES answer, before they open or execute a workout,
 * a training program or a workout they created themselves.
 */
export function ParqWaiverDialog({
  open,
  flags,
  reason = "flagged",
  confirmLabel = "I confirm — continue",
  onConfirm,
  onCancel,
}: ParqWaiverDialogProps) {
  const [checked, setChecked] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setChecked(false);
          onCancel();
        }
      }}
    >
      <DialogContent className="mx-auto max-h-[80vh] w-[calc(100%-2.5rem)] max-w-md space-y-4 overflow-y-auto rounded-3xl border-2 border-destructive p-5 sm:p-6">
        <DialogTitle className="flex items-center gap-2 text-base font-extrabold uppercase tracking-[0.14em] text-destructive">
          <AlertTriangle className="h-5 w-5" /> Health warning
        </DialogTitle>

        {reason === "missing" ? (
          <p className="text-sm text-muted-foreground">
            You have not completed your health assessment (PAR-Q) yet. We strongly recommend
            completing it before you train, so we know it is safe for you.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Your health assessment (PAR-Q) has a YES answer:
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {flags.map((flag) => (
                <li key={flag}>{flag}</li>
              ))}
            </ul>
          </>
        )}

        <p className="text-sm text-muted-foreground">
          SmartyGym is not a doctor. We strongly suggest you speak to your physician before
          training. By continuing you train entirely at your own responsibility and release
          SmartyGym from any liability for injury or health issues arising from this training.
        </p>

        <label className="flex items-start gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 h-5 w-5 accent-[hsl(var(--destructive))]"
          />
          <span>
            I confirm I train at my own responsibility and accept this waiver and release of
            liability.
          </span>
        </label>

        <div className="grid gap-2">
          <Button
            className="h-12 rounded-2xl font-extrabold"
            disabled={!checked}
            onClick={() => {
              setChecked(false);
              onConfirm();
            }}
          >
            {confirmLabel}
          </Button>
          <Button asChild variant="secondary" className="h-11 rounded-2xl">
            <Link to="/userdashboard?tab=account">
              {reason === "missing" ? "Complete my PAR-Q now" : "Update my PAR-Q answers"}
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
