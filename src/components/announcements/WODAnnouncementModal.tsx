import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarCheck, Clock, Dumbbell, Home, Crown, ShoppingBag, X, TrendingUp, Layers, Target } from "lucide-react";
import { useTodayWods } from "@/hooks/useTodayWods";
import { useFreeAccessMode } from "@/hooks/useFreeAccessMode";

interface WODAnnouncementModalProps {
  open: boolean;
  onClose: (dontShowAgain?: boolean) => void;
}

export const WODAnnouncementModal = ({ open, onClose }: WODAnnouncementModalProps) => {
  const navigate = useNavigate();
  const { freeAccessMode } = useFreeAccessMode();
  const [countdown, setCountdown] = useState(15);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const { allTodayWods: wods, bodyweightWod: bodyweightWOD, equipmentWod: equipmentWOD, hasWods: hasWODs, isRecoveryDay, isLoading } = useTodayWods(open);

  // Countdown timer - auto close after 15 seconds
  useEffect(() => {
    if (!open) {
      setCountdown(15);
      setDontShowAgain(false);
      return;
    }

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onClose(dontShowAgain);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [open, onClose, dontShowAgain]);

  const handleClose = () => {
    onClose(dontShowAgain);
  };

  const handleCardClick = (workoutId: string) => {
    onClose();
    navigate(`/workout/wod/${workoutId}`);
  };

  const getCategoryColor = (cat: string) => {
    const lower = cat.toLowerCase();
    if (lower.includes("strength")) return "text-orange-700 dark:text-orange-400";
    if (lower.includes("cardio")) return "text-blue-700 dark:text-blue-400";
    if (lower.includes("mobility")) return "text-purple-700 dark:text-purple-400";
    if (lower.includes("challenge")) return "text-pink-700 dark:text-pink-400";
    if (lower.includes("stability")) return "text-teal-700 dark:text-teal-400";
    if (lower.includes("metabolic")) return "text-amber-700 dark:text-amber-400";
    if (lower.includes("pilates")) return "text-rose-700 dark:text-rose-400";
    return "text-muted-foreground";
  };

  const renderWODCard = (wod: typeof bodyweightWOD, isBodyweight: boolean) => {
    if (!wod) return null;
    
    const bgColor = isBodyweight ? "bg-blue-500" : "bg-orange-500";
    const EquipIcon = isBodyweight ? Home : Dumbbell;

    return (
      <div 
        className="bg-background/90 backdrop-blur-sm rounded-xl p-3 border border-primary/40 cursor-pointer hover:border-primary hover:scale-[1.02] transition-all shadow-md group"
        onClick={() => handleCardClick(wod.id)}
      >
        {/* Image */}
        {wod.image_url && (
          <div className="relative w-full h-24 rounded-lg overflow-hidden mb-2">
            <img 
              src={wod.image_url} 
              alt={`${wod.name || "Workout"} - ${wod.format || ''} ${wod.category || ''} workout - ${wod.difficulty_stars}★ - ${wod.duration || ''} - by Sports Scientist Haris Falas - SmartyGym.com`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <Badge className={`absolute top-2 left-2 ${bgColor} text-white border-0 text-xs`}>
              <EquipIcon className="w-3 h-3 mr-1" />
              {isBodyweight ? "No Equipment" : "With Equipment"}
            </Badge>
          </div>
        )}

        {/* Title */}
        <h4 className="text-sm font-bold text-foreground line-clamp-1 mb-1.5 group-hover:text-primary transition-colors">
          {wod.name}
        </h4>

        {/* Info Row: Category + Focus + Difficulty + Duration */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] mb-2">
          {wod.category && (
            <>
              <div className="flex items-center gap-1">
                <Layers className="w-2.5 h-2.5 text-primary" />
                <span className={`font-medium ${getCategoryColor(wod.category)}`}>{wod.category}</span>
              </div>
              <span className="text-muted-foreground">•</span>
            </>
          )}
          <div className="flex items-center gap-1">
            <Target className="w-2.5 h-2.5 text-primary" />
            <span className="text-blue-600 dark:text-blue-400 font-medium">{wod.focus || wod.format || "General"}</span>
          </div>
          <span className="text-muted-foreground">•</span>
          <div className="flex items-center gap-1">
            <TrendingUp className="w-2.5 h-2.5 text-primary" />
            <span className="text-muted-foreground">{wod.difficulty_stars}⭐</span>
          </div>
          <span className="text-muted-foreground">•</span>
          <div className="flex items-center gap-1">
            <Clock className="w-2.5 h-2.5 text-primary" />
            <span className="text-muted-foreground">{wod.duration || "45 min"}</span>
          </div>
        </div>

        {/* Badges */}
        {!freeAccessMode && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-0 text-xs">
            <Crown className="w-3 h-3 mr-1" />
            Premium
          </Badge>
          <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 text-xs">
            <ShoppingBag className="w-3 h-3 mr-1" />
            €{wod.price?.toFixed(2)}
          </Badge>
        </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-lg w-[95vw] sm:w-full max-h-[90vh] border-2 border-primary/60 bg-gradient-to-br from-primary/5 via-background to-primary/5 shadow-[0_0_40px_rgba(212,175,55,0.15)] p-0 gap-0 animate-scale-in overflow-hidden [&>button]:hidden">
        <DialogTitle className="sr-only">Workout of the Day announcement</DialogTitle>
        <DialogDescription className="sr-only">Today's available Workout of the Day sessions.</DialogDescription>
        {/* Header */}
        <div className="relative p-4 pb-2">
          {/* Close button */}
          <button 
            onClick={handleClose}
            className="absolute right-3 top-3 p-1.5 rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>

          {/* Countdown Badge */}
          <div className="absolute left-3 top-3">
            <Badge variant="outline" className="bg-background/80 border-primary/40 text-xs font-mono">
              {countdown}s
            </Badge>
          </div>

          {/* Icon & Title */}
          <div className="flex flex-col items-center text-center pt-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-3 animate-pulse">
              <CalendarCheck className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-1">
              🔥 {isRecoveryDay ? "Fresh Recovery Workout Just Dropped!" : "Fresh Workouts Just Dropped!"}
            </h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              {isRecoveryDay ? (
                <>Today is recovery day. Take care of your body with a guided recovery session designed by <span className="text-primary font-semibold">SmartyGym</span>.</>
              ) : (
                <>Every day, <span className="text-primary font-semibold">SmartyGym</span> delivers <strong>TWO</strong> fresh workouts — pick one based on your mood, convenience, or training preference!</>
              )}
            </p>
          </div>
        </div>

        {/* WOD Cards or Fallback */}
        <div className="px-4 pb-4 max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : hasWODs ? (
            <div className={isRecoveryDay ? "flex justify-center mb-4" : "grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4"}>
              {isRecoveryDay ? (
                <div className="w-full sm:w-1/2">{renderWODCard(wods![0], wods![0]?.equipment === "BODYWEIGHT")}</div>
              ) : (
                <>
                  {renderWODCard(bodyweightWOD, true)}
                  {renderWODCard(equipmentWOD, false)}
                </>
              )}
            </div>
          ) : (
            <div className="text-center py-6 mb-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <CalendarCheck className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Today's Workouts Are Being Prepared!
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Our fitness experts are crafting today's WODs. Browse our workout library in the meantime!
              </p>
            </div>
          )}

          {/* CTA Button */}
          <Button 
            onClick={() => { handleClose(); navigate("/workout/wod"); }}
            className="w-full cta-button"
          >
            <CalendarCheck className="w-4 h-4 mr-2" />
            {hasWODs ? (isRecoveryDay ? "View Today's Workout" : "View All Today's Workouts") : "Browse Workouts"}
          </Button>

          {/* Don't show again checkbox */}
          <div className="flex items-center gap-2 justify-center mt-3 pt-3 border-t border-primary/20">
            <Checkbox 
              id="dont-show-wod" 
              checked={dontShowAgain}
              onCheckedChange={(checked) => setDontShowAgain(checked === true)}
              className="border-primary/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
            <label htmlFor="dont-show-wod" className="text-xs text-muted-foreground cursor-pointer">
              Don't show again today
            </label>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
