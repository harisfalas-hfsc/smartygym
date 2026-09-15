import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ParqWaiverDialog } from "@/components/ParqWaiverDialog";
import { useParqWaiver } from "@/hooks/useParqWaiver";

interface ParqWaiverGateProps {
  children: ReactNode;
  confirmLabel?: string;
}

/**
 * Blocks training content behind the PAR-Q health waiver when the member has
 * no PAR-Q assessment on file, or one with a YES answer. Once confirmed, the
 * waiver is not shown again for the rest of the session.
 */
export function ParqWaiverGate({ children, confirmLabel = "I confirm — continue" }: ParqWaiverGateProps) {
  const { flags, reason, blocked, dialogOpen, openDialog, closeDialog, confirm } = useParqWaiver();

  if (!blocked) return <>{children}</>;

  const missing = reason === "missing";

  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-xl font-extrabold uppercase tracking-tight text-destructive">
        Health warning
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {missing
          ? "You have not completed your PAR-Q health assessment. Complete it, or confirm the waiver to continue at your own responsibility."
          : "Your PAR-Q health assessment has a YES answer. Confirm the waiver to continue, or update your answers in your account settings."}
      </p>
      <div className="mt-4 grid gap-2">
        <Button className="h-12 rounded-2xl" onClick={openDialog}>
          Read and confirm
        </Button>
        <Button asChild variant="secondary" className="h-12 rounded-2xl">
          <Link to="/userdashboard?tab=account">
            {missing ? "Complete my PAR-Q now" : "Update my PAR-Q answers"}
          </Link>
        </Button>
      </div>

      <ParqWaiverDialog
        open={dialogOpen}
        flags={flags}
        reason={reason}
        confirmLabel={confirmLabel}
        onConfirm={confirm}
        onCancel={closeDialog}
      />
    </div>
  );
}
