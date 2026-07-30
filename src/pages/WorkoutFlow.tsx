import { useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { DesktopPageIntro } from "@/components/DesktopPageIntro";
import { InfoRibbon } from "@/components/InfoRibbon";
import { Dumbbell, Flame, Zap, Heart, Move, Activity, CalendarCheck, Flower2, RefreshCw, Timer } from "lucide-react";
import { SEOEnhancer } from "@/components/SEOEnhancer";
import { generateBreadcrumbSchema } from "@/utils/seoHelpers";
import { useAccessControl } from "@/hooks/useAccessControl";

import { ScrollReveal } from "@/components/ScrollReveal";
import { useIsMobile } from "@/hooks/use-mobile";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext, type CarouselApi } from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import { CategoryCountBadge } from "@/components/ui/category-count-badge";
import { SwipeToExplore } from "@/components/ui/SwipeToExplore";
import { fetchVisibleWorkoutMetadata, useTodayWods } from "@/hooks/useTodayWods";

const WorkoutFlow = () => {
  const navigate = useNavigate();
  
  const { userTier } = useAccessControl();
  const isPremium = userTier === "premium";
  const isMobile = useIsMobile();
  const [currentWodImageIndex, setCurrentWodImageIndex] = useState(0);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);

  const { allTodayWods } = useTodayWods();
  const wodImages = allTodayWods.filter((w) => w.image_url).map((w) => w.image_url as string);

  // Fetch workout counts by category. Library-picked WODs must remain counted
  // because they are existing library workouts temporarily promoted to WOD.
  const { data: workoutCounts = {} } = useQuery({
    queryKey: ["workout-category-counts"],
    queryFn: async () => {
      const data = await fetchVisibleWorkoutMetadata(null);
      
      const counts: Record<string, number> = {};
      data
        ?.filter((w) => w.is_workout_of_day !== true || w.wod_source === "library")
        .forEach(w => {
        if (w.category) {
          // Map DB category to card ID
          const cat = w.category.toLowerCase()
            .replace("calorie burning", "calorie-burning")
            .replace("mobility & stability", "mobility")
            .replace(/\s+/g, "-");
          counts[cat] = (counts[cat] || 0) + 1;
        }
      });
      return counts;
    },
    staleTime: 1000 * 60 * 5,
  });

  const totalWorkoutCount = Object.values(workoutCounts).reduce((sum, c) => sum + c, 0);

  // Latest workouts for "Featured" section (mobile: 6, desktop: 6 inside grid)
  const { data: latestWorkouts = [] } = useQuery({
    queryKey: ["featured-latest-workouts"],
    queryFn: async () => {
      const data = await fetchVisibleWorkoutMetadata(null);
      return (data || [])
        .filter((w) => w.is_workout_of_day !== true || w.wod_source === "library")
        .filter((w) => !!w.created_at)
        .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
        .slice(0, 6);
    },
    staleTime: 1000 * 60 * 5,
  });

  const workoutCategoryToSlug = (cat?: string | null) =>
    (cat || "")
      .toLowerCase()
      .replace("calorie burning", "calorie-burning")
      .replace("mobility & stability", "mobility")
      .replace(/\s+/g, "-");

  // Rotate WOD images every 2.5 seconds
  useEffect(() => {
    if (wodImages.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentWodImageIndex(prev => (prev + 1) % wodImages.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [wodImages.length]);

  // Track carousel slide changes
  useEffect(() => {
    if (!carouselApi) return;
    const onSelect = () => {
      setCurrentSlide(carouselApi.selectedScrollSnap());
    };
    carouselApi.on("select", onSelect);
    onSelect();
    return () => {
      carouselApi.off("select", onSelect);
    };
  }, [carouselApi]);

  // Category background images (excluding WOD which has rotating images)
  const categoryBackgrounds: Record<string, string> = {
    "strength": "/images/workouts/strength-category-bg.jpg",
    "calorie-burning": "/images/workouts/calorie-burning-category-bg.jpg",
    "metabolic": "/images/workouts/metabolic-category-bg.jpg",
    "cardio": "/images/workouts/cardio-category-bg.jpg",
    "mobility": "/images/workouts/mobility-category-bg.jpg",
    "challenge": "/images/workouts/challenge-category-bg.jpg",
    "pilates": "/images/workouts/pilates-category-bg.jpg",
    "recovery": "/images/workouts/recovery-category-bg.jpg",
    "micro-workouts": "/images/workouts/micro-workouts-category-bg.jpg",
  };

  // Mobile card images for stacked blog-card layout
  const categoryMobileImages: Record<string, string> = {
    "wod": "/images/workouts/wod-card-mobile.jpg",
    "strength": "/images/workouts/strength-card-mobile.jpg",
    "calorie-burning": "/images/workouts/calorie-burning-card-mobile.jpg",
    "metabolic": "/images/workouts/metabolic-card-mobile.jpg",
    "cardio": "/images/workouts/cardio-card-mobile.jpg",
    "mobility": "/images/workouts/mobility-card-mobile.jpg",
    "challenge": "/images/workouts/challenge-card-mobile.jpg",
    "pilates": "/images/workouts/pilates-card-mobile.jpg",
    "recovery": "/images/workouts/recovery-card-mobile.jpg",
    "micro-workouts": "/images/workouts/micro-workouts-card-mobile.jpg",
  };

  // Extended descriptions for mobile carousel
  const workoutDescriptions: Record<string, string> = {
    "wod": "Your daily dose of expertly programmed fitness, following science-based periodization.",
    "strength": "Single-session workouts to build foundational strength, power, and muscular endurance.",
    "calorie-burning": "High-intensity sessions designed to maximize calorie burn and fat loss.",
    "metabolic": "High-intensity training focused on boosting your metabolic rate and energy burn.",
    "cardio": "Build cardiovascular endurance, a stronger heart, and better everyday stamina.",
    "mobility": "Focused on joint health, mobility, and stability for better movement quality.",
    "challenge": "Gamification-style workouts that push you beyond your comfort zone.",
    "pilates": "Core strength, spinal alignment, and body awareness through precise movements.",
    "recovery": "Active recovery sessions to help your body repair, rebuild, and prevent injuries.",
    "micro-workouts": "Quick 5-minute bodyweight exercises you can do anywhere — desk, sofa, or on the go.",
  };

  const workoutTypes = [{
    id: "wod",
    title: "WOD",
    description: "Workout of the Day",
    icon: CalendarCheck,
    level: "Beginner-Advanced",
    equipment: "Equipment/No Equipment"
  }, {
    id: "strength",
    title: "Strength",
    description: "Build muscle and power with resistance training",
    icon: Dumbbell,
    level: "Beginner-Advanced",
    equipment: "Equipment/No Equipment"
  }, {
    id: "calorie-burning",
    title: "Calorie Burning",
    description: "High-intensity workouts to maximize calorie burn",
    icon: Flame,
    level: "Beginner-Advanced",
    equipment: "Equipment/No Equipment"
  }, {
    id: "metabolic",
    title: "Metabolic",
    description: "Boost your metabolism with dynamic conditioning",
    icon: Zap,
    level: "Beginner-Advanced",
    equipment: "Equipment/No Equipment"
  }, {
    id: "cardio",
    title: "Cardio",
    description: "Improve cardiovascular endurance and stamina",
    icon: Heart,
    level: "Beginner-Advanced",
    equipment: "Equipment/No Equipment"
  }, {
    id: "mobility",
    title: "Mobility & Stability",
    description: "Enhance flexibility and movement quality",
    icon: Move,
    level: "Beginner-Advanced",
    equipment: "Equipment/No Equipment"
  }, {
    id: "challenge",
    title: "Challenge",
    description: "Push your limits with advanced workouts",
    icon: Activity,
    level: "Beginner-Advanced",
    equipment: "Equipment/No Equipment"
  }, {
    id: "pilates",
    title: "Pilates",
    description: "Controlled movements and alignment",
    icon: Flower2,
    level: "Beginner-Advanced",
    equipment: "Reformer/Mat"
  }, {
    id: "recovery",
    title: "Recovery",
    description: "Regeneration and active recovery workouts",
    icon: RefreshCw,
    level: "All Levels",
    equipment: "Various"
  }, {
    id: "micro-workouts",
    title: "Micro-Workouts",
    description: "Get fit in 5' with quick exercise snacks",
    icon: Timer,
    level: "All Levels",
    equipment: "Bodyweight/Minimal"
  }];

  const handleWorkoutSelect = (workoutId: string) => {
    navigate(`/workout/${workoutId}`);
  };

  return (
    <>
      <Helmet>
        <title>Online Workouts | AMRAP TABATA HIIT Strength Cardio | Haris Falas | SmartyGym</title>
        <meta name="description" content="500+ online gym workouts at smartygym.com. AMRAP, TABATA, HIIT, circuit training, strength, cardio, metabolic, mobility workouts by Sports Scientist Haris Falas. Home workouts, bodyweight training, equipment workouts. Train anywhere, anytime." />
        <meta name="keywords" content="online gym, online workouts, gym workouts, home workouts, online fitness, HFSC, Haris Falas, Sports Scientist, AMRAP workouts, TABATA training, HIIT workouts, circuit training, strength training workouts, cardio workouts, bodyweight training, metabolic training, mobility training, calorie burning workouts, challenge workouts, Pilates, Reformer Pilates, Mat Pilates, smartygym.com, workout of the day, WOD, micro workouts, mini workouts, small workouts, 5 minute workouts, quick workouts, exercise snacks, office workout, desk workout, outdoor workout, EMOM workout" />
        
        <link rel="alternate" hrefLang="el" href="https://smartygym.com/workout" />
        <link rel="alternate" hrefLang="en-GB" href="https://smartygym.com/workout" />
        <link rel="canonical" href="https://smartygym.com/workout" />
        
        <meta property="og:title" content="500+ Online Workouts | AMRAP TABATA HIIT | SmartyGym by Haris Falas" />
        <meta property="og:description" content="Professional workout library by Sports Scientist Haris Falas - Strength, Cardio, Metabolic, Mobility workouts. Train anywhere, anytime." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://smartygym.com/workout" />
        <meta property="og:image" content="https://smartygym.com/smarty-gym-logo.png" />
        
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="500+ Online Workouts | SmartyGym" />
        <meta name="twitter:description" content="Expert workouts by Haris Falas - AMRAP, TABATA, HIIT, strength, cardio at smartygym.com" />
        <meta name="twitter:image" content="https://smartygym.com/smarty-gym-logo.png" />
        
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": "SmartyGym Workout Library",
            "description": "500+ expert-designed workouts including AMRAP, TABATA, HIIT, strength, cardio, metabolic, and mobility sessions by Sports Scientist Haris Falas",
            "url": "https://smartygym.com/workout",
            "numberOfItems": 500,
            "mainEntity": {
              "@type": "ItemList",
              "name": "Workout Categories",
              "itemListElement": [
                { "@type": "ListItem", "position": 1, "name": "Workout of the Day", "url": "https://smartygym.com/workout/wod" },
                { "@type": "ListItem", "position": 2, "name": "Strength Workouts", "url": "https://smartygym.com/workout/strength" },
                { "@type": "ListItem", "position": 3, "name": "Calorie Burning Workouts", "url": "https://smartygym.com/workout/calorie-burning" },
                { "@type": "ListItem", "position": 4, "name": "Metabolic Workouts", "url": "https://smartygym.com/workout/metabolic" },
                { "@type": "ListItem", "position": 5, "name": "Cardio Workouts", "url": "https://smartygym.com/workout/cardio" },
                { "@type": "ListItem", "position": 6, "name": "Mobility & Stability", "url": "https://smartygym.com/workout/mobility" },
                { "@type": "ListItem", "position": 7, "name": "Challenge Workouts", "url": "https://smartygym.com/workout/challenge" },
                { "@type": "ListItem", "position": 8, "name": "Pilates Workouts", "url": "https://smartygym.com/workout/pilates" },
                { "@type": "ListItem", "position": 9, "name": "Micro-Workouts", "url": "https://smartygym.com/workout/micro-workouts" }
              ]
            },
            "author": { "@type": "Person", "name": "Haris Falas", "jobTitle": "Sports Scientist" },
            "provider": { "@type": "Organization", "name": "SmartyGym", "url": "https://smartygym.com" }
          })}
        </script>
        
        <script type="application/ld+json">
          {JSON.stringify(generateBreadcrumbSchema([{ name: "Home", url: "/" }, { name: "Workouts", url: "/workout" }]))}
        </script>
      </Helmet>
      
      <SEOEnhancer 
        entities={["SmartyGym", "Haris Falas", "Online Workouts", "AMRAP", "HIIT", "Tabata", "Circuit Training", "Micro-Workouts"]} 
        topics={["online gym workouts", "AMRAP", "HIIT", "Tabata", "circuit training", "strength training", "cardio workouts", "metabolic conditioning", "mobility training", "micro workouts", "5 minute workouts", "exercise snacks"]} 
        expertise={["sports science", "strength conditioning", "functional fitness", "exercise programming", "office fitness", "quick workouts"]} 
        contentType="workout-collection" 
        aiSummary="SmartyGym Workout Library: 500+ online gym workouts by Sports Scientist Haris Falas. Categories include Workout of the Day (WOD), Strength, Calorie Burning, Metabolic, Cardio, Mobility & Stability, Challenge, and Micro-Workouts (5-minute exercise snacks). Formats include AMRAP, TABATA, HIIT, Circuit, EMOM, For Time. Suitable for all levels worldwide. Office workouts, desk exercises, outdoor workouts, bodyweight training." 
        aiKeywords={["online gym", "AMRAP workouts", "HIIT training", "Tabata", "strength workouts", "cardio training", "home workouts", "bodyweight workouts", "gym workouts", "micro workouts", "mini workouts", "small workouts", "5 minute workouts", "quick workouts", "exercise snacks", "office workout", "desk workout", "outdoor workout", "EMOM workout", "circuit workout"]} 
        relatedContent={["training programs", "fitness tools", "exercise library", "workout of the day", "micro-workouts"]} 
      />
      
      <div className="min-h-screen bg-background">
        <div className="container mx-auto max-w-6xl md:max-w-[1500px] px-4 md:px-6 pb-8">
          
          <PageBreadcrumbs items={[{
            label: "Home",
            href: "/"
          }, {
            label: "Smarty Workouts"
          }]} />

          {/* Info Section - About Smarty Workouts */}
          <DesktopPageIntro icon={Dumbbell} title="Smarty Workouts">
            <p className="font-bold text-foreground">
              <span className="text-primary font-semibold">Smarty Workouts</span> are single-session training routines designed to fit your lifestyle and goals. Whether you're targeting strength, calorie burning, metabolic conditioning, cardio endurance, mobility & stability, or looking for a challenge — we have you covered. At the gym, at home, or on the go — <span className="text-primary font-semibold">Smarty Workouts</span> deliver results in any setting.
            </p>
            <p className="font-semibold text-foreground">
              Unlock all <span className="text-primary font-bold">{totalWorkoutCount} workouts</span> with a Premium plan or grab one standalone session whenever you need it.
            </p>
            <p className="text-sm">
              (Our coach, <Link to="/coach-profile" className="text-primary font-semibold hover:underline">Haris Falas</Link>, suggests following the <span className="text-primary font-semibold">WOD</span> for science-based periodization, ensuring safety and optimal results)
            </p>
          </DesktopPageIntro>

          <Card className="lg:hidden mb-8 bg-white dark:bg-card border-2 border-primary/40 shadow-primary">
            <div className="p-4 sm:p-5">
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight uppercase mb-3 text-center">Smarty Workouts</h2>
              <div className="space-y-2 text-muted-foreground max-w-3xl mx-auto">
                {isMobile ? (
                  <>
                    <p className="text-sm text-center">
                      <span className="text-primary font-semibold">Smarty Workouts</span> are single-session routines for any goal. Unlock all <span className="text-primary font-bold">{totalWorkoutCount}</span> with Premium or grab one standalone.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm sm:text-base text-center font-bold">
                      <span className="text-primary font-semibold">Smarty Workouts</span> are single-session training routines designed to fit your lifestyle and goals. Whether you're targeting strength, calorie burning, metabolic conditioning, cardio endurance, mobility & stability, or looking for a challenge — we have you covered. At the gym, at home, or on the go — <span className="text-primary font-semibold">Smarty Workouts</span> deliver results in any setting.
                    </p>
                    
                    <p className="text-sm sm:text-base font-semibold text-foreground text-center mt-6">
                      Unlock all <span className="text-primary font-bold">{totalWorkoutCount} workouts</span> with a Premium plan or grab one standalone session whenever you need it.
                    </p>
                    
                    <p className="text-xs sm:text-sm text-muted-foreground text-center mt-4">
                      (Our coach, <Link to="/coach-profile" className="text-primary font-semibold hover:underline">Haris Falas</Link>, suggests following the <span className="text-primary font-semibold">WOD</span> for science-based periodization, ensuring safety and optimal results)
                    </p>
                  </>
                )}
              </div>
            </div>
          </Card>

          {/* Desktop: Grid Layout - Stacked blog-card style */}
          <div className="hidden lg:grid lg:grid-cols-3 gap-4 sm:gap-6">
            {workoutTypes.map(workout => {
              const Icon = workout.icon;
              const isWodCard = workout.id === "wod";
              const mobileImage = categoryMobileImages[workout.id];
              
              return (
                <ScrollReveal key={workout.id}>
                  <Card 
                    itemScope 
                    itemType="https://schema.org/ExercisePlan" 
                    onClick={() => handleWorkoutSelect(workout.id)} 
                    className="group cursor-pointer transition-all duration-500 ease-out transform-gpu hover:scale-105 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary/40 hover:border-primary/60 border-2 border-border overflow-hidden bg-card"
                    role="button" 
                    aria-label={`${workout.title} workouts - Online gym category at SmartyGym - smartygym.com by Haris Falas`} 
                    data-workout-category={workout.id} 
                    data-keywords="online gym workouts, smarty gym, online fitness, smartygym.com, Haris Falas workouts"
                  >
                    {/* Image Section */}
                    <div className="relative h-48 lg:h-52 overflow-hidden">
                      {isWodCard && wodImages.length > 0 ? (
                        wodImages.map((imageUrl, index) => (
                          <img
                            key={index}
                            src={imageUrl}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out"
                            style={{ opacity: currentWodImageIndex === index ? 1 : 0 }}
                          />
                        ))
                      ) : mobileImage ? (
                        <img
                          src={mobileImage}
                          alt=""
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                      ) : null}
                      {/* Counter Badge */}
                      {!isWodCard && <CategoryCountBadge count={workoutCounts[workout.id] || 0} />}
                    </div>

                    {/* Content Section */}
                    <div className="p-5 flex flex-col items-center text-center space-y-3">
                      <div
                        className="relative w-14 h-14 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                        aria-hidden="true"
                      >
                        <div className="absolute inset-0 rounded-full bg-primary/10 pointer-events-none" aria-hidden="true" />
                        <Icon className="relative w-7 h-7 transition-transform duration-300 group-hover:rotate-3 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg mb-2 text-foreground" itemProp="name">
                          {workout.title}
                        </h3>
                        <p className="text-sm mb-3 text-muted-foreground" itemProp="description">
                          {workout.description}
                        </p>
                        <p className="text-xs italic text-muted-foreground">
                          Crafted by{" "}
                          <a href="/coach-profile" className="hover:underline font-medium whitespace-nowrap text-primary" onClick={e => e.stopPropagation()}>
                            Haris Falas
                          </a>
                          {" "}BSc Sports Science, EXOS Specialist, CSCS
                        </p>
                        
                        <div className="flex gap-1 text-[10px] mt-2">
                          <span className="px-1.5 py-0.5 rounded-full whitespace-nowrap bg-primary/20 text-primary border border-primary/40">
                            Single Session
                          </span>
                          <span className="px-1.5 py-0.5 rounded-full whitespace-nowrap bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/40">
                            {workout.level}
                          </span>
                          <span className="px-1.5 py-0.5 rounded-full whitespace-nowrap bg-orange-500/20 text-orange-700 dark:text-orange-400 border border-orange-500/40">
                            {workout.equipment}
                          </span>
                        </div>
                        
                        <meta itemProp="exerciseType" content={workout.title} />
                        <meta itemProp="provider" content="Smarty Gym - Online Gym - smartygym.com" />
                        <meta itemProp="audience" content="All fitness levels" />
                      </div>
                    </div>
                  </Card>
                </ScrollReveal>
              );
            })}
            {/* Desktop: Featured Workouts (latest 6) — fills empty space beside Micro-Workouts */}
            {latestWorkouts.length > 0 && (
              <div className="lg:col-span-2 flex flex-col">
                <div className="rounded-xl border-2 border-green-500/60 bg-green-500/[0.05] p-4 flex flex-col flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-extrabold tracking-tight text-green-400 uppercase">Featured Workouts</span>
                    <div className="h-px flex-1 bg-green-500/30" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 flex-1">
                    {latestWorkouts.map((w) => {
                      const slug = workoutCategoryToSlug(w.category);
                      const image = w.image_url || categoryMobileImages[slug] || "/images/workouts/wod-card-mobile.jpg";
                      return (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() => navigate(`/workout/${slug}/${w.id}`)}
                          className="flex items-stretch bg-card border border-border rounded-xl overflow-hidden hover:border-green-400 hover:shadow-lg transition-all duration-300 text-left min-h-0"
                        >
                          <div className="relative w-24 flex-shrink-0 bg-muted">
                            <img
                              src={image}
                              alt={w.name}
                              loading="lazy"
                              className="absolute inset-0 w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0 p-2.5 flex flex-col justify-center">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-green-400 line-clamp-1">{w.category}</span>
                            <h3 className="text-xs font-bold text-foreground leading-tight line-clamp-2 mt-0.5">{w.name}</h3>
                            {(w.duration || w.difficulty) && (
                              <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                                {[w.duration, w.difficulty].filter(Boolean).join(" · ")}
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Mobile: Dynamic Description Card */}
          <div className="lg:hidden mb-4">
            <Card className="bg-card border border-primary/20">
              <div className="p-4 text-center">
                <p className="text-sm text-muted-foreground transition-opacity duration-300">
                  {workoutDescriptions[workoutTypes[currentSlide]?.id] || ""}
                </p>
              </div>
            </Card>
          </div>

          {/* Mobile: Carousel Layout */}
          <div className="lg:hidden relative">
            <SwipeToExplore onPrev={() => carouselApi?.scrollPrev()} onNext={() => carouselApi?.scrollNext()} />
            <Carousel
              className="w-full"
              opts={{
                align: "center",
                loop: true,
                startIndex: 0,
              }}
              setApi={setCarouselApi}
            >
              <CarouselContent className="-ml-2">
                {workoutTypes.map((workout) => {
                  const Icon = workout.icon;
                  const mobileImage = categoryMobileImages[workout.id];
                  const isWodCard = workout.id === "wod";
                  
                  return (
                      <CarouselItem key={workout.id} className="pl-2 basis-[75%] sm:basis-[60%]">
                       <div
                         itemScope
                         itemType="https://schema.org/ExercisePlan"
                         onClick={() => handleWorkoutSelect(workout.id)}
                            className="smarty-carousel-card-portrait-tablet flex flex-col h-[300px] min-[540px]:h-[600px] bg-card border-2 border-green-500/60 rounded-xl overflow-hidden cursor-pointer hover:border-green-500 hover:scale-[1.02] hover:shadow-xl transition-all duration-300"
                         role="button"
                         aria-label={`${workout.title} workouts`}
                       >
                         {/* Image section */}
                           <div className="smarty-carousel-image-portrait-tablet relative h-[58%] min-[540px]:h-[72%] min-[540px]:aspect-auto overflow-hidden flex-shrink-0 bg-muted">
                          {isWodCard && wodImages.length > 0 ? (
                            wodImages.map((imageUrl, index) => (
                              <img
                                key={index}
                                src={imageUrl}
                                alt=""
                                loading="lazy"
                                 className="absolute inset-0 w-full h-full object-cover object-[center_top] min-[540px]:object-contain transition-opacity duration-1000 ease-in-out"
                                style={{ opacity: currentWodImageIndex === index ? 1 : 0 }}
                              />
                            ))
                          ) : mobileImage && (
                            <img 
                              src={mobileImage} 
                              alt={workout.title}
                              loading="lazy"
                               className="w-full h-full object-cover object-[center_top] min-[540px]:object-contain"
                            />
                          )}
                          {!isWodCard && (
                            <CategoryCountBadge count={workoutCounts[workout.id] || 0} size="sm" className="top-1.5 right-1.5 left-auto" />
                          )}
                        </div>
                        {/* Content section */}
                          <div className="smarty-carousel-content-portrait-tablet flex flex-col justify-center flex-1 px-3 py-3 min-[540px]:p-4 text-center">
                           <div className="smarty-carousel-title-row-portrait-tablet flex items-center justify-center gap-2 mb-1 min-[540px]:mb-2">
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Icon className="w-4 h-4 text-primary" />
                            </div>
                              <h3 className="smarty-carousel-card-title m-0 min-h-0 min-w-0 text-sm min-[540px]:text-base font-bold text-foreground leading-tight line-clamp-2" itemProp="name">
                              {workout.title}
                            </h3>
                          </div>
                          <p className="smarty-carousel-card-copy text-xs min-[540px]:text-sm text-muted-foreground leading-snug line-clamp-2 h-[2rem] min-h-0 min-[540px]:h-auto">
                            {workoutDescriptions[workout.id] || workout.description}
                          </p>
                        </div>
                      </div>
                    </CarouselItem>
                  );
                })}
              </CarouselContent>
              
              {/* Permanently visible arrows inside the carousel */}
              <CarouselPrevious className="left-2 h-8 w-8 rounded-full bg-background/80 border border-border/50 shadow-sm" />
              <CarouselNext className="right-2 h-8 w-8 rounded-full bg-background/80 border border-border/50 shadow-sm" />
            </Carousel>
            
            {/* Navigation Dots */}
            <div className="flex justify-center gap-2 mt-4">
              {workoutTypes.map((_, index) => (
                <button
                  key={index}
                  onClick={() => carouselApi?.scrollTo(index)}
                  className={cn(
                    "w-2.5 h-2.5 rounded-full border-2 transition-all duration-300",
                    currentSlide === index
                      ? "border-primary bg-transparent scale-125"
                      : "border-primary/40 bg-transparent hover:border-primary/60"
                  )}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Mobile: Featured Workouts (latest 3) */}
          {latestWorkouts.length > 0 && (
            <div className="lg:hidden mt-8">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-extrabold tracking-tight text-primary uppercase">Featured Workouts</span>
                <div className="h-px flex-1 bg-primary/20" />
              </div>
              <div className="flex flex-col gap-3">
                {latestWorkouts.map((w) => {
                  const slug = workoutCategoryToSlug(w.category);
                  const image = w.image_url || categoryMobileImages[slug] || "/images/workouts/wod-card-mobile.jpg";
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => navigate(`/workout/${slug}/${w.id}`)}
                      className="flex items-stretch bg-card border-2 border-primary/40 rounded-xl overflow-hidden hover:border-primary hover:shadow-xl transition-all duration-300 text-left"
                    >
                      <div className="relative w-28 flex-shrink-0 bg-muted">
                        <img
                          src={image}
                          alt={w.name}
                          loading="lazy"
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0 p-3 flex flex-col justify-center">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">{w.category}</span>
                        <h3 className="text-sm font-bold text-foreground leading-tight line-clamp-2 mt-0.5">{w.name}</h3>
                        {(w.duration || w.difficulty) && (
                          <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">
                            {[w.duration, w.difficulty].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bottom Premium Banner */}
          {!isPremium && (
            <ScrollReveal delay={700}>
              <div className="bg-card border border-border rounded-xl p-6 mt-8 text-center shadow-soft">
                <h3 className="text-xl font-semibold mb-2">Love these workouts?</h3>
                <p className="text-muted-foreground mb-4">
                  Unlock 500+ more exclusive sessions with SmartyGym Premium.
                </p>
                <Button size="lg" onClick={() => navigate("/smarty-premium")} className="cta-button">
                  Join Premium
                </Button>
              </div>
            </ScrollReveal>
          )}
        </div>

      </div>
    </>
  );
};

export default WorkoutFlow;
