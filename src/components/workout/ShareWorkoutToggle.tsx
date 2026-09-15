import { useState } from "react";
import { Share2, Loader2, Globe, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ShareWorkoutToggleProps {
  workout: {
    id: string;
    name: string;
    category: string;
    format?: string | null;
    difficulty_stars?: number | null;
    is_shared?: boolean | null;
    image_url?: string | null;
  };
  compact?: boolean;
  onChanged?: () => void;
}

/**
 * Lets a member publish their own workout to the community (Shared Workouts)
 * or take it back private again. A cover image is generated on first share so
 * the workout looks like every other card in the library.
 */
export function ShareWorkoutToggle({ workout, compact, onChanged }: ShareWorkoutToggleProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [shared, setShared] = useState(!!workout.is_shared);

  // Shared workouts all use the single Shared Workouts picture, so no picture
  // is created here.



  const share = async () => {
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("not signed in");

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();

      const firstName = (profile?.full_name ?? "").trim().split(/\s+/)[0] || "A member";

      const { error } = await supabase
        .from("user_custom_workouts")
        .update({
          is_shared: true,
          shared_at: new Date().toISOString(),
          shared_by_name: firstName,
        })
        .eq("id", workout.id);
      if (error) throw error;

      setShared(true);
      onChanged?.();
      toast({
        title: "Shared with the community",
        description: "Premium members can now find it in Shared Workouts.",
      });
      void generateCover();
    } catch {
      toast({
        title: "Could not share this workout",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  };

  const unshare = async () => {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("user_custom_workouts")
        .update({ is_shared: false, shared_at: null })
        .eq("id", workout.id);
      if (error) throw error;
      setShared(false);
      onChanged?.();
      toast({ title: "Back to private", description: "Only you can see this workout again." });
    } catch {
      toast({ title: "Could not update this workout", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant={shared ? "secondary" : "outline"}
        size={compact ? "sm" : "default"}
        className="rounded-2xl"
        disabled={busy}
        onClick={() => (shared ? void unshare() : setConfirmOpen(true))}
      >
        {busy ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : shared ? (
          <Globe className="mr-2 h-4 w-4" />
        ) : (
          <Share2 className="mr-2 h-4 w-4" />
        )}
        {shared ? "Shared — make private" : "Share with community"}
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-primary" />
              Share this workout with the community?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-left text-sm">
                <p>Active premium members will find it in Shared Workouts.</p>
                <p>Your first name is shown as the author.</p>
                <p>It is never sold — no price, no purchase, ever.</p>
                <p className="flex items-center gap-2 font-semibold text-foreground">
                  <Lock className="h-4 w-4" /> You can make it private again at any time.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl">Cancel</AlertDialogCancel>
            <AlertDialogAction className="rounded-2xl" onClick={(e) => { e.preventDefault(); void share(); }}>
              Share it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
