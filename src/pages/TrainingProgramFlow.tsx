import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { DesktopPageIntro } from "@/components/DesktopPageIntro";
import { InfoRibbon } from "@/components/InfoRibbon";
import { Heart, Dumbbell, Activity, Flame, User, Move, Scale } from "lucide-react";
import { SEOEnhancer } from "@/components/SEOEnhancer";
import { generateBreadcrumbSchema } from "@/utils/seoHelpers";
import { useAccessControl } from "@/hooks/useAccessControl";

import { ScrollReveal } from "@/components/ScrollReveal";
import { useIsMobile } from "@/hooks/use-mobile";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext, type CarouselApi } from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { CategoryCountBadge } from "@/components/ui/category-count-badge";
import { SwipeToExplore } from "@/components/ui/SwipeToExplore";
import { useFreeAccessMode } from "@/hooks/useFreeAccessMode";

type VisibleProgramMetadata = Database["public"]["Functions"]["get_visible_program_metadata"]["Returns"][number];

const TrainingProgramFlow = () => {
  const navigate = useNavigate();
  
  const { userTier } = useAccessControl();
  const isPremium = userTier === "premium";
  const { freeAccessMode } = useFreeAccessMode();
  const isMobile = useIsMobile();
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);

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

  // Fetch program counts by category
  const { data: programCounts = {} } = useQuery({
    queryKey: ["program-category-counts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_training_programs")
        .select("category")
        .neq("is_visible", false);
      
      const counts: Record<string, number> = {};
      data?.forEach(p => {
        if (p.category) {
          // Map DB category to card ID
          const cat = p.category.toLowerCase()
            .replace("cardio endurance", "cardio-endurance")
            .replace("functional strength", "functional-strength")
            .replace("muscle hypertrophy", "muscle-hypertrophy")
            .replace("weight loss", "weight-loss")
            .replace("low back pain", "low-back-pain")
            .replace("mobility & stability", "mobility-stability")
            .replace(/\s+/g, "-");
          counts[cat] = (counts[cat] || 0) + 1;
        }
      });
      return counts;
    },
    staleTime: 1000 * 60 * 5,
  });

  const totalProgramCount = Object.values(programCounts).reduce((sum, c) => sum + c, 0);

  // Latest 3 programs for mobile "Featured" section
  const { data: latestPrograms = [] } = useQuery({
    queryKey: ["featured-latest-programs"],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_visible_program_metadata", {});
      return (data || [])
        .filter((p) => p.is_visible !== false && !!p.created_at)
        .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
        .slice(0, 3);
    },
    staleTime: 1000 * 60 * 5,
  });

  const programCategoryToSlug = (cat?: string | null) =>
    (cat || "")
      .toLowerCase()
      .replace("cardio endurance", "cardio-endurance")
      .replace("functional strength", "functional-strength")
      .replace("muscle hypertrophy", "muscle-hypertrophy")
      .replace("weight loss", "weight-loss")
      .replace("low back pain", "low-back-pain")
      .replace("mobility & stability", "mobility-stability")
      .replace(/\s+/g, "-");

  // Category background images for programs
  const programBackgrounds: Record<string, string> = {
    "cardio-endurance": "/images/programs/cardio-endurance-bg.jpg",
    "functional-strength": "/images/programs/functional-strength-bg.jpg",
    "muscle-hypertrophy": "/images/programs/muscle-hypertrophy-bg.jpg",
    "weight-loss": "/images/programs/weight-loss-card-mobile.jpg",
    "low-back-pain": "/images/programs/low-back-pain-bg.jpg",
    "mobility-stability": "/images/programs/mobility-stability-bg.jpg",
  };

  // Mobile card images for stacked blog-card layout
  const programMobileImages: Record<string, string> = {
    "cardio-endurance": "/images/programs/cardio-endurance-card-mobile.jpg",
    "functional-strength": "/images/programs/functional-strength-card-mobile.jpg",
    "muscle-hypertrophy": "/images/programs/muscle-hypertrophy-card-mobile.jpg",
    "weight-loss": "/images/programs/weight-loss-card-mobile.jpg",
    "low-back-pain": "/images/programs/low-back-pain-card-mobile.jpg",
    "mobility-stability": "/images/programs/mobility-stability-card-mobile.jpg",
  };

  // Extended descriptions for mobile carousel
  const programDescriptions: Record<string, string> = {
    "cardio-endurance": "Multi-week plans to improve cardiovascular endurance, VO2 max, and aerobic capacity.",
    "functional-strength": "Build the real-world strength you need for daily life, hobbies, and sports performance.",
    "muscle-hypertrophy": "Strategic programs for muscle growth, metabolism, and long-term health.",
    "weight-loss": "Combining calorie burning, metabolic training, and muscle building for sustainable results.",
    "low-back-pain": "Targeted plans addressing low back pain from office work, daily stress, or physical jobs.",
    "mobility-stability": "Improve joint mobility, stability, and movement quality for injury prevention.",
  };

  const programTypes = [{
    id: "cardio-endurance",
    title: "Cardio Endurance",
    description: "Structured program to build cardiovascular fitness",
    icon: Heart,
    level: "Beginner-Advanced",
    equipment: "Equipment/No Equipment"
  }, {
    id: "functional-strength",
    title: "Functional Strength",
    description: "Structured program for real-world strength and movement",
    icon: Dumbbell,
    level: "Beginner-Advanced",
    equipment: "Equipment/No Equipment"
  }, {
    id: "muscle-hypertrophy",
    title: "Muscle Hypertrophy",
    description: "Structured program focused on muscle growth",
    icon: Activity,
    level: "Beginner-Advanced",
    equipment: "Equipment/No Equipment"
  }, {
    id: "weight-loss",
    title: "Weight Loss",
    description: "Structured program designed for fat loss",
    icon: Flame,
    level: "Beginner-Advanced",
    equipment: "Equipment/No Equipment"
  }, {
    id: "low-back-pain",
    title: "Low Back Pain",
    description: "Structured program for pain relief",
    icon: User,
    level: "Beginner-Advanced",
    equipment: "Equipment/No Equipment"
  }, {
    id: "mobility-stability",
    title: "Mobility & Stability",
    description: "Structured program for movement quality",
    icon: Move,
    level: "Beginner-Advanced",
    equipment: "Equipment/No Equipment"
  }];

  const handleProgramSelect = (programId: string) => {
    navigate(`/trainingprogram/${programId}`);
  };

  const renderFeaturedProgramCard = (program: VisibleProgramMetadata, variant: "desktop" | "mobile") => {
    const slug = programCategoryToSlug(program.category);
    const image = program.image_url || programMobileImages[slug] || "/images/programs/functional-strength-card-mobile.jpg";
    const isDesktop = variant === "desktop";

    return (
      <button
        key={program.id}
        type="button"
        onClick={() => navigate(`/trainingprogram/${slug}/${program.id}`)}
        className={cn(
          "group flex h-[88px] items-stretch overflow-hidden rounded-xl bg-card text-left transition-all duration-300",
          isDesktop
            ? "border border-border hover:border-green-400 hover:shadow-lg"
            : "border-2 border-primary/40 hover:border-primary hover:shadow-xl"
        )}
      >
        <div className="relative h-full w-28 flex-shrink-0 overflow-hidden bg-muted">
          <img
            src={image}
            alt={program.name}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center p-3">
          <span className={cn(
            "text-[10px] font-semibold uppercase tracking-wider",
            isDesktop ? "text-green-400" : "text-primary"
          )}>
            {program.category}
          </span>
          <h3 className="mt-0.5 line-clamp-2 text-sm font-bold leading-tight text-foreground">{program.name}</h3>
          {(program.weeks || program.difficulty) && (
            <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">
              {[program.weeks ? `${program.weeks} weeks` : null, program.difficulty].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </button>
    );
  };

  return (
    <>
      <Helmet>
        <title>Training Programs | Strength & Weight Loss | SmartyGym</title>
        <meta name="description" content="Multi-week training programs for strength, weight loss, hypertrophy, endurance, mobility, and low back pain." />
        <meta name="keywords" content="training programs, online training programs, workout programs, muscle building program, weight loss program, strength training program, hypertrophy program, functional strength, cardio endurance program, online gym programs, Haris Falas, Sports Scientist, smartygym.com, HFSC, periodization, progressive overload, structured training" />
        <link rel="canonical" href="https://smartygym.com/trainingprogram" />
        
        <meta property="og:title" content="Training Programs | Expert Multi-Week Programs | SmartyGym" />
        <meta property="og:description" content="Expert-designed multi-week training programs for muscle building, weight loss, strength, and performance by Sports Scientist Haris Falas." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://smartygym.com/trainingprogram" />
        <meta property="og:image" content="https://smartygym.com/smarty-gym-logo.png" />
        <meta property="og:site_name" content="SmartyGym" />
        
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Training Programs | SmartyGym by Haris Falas" />
        <meta name="twitter:description" content="Expert training programs for all fitness goals - muscle building, weight loss, strength, endurance" />
        <meta name="twitter:image" content="https://smartygym.com/smarty-gym-logo.png" />
        
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": "SmartyGym Training Programs",
            "description": "Expert-designed multi-week training programs for muscle building, weight loss, functional strength, cardio endurance, mobility, and rehabilitation",
            "url": "https://smartygym.com/trainingprogram",
            "numberOfItems": 6,
            "mainEntity": {
              "@type": "ItemList",
              "name": "Training Program Categories",
              "itemListElement": [
                { "@type": "ListItem", "position": 1, "name": "Functional Strength Programs", "url": "https://smartygym.com/trainingprogram/functional-strength" },
                { "@type": "ListItem", "position": 2, "name": "Muscle Hypertrophy Programs", "url": "https://smartygym.com/trainingprogram/muscle-hypertrophy" },
                { "@type": "ListItem", "position": 3, "name": "Weight Loss Programs", "url": "https://smartygym.com/trainingprogram/weight-loss" },
                { "@type": "ListItem", "position": 4, "name": "Cardio Endurance Programs", "url": "https://smartygym.com/trainingprogram/cardio-endurance" },
                { "@type": "ListItem", "position": 5, "name": "Mobility & Stability Programs", "url": "https://smartygym.com/trainingprogram/mobility-stability" },
                { "@type": "ListItem", "position": 6, "name": "Low Back Pain Programs", "url": "https://smartygym.com/trainingprogram/low-back-pain" }
              ]
            },
            "author": { "@type": "Person", "name": "Haris Falas", "jobTitle": "Sports Scientist" },
            "provider": { "@type": "Organization", "name": "SmartyGym", "url": "https://smartygym.com" }
          })}
        </script>
        
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://smartygym.com" },
              { "@type": "ListItem", "position": 2, "name": "Training Programs", "item": "https://smartygym.com/trainingprogram" }
            ]
          })}
        </script>
      </Helmet>
      
      <SEOEnhancer 
        entities={["SmartyGym", "Haris Falas", "Training Programs", "Workout Programs", "Online Fitness"]}
        topics={["training programs", "muscle building", "weight loss", "strength training", "hypertrophy", "periodization", "progressive overload"]}
        expertise={["Sports Science", "Program Design", "Periodization", "Strength and Conditioning"]}
        contentType="program-library"
        aiSummary="SmartyGym Training Programs: Expert-designed multi-week structured programs by Sports Scientist Haris Falas. Categories include Functional Strength, Muscle Hypertrophy, Weight Loss, Cardio Endurance, Mobility & Stability, and Low Back Pain rehabilitation. All programs feature progressive periodization and evidence-based training principles."
        aiKeywords={["training programs", "workout programs", "muscle building", "hypertrophy program", "weight loss program", "strength programs", "online coaching", "fitness programs", "periodization", "progressive overload"]}
        relatedContent={["Workout Library", "Free Programs", "Premium Membership", "Fitness Calculators"]}
        targetAudience="athletes, bodybuilders, fitness enthusiasts, strength athletes, weight loss seekers"
        pageType="CollectionPage"
      />
      
      <div className="min-h-screen bg-background">
        <div className="container mx-auto max-w-6xl md:max-w-[1500px] px-4 md:px-6 pb-8">
          
          <PageBreadcrumbs items={[{
            label: "Home",
            href: "/"
          }, {
            label: "Smarty Programs"
          }]} />

        {/* Info Section - About Smarty Programs */}
        <DesktopPageIntro icon={Activity} title="Smarty Programs">
          <p className="font-bold text-foreground">
            <span className="text-primary font-semibold">Smarty Programs</span> are long-term, structured plans designed to help you achieve your specific fitness goals. Whether you want to lose weight, build muscle, improve functional strength, enhance cardiovascular endurance, rehabilitate from low back pain, or develop better mobility and stability — we have a science-based program for you. These aren't just random workouts — they're strategic, periodized plans that take you from where you are to where you want to be.
          </p>
          {!freeAccessMode && (
            <p className="font-semibold text-foreground">
              Unlock all <span className="text-primary font-bold">{totalProgramCount} programs</span> with a Premium plan or grab one standalone program to start your journey.
            </p>
          )}
        </DesktopPageIntro>

        <Card className="lg:hidden mb-8 bg-white dark:bg-card border-2 border-primary/40 shadow-primary">
          <div className="p-4 sm:p-5">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight uppercase mb-3 text-center">Smarty Programs</h1>
            <div className="space-y-2 text-muted-foreground max-w-3xl mx-auto">
            {isMobile ? (
                <p className="text-sm text-center">
                  <span className="text-primary font-semibold">Smarty Programs</span> are structured plans for your fitness goals.{!freeAccessMode && <> Unlock all <span className="text-primary font-bold">{totalProgramCount}</span> with Premium or grab one standalone.</>}
                </p>
              ) : (
                <>
                  <p className="text-sm sm:text-base text-center font-bold">
                    <span className="text-primary font-semibold">Smarty Programs</span> are long-term, structured plans designed to help you achieve your specific fitness goals. Whether you want to lose weight, build muscle, improve functional strength, enhance cardiovascular endurance, rehabilitate from low back pain, or develop better mobility and stability — we have a science-based program for you. These aren't just random workouts — they're strategic, periodized plans that take you from where you are to where you want to be.
                  </p>
                  
                  {!freeAccessMode && (
                    <p className="text-sm sm:text-base font-semibold text-foreground text-center mt-6">
                      Unlock all <span className="text-primary font-bold">{totalProgramCount} programs</span> with a Premium plan or grab one standalone program to start your journey.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </Card>

        {/* Desktop: Grid Layout - Stacked blog-card style */}
        <div className="hidden lg:grid lg:grid-cols-3 gap-4 sm:gap-6">
          {programTypes.map(program => {
            const Icon = program.icon;
            const mobileImage = programMobileImages[program.id];
            
            return (
              <ScrollReveal key={program.id}>
                <Card 
                  itemScope 
                  itemType="https://schema.org/Course" 
                  onClick={() => handleProgramSelect(program.id)} 
                  className="group cursor-pointer transition-all duration-500 ease-out transform-gpu hover:scale-105 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary/40 hover:border-primary/60 border-2 border-border overflow-hidden bg-card"
                  role="button" 
                  aria-label={`${program.title} training program - Online gym program at SmartyGym - smartygym.com by Haris Falas`} 
                  data-program-category={program.id} 
                  data-keywords="online gym training programs, workout training programs, smarty gym, online fitness programs, smartygym.com, Haris Falas"
                >
                  {/* Image Section */}
                  <div className="relative h-48 lg:h-52 overflow-hidden">
                    {mobileImage && (
                      <img
                        src={mobileImage}
                        alt=""
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    )}
                    {/* Counter Badge */}
                    <CategoryCountBadge count={programCounts[program.id] || 0} />
                  </div>

                  {/* Content Section */}
                  <div className="p-5 flex flex-col items-center text-center space-y-3">
                    <div className="relative w-14 h-14 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110" aria-hidden="true">
                      <div className="absolute inset-0 rounded-full bg-primary/10 pointer-events-none" aria-hidden="true" />
                      <Icon className="relative w-7 h-7 text-primary transition-transform duration-300 group-hover:rotate-3" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-2 text-foreground" itemProp="name">
                        {program.title}
                      </h3>
                      <p className="text-sm mb-3 text-muted-foreground" itemProp="description">
                        {program.description}
                      </p>
                      <p className="text-xs italic mb-3 text-muted-foreground/80">
                        Crafted by{" "}
                        <a href="/coach-profile" className="text-primary hover:underline font-medium whitespace-nowrap" itemProp="instructor" onClick={e => e.stopPropagation()}>
                          Haris Falas
                        </a>
                        {" "}BSc Sports Science, EXOS Specialist, CSCS
                      </p>
                      <div className="flex gap-1 text-[10px] mt-2">
                        <span className="bg-primary/20 text-primary border border-primary/40 px-1.5 py-0.5 rounded-full whitespace-nowrap" itemProp="duration">
                          4-8 weeks
                        </span>
                        <span className="bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/40 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                          {program.level}
                        </span>
                        <span className="bg-orange-500/20 text-orange-700 dark:text-orange-400 border border-orange-500/40 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                          {program.equipment}
                        </span>
                      </div>
                      <meta itemProp="provider" content="Smarty Gym - Online Gym - smartygym.com" />
                      <meta itemProp="courseMode" content="Online" />
                      <meta itemProp="availableLanguage" content="English" />
                    </div>
                  </div>
                </Card>
              </ScrollReveal>
            );
          })}
        </div>

        {/* Mobile: Dynamic Description Card */}
        <div className="lg:hidden mb-4">
          <Card className="bg-card border border-primary/20">
            <div className="p-4 text-center">
              <p className="text-sm text-muted-foreground transition-opacity duration-300">
                {programDescriptions[programTypes[currentSlide]?.id] || ""}
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
              {programTypes.map((program) => {
                const Icon = program.icon;
                const mobileImage = programMobileImages[program.id];
                
                return (
                  <CarouselItem key={program.id} className="pl-2 basis-[75%] sm:basis-[60%]">
                    <div
                      itemScope
                      itemType="https://schema.org/Course"
                      onClick={() => handleProgramSelect(program.id)}
                      className="smarty-carousel-card-portrait-tablet flex flex-col h-[300px] min-[540px]:h-[600px] bg-card border-2 border-green-500/60 rounded-xl overflow-hidden cursor-pointer hover:border-green-500 hover:scale-[1.02] hover:shadow-xl transition-all duration-300"
                      role="button"
                      aria-label={`${program.title} training program`}
                    >
                      {/* Image section */}
                      <div className="smarty-carousel-image-portrait-tablet relative h-[58%] min-[540px]:h-[72%] min-[540px]:aspect-auto overflow-hidden flex-shrink-0 bg-muted">
                        {mobileImage && (
                          <img 
                            src={mobileImage} 
                            alt={program.title}
                            loading="lazy"
                            className="w-full h-full object-cover object-[center_top] min-[540px]:object-contain"
                          />
                        )}
                        <div className="absolute top-2 right-2">
                          <CategoryCountBadge count={programCounts[program.id] || 0} size="sm" />
                        </div>
                      </div>
                      {/* Content section */}
                      <div className="smarty-carousel-content-portrait-tablet flex flex-col justify-center flex-1 px-3 py-3 min-[540px]:p-4 text-center">
                        <div className="smarty-carousel-title-row-portrait-tablet flex items-center justify-center gap-2 mb-1 min-[540px]:mb-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Icon className="w-4 h-4 text-primary" />
                          </div>
                          <h3 className="smarty-carousel-card-title m-0 min-h-0 min-w-0 text-sm min-[540px]:text-base font-bold text-foreground leading-tight line-clamp-2" itemProp="name">
                            {program.title}
                          </h3>
                        </div>
                        <p className="smarty-carousel-card-copy text-xs min-[540px]:text-sm text-muted-foreground leading-snug line-clamp-2 h-[2rem] min-h-0 min-[540px]:h-auto">
                          {programDescriptions[program.id] || program.description}
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
            {programTypes.map((_, index) => (
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

        {/* Desktop: Featured Training Programs (latest 3) — below the category grid */}
        {latestPrograms.length > 0 && (
          <div className="hidden lg:block mt-8">
            <div className="rounded-xl border-2 border-green-500/60 bg-green-500/[0.05] p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-extrabold tracking-tight text-green-400 uppercase">Featured Training Programs</span>
                <div className="h-px flex-1 bg-green-500/30" />
              </div>
              <div className="grid grid-cols-3 items-stretch gap-4">
                {latestPrograms.slice(0, 3).map((p) => renderFeaturedProgramCard(p, "desktop"))}
              </div>
            </div>
          </div>
        )}

        {/* Mobile: Featured Training Programs (latest 3) */}
        {latestPrograms.length > 0 && (
          <div className="lg:hidden mt-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-extrabold tracking-tight text-primary uppercase">Featured Training Programs</span>
              <div className="h-px flex-1 bg-primary/20" />
            </div>
            <div className="flex flex-col gap-3">
              {latestPrograms.map((p) => renderFeaturedProgramCard(p, "mobile"))}
            </div>
          </div>
        )}

        {/* Bottom Premium Banner */}
        {!isPremium && !freeAccessMode && (
          <ScrollReveal delay={600}>
            <div className="bg-card border border-border rounded-xl p-6 mt-8 text-center shadow-soft">
              <h3 className="text-xl font-semibold mb-2">Start your transformation</h3>
              <p className="text-muted-foreground mb-4">
                Join SmartyGym Premium for full access to all training programs.
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

export default TrainingProgramFlow;