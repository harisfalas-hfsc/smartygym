import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarCheck, Clock, Dumbbell, Star, Crown, ShoppingBag, Archive, Home, TrendingUp, Layers, Target } from "lucide-react";
import { useTodayWods } from "@/hooks/useTodayWods";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { SwipeToExplore } from "@/components/ui/SwipeToExplore";
import { cn } from "@/lib/utils";
import { useFreeAccessMode } from "@/hooks/useFreeAccessMode";

export const WorkoutOfTheDay = () => {
  const navigate = useNavigate();
  const { freeAccessMode } = useFreeAccessMode();
  const [wodCarouselApi, setWodCarouselApi] = useState<CarouselApi>();
  const [currentWodSlide, setCurrentWodSlide] = useState(0);

  const { bodyweightWod: bodyweightWOD, equipmentWod: equipmentWOD, variousWod: variousWOD, isRecoveryDay, hasWods: hasWODs, isLoading } = useTodayWods();

  // Mobile-only: let users swipe between the two daily WOD cards.
  useEffect(() => {
    if (!wodCarouselApi) return;
    const onSelect = () => setCurrentWodSlide(wodCarouselApi.selectedScrollSnap());
    onSelect();
    wodCarouselApi.on("select", onSelect);
    return () => {
      wodCarouselApi.off("select", onSelect);
    };
  }, [wodCarouselApi]);

  const getDifficultyColor = (stars: number | null) => {
    if (!stars) return "bg-gray-500/20 text-gray-600 border-gray-500/40";
    if (stars <= 2) return "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/40"; // Beginner = YELLOW
    if (stars <= 4) return "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/40"; // Intermediate = GREEN
    return "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/40"; // Advanced = RED
  };

  const renderStars = (count: number | null) => {
    if (!count) return null;
    return (
      <span className="flex items-center gap-0.5">
        {Array.from({ length: count }).map((_, i) => (
          <Star key={i} className="w-3 h-3 fill-current" />
        ))}
      </span>
    );
  };

  const getCategoryColor = (cat: string) => {
    const lower = cat.toLowerCase();
    if (lower.includes("strength")) return "bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/40";
    if (lower.includes("cardio")) return "bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/40";
    if (lower.includes("mobility")) return "bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-500/40";
    if (lower.includes("challenge")) return "bg-pink-500/20 text-pink-700 dark:text-pink-400 border-pink-500/40";
    if (lower.includes("stability")) return "bg-teal-500/20 text-teal-700 dark:text-teal-400 border-teal-500/40";
    if (lower.includes("metabolic")) return "bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/40";
    if (lower.includes("recovery")) return "bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 border-cyan-500/40";
    return "bg-muted text-muted-foreground border-border";
  };

  // Render card for regular WODs (BODYWEIGHT/EQUIPMENT)
  const renderMiniCard = (wod: typeof bodyweightWOD, isBodyweight: boolean, compact: boolean = false) => {
    if (!wod) return null;
    
    const equipmentIcon = isBodyweight ? <Home className="w-3 h-3" /> : <Dumbbell className="w-3 h-3" />;
    const bgColor = isBodyweight ? "bg-blue-500" : "bg-orange-500";

    return (
      <div 
        className={cn("bg-background/80 backdrop-blur-sm rounded-lg border border-primary/30 cursor-pointer hover:border-primary/60 transition-all", compact ? "p-2" : "p-3")}
        onClick={() => navigate(`/workout/wod/${wod.id}`)}
      >
        {wod.image_url && (
          <div className={cn("relative w-full rounded-md overflow-hidden mb-2", compact ? "h-14" : "h-20")}>
            <img src={wod.image_url} alt={`${wod.name || "Workout"} - ${wod.format || ''} ${wod.category || ''} workout - ${wod.difficulty_stars}★ ${wod.difficulty || ''} - ${wod.duration || ''} - by Sports Scientist Haris Falas - SmartyGym SmartGym Smart Gym smartygym.com`} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <Badge className={`absolute top-2 left-2 ${bgColor} text-white border-0 text-xs py-0.5`}>
              {equipmentIcon}
              <span className="ml-1">{isBodyweight ? "Home" : "Gym"}</span>
            </Badge>
          </div>
        )}
        <h4 className="text-sm font-bold text-foreground line-clamp-1 mb-1">{wod.name}</h4>
        <div className="flex flex-nowrap items-center gap-x-1.5 text-[10px] mb-1.5 overflow-hidden">
          {wod.category && (
            <>
              <div className="flex items-center gap-1 min-w-0">
                <Layers className="w-2.5 h-2.5 text-primary shrink-0" />
                <span className={`font-medium whitespace-nowrap ${getCategoryColor(wod.category).split(' ')[1]}`}>{wod.category}</span>
              </div>
              <span className="text-muted-foreground shrink-0">•</span>
            </>
          )}
          <div className="flex items-center gap-1 min-w-0">
            <Target className="w-2.5 h-2.5 text-primary shrink-0" />
            <span className="text-blue-600 dark:text-blue-400 font-medium whitespace-nowrap">{wod.format || "General"}</span>
          </div>
          <span className="text-muted-foreground shrink-0">•</span>
          <div className="flex items-center gap-1 shrink-0">
            <TrendingUp className="w-2.5 h-2.5 text-primary shrink-0" />
            <span className="text-muted-foreground whitespace-nowrap">
              {wod.difficulty_stars && wod.difficulty_stars > 0 
                ? `${wod.difficulty_stars}⭐` 
                : "All Levels"}
            </span>
          </div>
          <span className="text-muted-foreground shrink-0">•</span>
          <div className="flex items-center gap-1 shrink-0">
            <Clock className="w-2.5 h-2.5 text-primary shrink-0" />
            <span className="text-muted-foreground whitespace-nowrap">{wod.duration || "45-60 min"}</span>
          </div>
        </div>
        {!freeAccessMode && (
        <div className="flex flex-wrap items-center gap-1">
          <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-0 text-xs py-0">
            <Crown className="w-2.5 h-2.5 mr-0.5" />
            Premium
          </Badge>
          <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 text-xs py-0">
            <ShoppingBag className="w-2.5 h-2.5 mr-0.5" />
            €{wod.price?.toFixed(2)}
          </Badge>
        </div>
        )}
      </div>
    );
  };

  // Render card for Recovery day WOD (VARIOUS equipment)
  const renderRecoveryCard = (wod: typeof variousWOD) => {
    if (!wod) return null;
    
    return (
      <div 
        className="w-full bg-background/80 backdrop-blur-sm rounded-lg p-4 border border-cyan-500/40 cursor-pointer hover:border-cyan-500/60 transition-all"
        onClick={() => navigate(`/workout/wod/${wod.id}`)}
      >
        {wod.image_url && (
          <div className="relative w-full h-32 rounded-md overflow-hidden mb-3">
            <img src={wod.image_url} alt={`${wod.name || "Recovery"} - online workout by Haris Falas at SmartyGym SmartGym Smart Gym smartygym.com`} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </div>
        )}
        <h4 className="text-base font-bold leading-tight text-foreground mb-2 line-clamp-2 min-h-[2.5rem]">{wod.name}</h4>
        <div className="flex flex-wrap items-center gap-2 text-xs mb-2">
          <Badge variant="outline" className="bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 border-cyan-500/40">
            {wod.category}
          </Badge>
          {wod.format && (
            <Badge variant="outline" className="bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/40">
              {wod.format}
            </Badge>
          )}
          <Badge variant="outline" className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/40">
            All Levels
          </Badge>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="w-3 h-3" />
            {wod.duration || "30-45 min"}
          </div>
        </div>
        {!freeAccessMode && (
        <div className="flex flex-wrap items-center gap-1">
          <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-0 text-xs py-0">
            <Crown className="w-2.5 h-2.5 mr-0.5" />
            Premium
          </Badge>
          <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 text-xs py-0">
            <ShoppingBag className="w-2.5 h-2.5 mr-0.5" />
            €{wod.price?.toFixed(2)}
          </Badge>
        </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card className="mb-8 bg-gradient-to-br from-primary/10 via-background to-primary/10 border-2 border-primary/50 shadow-primary overflow-hidden">
        <div className="p-4 sm:p-6">
          <div className="flex flex-col items-center gap-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
            <div className="grid grid-cols-2 gap-4 w-full max-w-lg">
              <Skeleton className="h-40 w-full rounded-lg" />
              <Skeleton className="h-40 w-full rounded-lg" />
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mb-8 bg-gradient-to-br from-primary/10 via-background to-primary/10 border-2 border-primary/50 shadow-primary overflow-hidden">
      <div className="p-3 sm:p-6">
        {/* Icon Container */}
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <CalendarCheck className="w-8 h-8 text-primary" />
          </div>
          
          {/* Title */}
          <h2 className="text-lg sm:text-xl font-bold text-primary mb-3">
            Workout of the Day
          </h2>
          
          {/* Description - changes based on recovery day or not */}
          <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl mx-auto mb-4">
            {isRecoveryDay ? (
              <>Today is <span className="text-cyan-500 font-semibold">Recovery Day</span> — focus on restoration with a dedicated recovery session.</>
            ) : (
              <>Every day, <span className="text-primary font-semibold">SmartyGym</span> delivers <strong>TWO</strong> fresh workouts — one with equipment, one without. Choose based on where you are!</>
            )}
          </p>
        </div>

        {/* Shared Info (Category, Format, Difficulty) - for non-recovery days */}
        {hasWODs && !isRecoveryDay && (bodyweightWOD || equipmentWOD) && (
          <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
            <Badge variant="outline" className="bg-primary/20 text-primary border-primary/40">
              {(bodyweightWOD || equipmentWOD)?.category}
            </Badge>
            {(bodyweightWOD || equipmentWOD)?.format && (
              <Badge variant="outline" className="bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/40">
                {(bodyweightWOD || equipmentWOD)?.format}
              </Badge>
            )}
            <Badge variant="outline" className={getDifficultyColor((bodyweightWOD || equipmentWOD)?.difficulty_stars || null)}>
              {(bodyweightWOD || equipmentWOD)?.difficulty} {renderStars((bodyweightWOD || equipmentWOD)?.difficulty_stars || null)}
            </Badge>
          </div>
        )}

        {/* WOD Cards - Recovery day shows 1 card, training days show 2 */}
        {hasWODs ? (
          isRecoveryDay ? (
            <div className="mb-4">
              {renderRecoveryCard(variousWOD)}
            </div>
          ) : (
            <>
              <div className="sm:hidden max-w-xl mx-auto mb-4 -mx-4">
                <SwipeToExplore onPrev={() => wodCarouselApi?.scrollPrev()} onNext={() => wodCarouselApi?.scrollNext()} />
                <Carousel className="w-full" opts={{ align: "center", loop: false }} setApi={setWodCarouselApi}>
                  <CarouselContent className="-ml-3">
                    {bodyweightWOD && (
                      <CarouselItem className="pl-3 basis-[82%]">
                        {renderMiniCard(bodyweightWOD, true, true)}
                      </CarouselItem>
                    )}
                    {equipmentWOD && (
                      <CarouselItem className="pl-3 basis-[82%]">
                        {renderMiniCard(equipmentWOD, false, true)}
                      </CarouselItem>
                    )}
                  </CarouselContent>
                </Carousel>
                {bodyweightWOD && equipmentWOD && (
                  <div className="flex justify-center items-center gap-2 mt-3 pb-1">
                    {[0, 1].map((index) => (
                      <button
                        key={index}
                        onClick={() => wodCarouselApi?.scrollTo(index)}
                        className={cn(
                          "rounded-full transition-all duration-300",
                          currentWodSlide === index
                            ? "w-3 h-3 bg-primary shadow-[0_0_8px_hsl(var(--primary))]"
                            : "w-2.5 h-2.5 bg-primary/40 hover:bg-primary/70"
                        )}
                        aria-label={`Go to ${index === 0 ? "Home" : "Gym"} workout`}
                      />
                    ))}
                  </div>
                )}
              </div>
              <div className="hidden sm:grid sm:grid-cols-2 gap-3 max-w-xl mx-auto mb-4">
                {renderMiniCard(bodyweightWOD, true)}
                {renderMiniCard(equipmentWOD, false)}
              </div>
            </>
          )
        ) : (
          <div className="bg-background/80 backdrop-blur-sm rounded-xl p-6 border-2 border-dashed border-primary/30 max-w-md mx-auto text-center mb-4">
            <Clock className="w-12 h-12 text-primary/50 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-foreground mb-1">
              Today's Workouts are Being Prepared
            </h3>
            <p className="text-sm text-muted-foreground">
              Check back <span className="text-primary font-semibold">soon</span> for your fresh Workouts of the Day!
            </p>
          </div>
        )}

        {/* View All Button */}
        <div className="flex justify-center mb-2">
          <Button onClick={() => navigate("/workout/wod")} className="cta-button">
            View Today's Workouts
          </Button>
        </div>

        {/* Link to Archive */}
        <div className="text-center">
          <Button variant="link" onClick={() => navigate("/wod-archive")} className="text-muted-foreground hover:text-primary text-sm">
            <Archive className="w-4 h-4 mr-2" />
            Browse Past WODs
          </Button>
        </div>
      </div>
    </Card>
  );
};
