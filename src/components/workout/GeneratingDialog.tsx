import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const FITNESS_TIPS = [
  "Strength gains come from progressive overload — a little more load, reps or quality each week beats random hard sessions.",
  "Two to three minutes of rest between heavy compound sets is not lazy; it is what lets you lift well on the next set.",
  "Muscle grows from tension and control. A slower lowering phase often does more than adding weight.",
  "Warming up is not stretching. Prepare the exact joints and patterns you are about to load.",
  "Soreness is not a measure of a good workout. Performance over weeks is.",
  "Sleep is the strongest recovery tool available — most adaptation happens while you rest.",
  "Hydration affects strength and endurance long before you feel thirsty.",
  "In conditioning work, a pace you can repeat for every round beats a first round you cannot match.",
  "Consistency beats intensity: three solid sessions every week outperform one heroic one.",
  "Core strength is about resisting movement — bracing and anti-rotation, not endless crunches.",
  "Mobility work pays off best when done often and briefly, not once in a long painful session.",
  "Protein spread across the day supports recovery better than one large serving.",
  "If technique breaks down, the set is finished — quality reps are the ones that count.",
  "Cool downs lower heart rate gradually and help you feel ready for the next session.",
  "Deload weeks are part of training, not a break from it.",
];

/**
 * Shown while Smarty Coach builds a workout (questionnaire, Surprise me or the
 * Workout of the Day). Same behaviour and wording as the sister app: a clear
 * wait message, rotating tips and a "stay on this screen" reminder.
 */
export function GeneratingDialog({ open, onLeave }: { open: boolean; onLeave?: () => void }) {
  const [tipIndex, setTipIndex] = useState(0);
  const [handOff, setHandOff] = useState(false);
  const [waitRound, setWaitRound] = useState(0);

  useEffect(() => {
    if (!open) return;
    setTipIndex(Math.floor(Math.random() * FITNESS_TIPS.length));
    const id = setInterval(() => {
      setTipIndex((i) => (i + 1) % FITNESS_TIPS.length);
    }, 7000);
    return () => clearInterval(id);
  }, [open]);

  // After 90 seconds the athlete is never trapped — the build continues on the
  // server and, if anything goes wrong, the recovery system delivers it.
  useEffect(() => {
    if (!open) {
      setHandOff(false);
      setWaitRound(0);
      return;
    }
    const id = setTimeout(() => setHandOff(true), 90000);
    return () => clearTimeout(id);
  }, [open, waitRound]);

  return (
    <Dialog open={open}>
      <DialogContent
        className="max-w-md border-2 border-primary [&>button]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Building your workout</DialogTitle>
        <div className="p-2 text-center text-muted-foreground">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-primary" />
          <p className="font-medium text-foreground">
            {handOff
              ? "Still building — leave it with us."
              : "Building your workout… this can take up to 2 minutes."}
          </p>
          <div
            className="mx-auto mt-6 max-w-md rounded-md border border-border bg-muted/40 p-4 text-left"
            aria-live="polite"
          >
            <p className="text-xs font-bold uppercase text-primary">Did you know?</p>
            <p className="mt-1 min-h-12 text-sm leading-6 text-foreground">
              {FITNESS_TIPS[tipIndex]}
            </p>
          </div>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            {handOff
              ? "You can close this and carry on — your workout finishes on the server and lands in your logbook. We will email you the moment it is ready."
              : "Stay on this screen — your workout will appear automatically when it is ready."}
          </p>
          {handOff ? (
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={onLeave}>
                Leave it with us
              </Button>
              <Button type="button" className="h-11 rounded-xl" onClick={() => {
                  setHandOff(false);
                  setWaitRound((n) => n + 1);
                }}>
                Keep waiting
              </Button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default GeneratingDialog;
