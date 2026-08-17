import { useEffect, useState } from "react";
import { getDifficultyColorClasses } from "@/lib/wodCycle";
import { useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, Check, Heart, Crown, ShoppingCart, Clock, Dumbbell, Star, Home, TrendingUp, Brain, RefreshCw, Target, CheckCircle, Shield, Shuffle, Layers } from "lucide-react";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { ContentLoadingSkeleton } from "@/components/ContentLoadingSkeleton";
import { useAccessControl } from "@/hooks/useAccessControl";
import { useWorkoutInteractions } from "@/hooks/useWorkoutInteractions";
import { supabase } from "@/integrations/supabase/client";
import WODPeriodizationCalendar from "@/components/WODPeriodizationCalendar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";
import { useTodayWods } from "@/hooks/useTodayWods";
import { useFreeAccessMode } from "@/hooks/useFreeAccessMode";

const WODCategory = () => {
  const navigate = useNavigate();
  const { userTier, hasPurchased } = useAccessControl();
  const { freeAccessMode } = useFreeAccessMode();
  const [wodCarouselApi, setWodCarouselApi] = useState<CarouselApi>();
  const [wodCurrentSlide, setWodCurrentSlide] = useState(0);

  // Track WOD carousel slide changes
  useEffect(() => {
    if (!wodCarouselApi) return;
    
    const onSelect = () => {
      setWodCurrentSlide(wodCarouselApi.selectedScrollSnap());
    };
    
    wodCarouselApi.on('select', onSelect);
    return () => { wodCarouselApi.off('select', onSelect); };
  }, [wodCarouselApi]);
  const [userId, setUserId] = useState<string | undefined>();

  // Fetch current user
  useEffect(() => {
    supabase.auth.getUser().then(({
      data: {
        user
      }
    }) => {
      setUserId(user?.id);
    });
  }, []);

  // Fetch workouts, interactions, and WOD state from database
  const { isLoading, bodyweightWod: bodyweightWOD, equipmentWod: equipmentWOD, variousWod: variousWOD, isRecoveryDay } = useTodayWods();
  const availableTrainingWODs = [bodyweightWOD, equipmentWOD].filter(Boolean);
  const hasSingleTrainingWOD = !isRecoveryDay && availableTrainingWODs.length === 1;
  const {
    data: interactions = []
  } = useWorkoutInteractions(userId);

  // Get interactions for current WODs
  const getInteraction = (workoutId: string | undefined) => {
    if (!workoutId) return null;
    return interactions.find(i => i.workout_id === workoutId);
  };

  // Helper function to check if workout is new (created within last 2 days)
  const isNew = (createdAt: string | null | undefined) => {
    if (!createdAt) return false;
    const daysSinceCreation = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceCreation <= 2;
  };

  // Strip HTML tags from description
  const stripHtml = (html: string | null | undefined) => {
    if (!html) return "";
    return html.replace(/<[^>]*>/g, "");
  };

  // Render a single WOD card - unified for all equipment types
  const renderWODCard = (wod: typeof bodyweightWOD, isBodyweight: boolean, isVarious: boolean = false) => {
    if (!wod) return null;
    const interaction = getInteraction(wod.id);
    
    // Determine equipment icon and label based on type
    let equipmentIcon, equipmentLabel, equipmentBadgeClass;
    if (isVarious) {
      equipmentIcon = <Shuffle className="w-4 h-4" />;
      equipmentLabel = "Mixed/Minimal";
      equipmentBadgeClass = "bg-purple-500";
    } else if (isBodyweight) {
      equipmentIcon = <Home className="w-4 h-4" />;
      equipmentLabel = "No Equipment";
      equipmentBadgeClass = "bg-blue-500";
    } else {
      equipmentIcon = <Dumbbell className="w-4 h-4" />;
      equipmentLabel = "With Equipment";
      equipmentBadgeClass = "bg-orange-500";
    }
    
    return <Card className="group cursor-pointer overflow-hidden border-2 border-green-500/60 hover:border-green-500 hover:shadow-xl transition-all duration-300 w-full h-full" onClick={() => navigate(`/workout/wod/${wod.id}`)}>
        {/* Image */}
        <div className="relative aspect-video overflow-hidden">
          <img src={wod.image_url || "/placeholder.svg"} alt={`${wod.name} - online workout by Haris Falas at SmartyGym SmartGym Smart Gym smartygym.com`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />

          {/* Equipment Badge - Top Left */}
          <Badge className={`absolute top-3 left-3 ${equipmentBadgeClass} text-white border-0`}>
            {equipmentIcon}
            <span className="ml-1">{equipmentLabel}</span>
          </Badge>

          {/* NEW Badge */}
          {isNew(wod.created_at) && <Badge className="absolute top-3 right-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0">
              NEW
            </Badge>}

          {/* Status badges for logged-in users */}
          {userId && interaction && <div className="absolute bottom-12 right-3 flex gap-2">
              {interaction.is_completed && <Badge className="bg-green-500/90 text-white border-0">
                  <Check className="w-3 h-3 mr-1" />
                  Done
                </Badge>}
              {interaction.has_viewed && !interaction.is_completed && <Badge className="bg-blue-500/90 text-white border-0">
                  <Eye className="w-3 h-3 mr-1" />
                  Viewed
                </Badge>}
              {interaction.is_favorite && <Badge className="bg-pink-500/90 text-white border-0">
                  <Heart className="w-3 h-3 mr-1" />
                </Badge>}
            </div>}

          {/* Access Badge - Bottom */}
          <div className="absolute bottom-3 right-3">
            {freeAccessMode ? null : wod.is_premium ? <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-0 shadow-lg">
                <Crown className="w-3 h-3 mr-1" />
                Premium
              </Badge> : wod.is_standalone_purchase && wod.price ? <Badge className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0 shadow-lg">
                <ShoppingCart className="w-3 h-3 mr-1" />
                €{wod.price.toFixed(2)}
              </Badge> : <Badge className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white border-0 shadow-lg">
                <Check className="w-3 h-3 mr-1" />
                Free
              </Badge>}
          </div>
        </div>

        {/* Card Content */}
        <CardContent className="p-3 sm:p-4">
          {/* Title */}
          <h3 className="text-lg sm:text-xl font-bold leading-tight text-foreground mb-1.5 group-hover:text-primary transition-colors line-clamp-2 min-h-[3.5rem]">
            {wod.name}
          </h3>

          {/* Description - Fixed 2-line height for carousel alignment */}
          {wod.description && <p className="text-muted-foreground text-sm mb-2 line-clamp-2 min-h-[2.5rem]">
              {stripHtml(wod.description).substring(0, 120)}...
            </p>}

          {/* Compact Metadata Display - Horizontal Layout */}
          <div className="space-y-1.5 mb-2 text-sm">
            {/* Row 1: Category + Focus + Difficulty + Duration */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              {wod.category && (
                <>
                  <div className="flex items-center gap-1">
                    <Layers className="w-3 h-3 text-primary" />
                    <span className="text-muted-foreground font-medium">{wod.category}</span>
                  </div>
                  <span className="text-muted-foreground">•</span>
                </>
              )}
              <div className="flex items-center gap-1">
                <Target className="w-3 h-3 text-primary" />
                <span className="text-blue-600 dark:text-blue-400 font-medium">{wod.format || "General"}</span>
              </div>
              <span className="text-muted-foreground">•</span>
              <div className="flex items-center gap-1">
                <TrendingUp className={`w-3 h-3 ${wod.category?.toUpperCase() === "RECOVERY" ? "text-green-600 dark:text-green-400" : getDifficultyColorClasses(wod.difficulty_stars || wod.difficulty).icon}`} />
                <span className={`font-medium capitalize ${wod.category?.toUpperCase() === "RECOVERY" ? "text-green-600 dark:text-green-400" : getDifficultyColorClasses(wod.difficulty_stars || wod.difficulty).text}`}>
                  {wod.category?.toUpperCase() === "RECOVERY" 
                    ? "All Levels" 
                    : (wod.difficulty || (wod.difficulty_stars ? (wod.difficulty_stars <= 2 ? "Beginner" : wod.difficulty_stars <= 4 ? "Intermediate" : "Advanced") : "Beginner"))}
                  {wod.category?.toUpperCase() !== "RECOVERY" && wod.difficulty_stars && ` (${wod.difficulty_stars}★)`}
                </span>
              </div>
              <span className="text-muted-foreground">•</span>
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                <span className="text-purple-600 dark:text-purple-400 font-medium">{wod.duration || "45-60 min"}</span>
              </div>
            </div>
            {/* Row 2: Premium + BUY badges only */}
            <div className="flex flex-wrap items-center gap-1.5">
              {!freeAccessMode && <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-0 text-xs py-0.5">
                <Crown className="w-3 h-3 mr-1" />
                Premium
              </Badge>}
              {!freeAccessMode && wod.is_standalone_purchase && wod.price && userTier !== "premium" && !hasPurchased(wod.id, "workout") && <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0 cursor-help text-xs py-0.5">
                        <ShoppingCart className="w-3 h-3 mr-1" />
                        BUY €{wod.price.toFixed(2)}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Buy this workout individually to try our coaching style</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>}
            </div>
          </div>

          {/* CTA Button */}
          <Button className="w-full" size="sm">
            View Workout
          </Button>
        </CardContent>
      </Card>;
  };
  return <>
      {isLoading ? <div className="min-h-screen bg-background px-4 pb-8">
          <div className="container mx-auto max-w-7xl md:max-w-[1500px]">
            <ContentLoadingSkeleton />
          </div>
        </div> : <>
          <Helmet>
            <title>Smarty Workouts | Workout of the Day | Daily Expert Workouts | SmartyGym</title>
            <meta name="description" content="Two daily expert-designed workouts at midnight - one with equipment, one without. Following a 6-day periodization cycle. Your SmartyGym: the gym that never closes." />
            <meta name="keywords" content="workout of the day, WOD, daily workouts, bodyweight workout, equipment workout, online gym, periodization, Haris Falas" />
            <meta property="og:title" content="Workout of the Day | SmartyGym" />
            <meta property="og:description" content="Two daily expert-designed workouts - choose equipment or bodyweight" />
            <meta property="og:type" content="website" />
            <meta property="og:url" content="https://smartygym.com/workout/wod" />
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content="Workout of the Day | SmartyGym" />
            <meta name="twitter:description" content="Fresh workouts every day at midnight" />
            <link rel="canonical" href="https://smartygym.com/workout/wod" />
          </Helmet>

          <div className="min-h-screen bg-background">
            <div className="container mx-auto max-w-5xl md:max-w-[1500px] px-4 md:px-6 pb-8">

              <PageBreadcrumbs items={[{
            label: "Home",
            href: "/"
          }, {
            label: "Smarty Workouts",
            href: "/workout"
          }, {
            label: "WOD"
          }]} />

              {/* About Workout of the Day Card */}
              <Card className="mb-8 bg-gradient-to-br from-primary/5 via-background to-primary/5 border-2 border-primary/40 shadow-primary">
                <div className="p-4 sm:p-6">
                  <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight uppercase mb-3 text-center">Workout of the Day</h1>
                  {/* Desktop description */}
                  <p className="hidden sm:block text-base text-center text-muted-foreground max-w-3xl mx-auto">
                    Every training day <span className="text-primary font-semibold">SmartyGym</span> delivers TWO fresh, expertly designed workouts following a strategic periodization cycle — one with equipment and one without. On recovery days, we provide a single guided recovery session. Each day focuses on a different category and difficulty level. Our workouts follow a science-based periodization approach designed by{" "}
                    <a href="/coach-profile" className="text-primary hover:underline font-semibold">
                      Coach Haris Falas
                    </a>
                    , ensuring that within each weekly cycle, you train all fitness parameters. Unlike random workouts you find on YouTube or Instagram, following{" "}
                    <span className="text-primary font-semibold">SmartyGym</span>'s structured program means you can rest assured that your training is reliable, professionally organized, and designed to systematically improve all aspects of your fitness.
                  </p>
                  
                  {/* Mobile description - shorter version */}
                  <p className="block sm:hidden text-sm text-center text-muted-foreground max-w-3xl mx-auto">
                    Our WOD's follow a science-based periodization approach designed by Coach{" "}
                    <a href="/coach-profile" className="text-primary hover:underline font-semibold">
                      Haris Falas
                    </a>
                    , ensuring that within each weekly cycle, you train all fitness parameters. Following{" "}
                    <span className="text-primary font-semibold">SmartyGym</span>'s structured program means you can rest assured that your training is reliable, professionally organized, and designed to systematically improve all aspects of your fitness.
                  </p>
                </div>
              </Card>

              {/* Periodization Calendar - Pure Calendar-Based */}
              <WODPeriodizationCalendar />

              {/* WOD Cards - Training days show 2 cards, Recovery shows 1 */}
              {isRecoveryDay && variousWOD ? (
                /* Recovery Day - Single Card fills full available width on all breakpoints */
                <div className="w-full">
                  {renderWODCard(variousWOD, false, true)}
                </div>
              ) : hasSingleTrainingWOD ? (
                /* Any single WOD day must fill the full row instead of occupying half of a two-card grid */
                <div className="w-full">
                  {bodyweightWOD ? renderWODCard(bodyweightWOD, true) : renderWODCard(equipmentWOD, false)}
                </div>
              ) : bodyweightWOD || equipmentWOD ? (
                <>
                  {/* Phone Carousel */}
                  <div className="sm:hidden">
                    <Carousel 
                      setApi={setWodCarouselApi}
                      opts={{ align: "center", loop: true, startIndex: 0 }}
                      className="w-full"
                    >
                      <CarouselContent className="-ml-2">
                        {bodyweightWOD && (
                          <CarouselItem className="pl-2 basis-[85%]">
                            {renderWODCard(bodyweightWOD, true)}
                          </CarouselItem>
                        )}
                        {equipmentWOD && (
                          <CarouselItem className="pl-2 basis-[85%]">
                            {renderWODCard(equipmentWOD, false)}
                          </CarouselItem>
                        )}
                      </CarouselContent>
                      <CarouselPrevious className="left-2 h-8 w-8 bg-background/80 backdrop-blur-sm border-primary/20 hover:bg-primary hover:text-primary-foreground" />
                      <CarouselNext className="right-2 h-8 w-8 bg-background/80 backdrop-blur-sm border-primary/20 hover:bg-primary hover:text-primary-foreground" />
                    </Carousel>
                    {/* Navigation dots */}
                    <div className="flex justify-center gap-2 mt-4">
                      {[bodyweightWOD, equipmentWOD].filter(Boolean).map((_, index) => (
                        <button
                          key={index}
                          onClick={() => wodCarouselApi?.scrollTo(index)}
                          className={`w-2 h-2 rounded-full transition-colors ${
                            wodCurrentSlide === index ? 'bg-primary' : 'bg-muted-foreground/30'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  
                  {/* Tablet/Desktop Grid */}
                  <div className="hidden sm:grid sm:grid-cols-2 gap-4 lg:gap-6">
                    {renderWODCard(bodyweightWOD, true)}
                    {renderWODCard(equipmentWOD, false)}
                  </div>
                </>
              ) : (
                /* No WOD Available */
                <Card className="border-2 border-dashed border-primary/30">
                  <CardContent className="p-12 text-center">
                    <Clock className="w-16 h-16 text-primary/50 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-foreground mb-2">
                      Today's Workouts are Being Prepared
                    </h2>
                    <p className="text-muted-foreground">
                      Check back <span className="text-primary font-semibold">soon</span> for your fresh Workouts of the Day!
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* The Science Behind Your Daily Workout */}
              <Card className="mt-8 bg-gradient-to-br from-primary/5 via-background to-primary/5 border-2 border-primary/40">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Brain className="w-6 h-6 text-primary" />
                    <h2 className="text-xl sm:text-2xl font-bold text-center">The Science Behind Your Daily Workout</h2>
                  </div>
                  
                  <p className="text-sm sm:text-base text-center font-bold text-muted-foreground mb-6 max-w-3xl mx-auto">
                    Following <span className="text-primary font-bold">SmartyGym's</span> and <Link to="/coach-profile" className="text-primary font-bold hover:underline">Haris Falas</Link>' Workout of the Day is like having a personal trainer monitoring your training day by day — 
                    tracking your training load, recovery needs, and energy systems to deliver the perfect workout every single day.
                  </p>
                  
                  <div className="grid gap-4 sm:gap-6">
                    {/* Strategic Loading */}
                    <div className="bg-background/50 rounded-lg p-4 border border-primary/20">
                      <div className="flex items-center gap-2 mb-2">
                        <RefreshCw className="w-5 h-5 text-primary" />
                        <h3 className="font-semibold">Strategic Loading</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Your coach delivers each Workout of the Day according to science-based periodization, 
                        designed to respect proven training protocols. This intelligent programming determines 
                        when to load, when to deload, and when recovery is needed — ensuring correct and safe 
                        management of your energy systems throughout your fitness journey.
                      </p>
                    </div>
                    
                    {/* Intelligent Sequencing */}
                    <div className="bg-background/50 rounded-lg p-4 border border-primary/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Target className="w-5 h-5 text-primary" />
                        <h3 className="font-semibold">Intelligent Sequencing</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Each workout is carefully designed to complement what you did yesterday and prepare you 
                        for tomorrow. No conflicts, no overtraining — just smart progression that keeps you 
                        moving forward while respecting your body's recovery needs.
                      </p>
                    </div>
                    
                    {/* Three Benefits */}
                    <div className="bg-background/50 rounded-lg p-4 border border-primary/20">
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle className="w-5 h-5 text-primary" />
                        <h3 className="font-semibold">Three Guaranteed Benefits</h3>
                      </div>
                      <div className="grid sm:grid-cols-3 gap-3">
                        <div className="text-center p-3 rounded-lg bg-primary/5 border border-primary/10">
                          <Shield className="w-6 h-6 text-primary mx-auto mb-2" />
                          <span className="font-medium text-sm block">Safety</span>
                          <p className="text-xs text-muted-foreground mt-1">Proper recovery prevents injury</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-primary/5 border border-primary/10">
                          <Shuffle className="w-6 h-6 text-primary mx-auto mb-2" />
                          <span className="font-medium text-sm block">Variety</span>
                          <p className="text-xs text-muted-foreground mt-1">Different challenges every day</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-primary/5 border border-primary/10">
                          <TrendingUp className="w-6 h-6 text-primary mx-auto mb-2" />
                          <span className="font-medium text-sm block">Results</span>
                          <p className="text-xs text-muted-foreground mt-1">Systematic improvement guaranteed</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

            </div>
          </div>
        </>}
    </>;
};
export default WODCategory;