import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { Calculator, Activity, Flame, Timer, Search, Hash } from "lucide-react";

import { useAccessControl } from "@/hooks/useAccessControl";
import { SEOEnhancer } from "@/components/SEOEnhancer";
import { generateToolWebApplicationSchema, generateSpeakableSchema } from "@/utils/seoSchemas";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";
import { SwipeToExplore } from "@/components/ui/SwipeToExplore";

// Import tool background images
import oneRmBg from "@/assets/tools/1rm-calculator-bg.jpg";
import bmrBg from "@/assets/tools/bmr-calculator-bg.jpg";
import macroBg from "@/assets/tools/macro-calculator-bg.jpg";
import timerBg from "@/assets/tools/workout-timer-bg.jpg";
import calorieBg from "@/assets/tools/calorie-counter-bg.jpg";
import roundsBg from "@/assets/tools/rounds-tracker-bg.jpg";

// Mobile card images
import oneRmCardMobile from "@/assets/tools/1rm-card-mobile.jpg";
import bmrCardMobile from "@/assets/tools/bmr-card-mobile.jpg";
import macroCardMobile from "@/assets/tools/macro-card-mobile.jpg";
import timerCardMobile from "@/assets/tools/timer-card-mobile.jpg";
import calorieCardMobile from "@/assets/tools/calorie-card-mobile.jpg";

const Tools = () => {
  const navigate = useNavigate();
  
  const { userTier } = useAccessControl();
  const isPremium = userTier === "premium";

  const [toolsCarouselApi, setToolsCarouselApi] = useState<CarouselApi>();
  const [toolsCurrentSlide, setToolsCurrentSlide] = useState(0);

  useEffect(() => {
    if (!toolsCarouselApi) return;
    const onSelect = () => setToolsCurrentSlide(toolsCarouselApi.selectedScrollSnap());
    toolsCarouselApi.on('select', onSelect);
    return () => { toolsCarouselApi.off('select', onSelect); };
  }, [toolsCarouselApi]);

  const tools = [
    {
      id: "workout-timer",
      icon: Timer,
      title: "Workout Timer",
      description: "Customizable interval timer for HIIT, Tabata, and circuit training sessions",
      route: "/tools/workout-timer",
      image: timerBg,
      mobileImage: timerCardMobile
    },
    {
      id: "rounds-tracker",
      icon: Hash,
      title: "Rounds Tracker",
      description: "Big-button counter — tap to track rounds and optional reps during your workout",
      route: "/tools/rounds-tracker",
      image: roundsBg,
      mobileImage: roundsBg
    },
    {
      id: "1rm-calculator",
      icon: Calculator,
      title: "1RM Calculator",
      description: "Calculate your one-rep maximum for any exercise",
      route: "/tools/1rm-calculator",
      image: oneRmBg,
      mobileImage: oneRmCardMobile
    },
    {
      id: "bmr-calculator",
      icon: Activity,
      title: "BMR Calculator",
      description: "Calculate your basal metabolic rate using the Mifflin-St Jeor formula",
      route: "/tools/bmr-calculator",
      image: bmrBg,
      mobileImage: bmrCardMobile
    },
    {
      id: "macro-calculator",
      icon: Flame,
      title: "Macro Tracking Calculator",
      description: "Get personalized nutrition and macro recommendations",
      route: "/tools/macro-calculator",
      image: macroBg,
      mobileImage: macroCardMobile
    },
    {
      id: "calorie-counter",
      icon: Search,
      title: "Calorie Counter",
      description: "Search any food and instantly see calories and macros per serving",
      route: "/tools/calorie-counter",
      image: calorieBg,
      mobileImage: calorieCardMobile
    }
  ];

  return (
    <>
      <Helmet>
        <title>Smarty Tools | Free Fitness Calculators | SmartyGym</title>
        <meta name="description" content="Free fitness calculators by Sports Scientist Haris Falas: 1RM, BMR, Macro Tracking, and Calorie Counter. Plan strength and nutrition at smartygym.com." />
        <link rel="canonical" href="https://smartygym.com/tools" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://smartygym.com/tools" />
        <meta property="og:title" content="Smarty Tools | Free Fitness Calculators | SmartyGym" />
        <meta property="og:description" content="Free 1RM, BMR, Macro, and Calorie tools by Sports Scientist Haris Falas. Plan strength and nutrition at smartygym.com." />
        <meta name="keywords" content="fitness calculators, gym calculators, 1RM calculator, BMR calculator, personal trainer tools, online gym, fitness tools, HFSC, Haris Falas, Sports Scientist, fitness tools online, gym training tools, macro calculator, strength calculator, nutrition calculator, smartygym.com, HFSC Performance, workout planning tools" />
        
        {/* Greek Language */}
        <link rel="alternate" hrefLang="el" href="https://smartygym.com/tools" />
        <link rel="alternate" hrefLang="en-GB" href="https://smartygym.com/tools" />

        {/* WebApplication schemas — one per tool, AI/Google rich-result ready */}
        <script type="application/ld+json">{JSON.stringify(generateToolWebApplicationSchema({
          name: "1RM Calculator",
          description: "Free One Rep Max calculator by Sports Scientist Haris Falas. Estimate your 1RM using validated strength formulas (Epley, Brzycki, Lombardi).",
          url: "/tools/1rm-calculator",
          keywords: ["1RM calculator", "one rep max", "strength calculator", "Epley formula", "Brzycki formula", "Haris Falas", "SmartyGym"]
        }))}</script>
        <script type="application/ld+json">{JSON.stringify(generateToolWebApplicationSchema({
          name: "BMR Calculator",
          description: "Free Basal Metabolic Rate calculator by Sports Scientist Haris Falas. Mifflin-St Jeor formula for accurate daily calorie needs.",
          url: "/tools/bmr-calculator",
          keywords: ["BMR calculator", "basal metabolic rate", "TDEE", "calorie calculator", "Mifflin-St Jeor", "Haris Falas", "SmartyGym"]
        }))}</script>
        <script type="application/ld+json">{JSON.stringify(generateToolWebApplicationSchema({
          name: "Macro Tracking Calculator",
          description: "Free macronutrient calculator by Sports Scientist Haris Falas. Personalized protein, carbs, and fat targets for weight loss, maintenance, or muscle gain.",
          url: "/tools/macro-calculator",
          keywords: ["macro calculator", "macronutrient calculator", "protein calculator", "nutrition planning", "Haris Falas", "SmartyGym"]
        }))}</script>
        <script type="application/ld+json">{JSON.stringify(generateToolWebApplicationSchema({
          name: "Calorie Counter",
          description: "Free calorie and macro food search tool by SmartyGym. Look up any food and instantly see calories, protein, carbs, and fat per serving.",
          url: "/tools/calorie-counter",
          keywords: ["calorie counter", "food calorie lookup", "macro tracking", "USDA food database", "Haris Falas", "SmartyGym"]
        }))}</script>
        <script type="application/ld+json">{JSON.stringify(generateToolWebApplicationSchema({
          name: "Rounds Tracker",
          description: "Free big-button rounds and reps counter by SmartyGym. Tap anywhere to count rounds and optional reps during AMRAP, EMOM, and circuit workouts.",
          url: "/tools/rounds-tracker",
          keywords: ["rounds tracker", "rep counter", "AMRAP counter", "tally counter workout", "SmartyGym"]
        }))}</script>
        <script type="application/ld+json">{JSON.stringify(generateSpeakableSchema())}</script>
      </Helmet>
      
      <SEOEnhancer
        entities={["SmartyGym", "Haris Falas", "Fitness Calculators", "1RM Calculator", "BMR Calculator"]}
        topics={["fitness tools", "1RM calculator", "BMR calculator", "macro calculator", "strength planning", "nutrition planning"]}
        expertise={["sports science", "exercise physiology", "nutrition science"]}
        contentType="tool-collection"
        aiSummary="Free online fitness calculators at SmartyGym by Sports Scientist Haris Falas. 1RM, BMR, and Macro calculators for professional training planning."
        aiKeywords={["fitness calculators", "1RM calculator", "BMR calculator", "macro calculator", "training tools", "nutrition tools"]}
        relatedContent={["workouts", "training programs", "nutrition guidance"]}
      />
      
      <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-6xl md:max-w-[1500px] px-4 md:px-6 pb-8">
        <PageBreadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Tools" }
          ]} 
        />

        {/* Info Section */}
        <Card className="mb-8 bg-white dark:bg-card border-2 border-primary/40 shadow-primary">
          <div className="p-5">
            <h2 className="text-2xl font-extrabold tracking-tight uppercase mb-3 text-center">Smarty Tools</h2>
            <div className="text-muted-foreground w-full mx-auto">
              <p className="text-sm sm:text-base text-center font-bold max-w-3xl mx-auto">
                <span className="text-primary font-semibold">Smarty Tools</span> are fitness calculators to understand your body and optimize training using validated formulas.
              </p>
              <p className="text-sm sm:text-base text-center font-semibold text-foreground mt-2 max-w-3xl mx-auto">
                Use all <span className="text-primary font-bold">{tools.length} tools</span> — completely free, no signup required.
              </p>
              {/* Desktop only - detailed calculator descriptions */}
              <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-6 gap-x-8 gap-y-6 mt-6 w-full items-start">
                <div className="min-w-0 text-center">
                  <h3 className="font-semibold text-foreground mb-2"><span className="text-primary font-semibold">Workout Timer</span></h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Set up custom work and rest intervals for any training style. Choose from HIIT, Tabata, EMOM, or circuit protocols and let the timer guide every round so you stay focused on form, not the clock.
                  </p>
                </div>
                <div className="min-w-0 text-center">
                  <h3 className="font-semibold text-foreground mb-2"><span className="text-primary font-semibold">Rounds Tracker</span></h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    A big-button tap counter that logs every round and optional reps in a single touch. Ideal for AMRAP, EMOM, and circuit sessions where you need to stay moving without losing count.
                  </p>
                </div>
                <div className="min-w-0 text-center">
                  <h3 className="font-semibold text-foreground mb-2"><span className="text-primary font-semibold">1RM Calculator</span></h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Estimate your true one-rep maximum using the validated Brzycki formula from any submaximal set. Essential for programming strength blocks, percentage-based work, and tracking long-term progress safely.
                  </p>
                </div>
                <div className="min-w-0 text-center">
                  <h3 className="font-semibold text-foreground mb-2"><span className="text-primary font-semibold">BMR Calculator</span></h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Calculate the calories your body burns at complete rest using the Mifflin-St Jeor equation, the gold standard in clinical nutrition. The foundation for any cut, bulk, or maintenance plan you build.
                  </p>
                </div>
                <div className="min-w-0 text-center">
                  <h3 className="font-semibold text-foreground mb-2"><span className="text-primary font-semibold">Macro Calculator</span></h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Get a complete nutrition blueprint tailored to your goal, including daily calories, protein, carbs, fats, fiber, water intake, and recommended meal frequency. Everything you need to eat with intention every day.
                  </p>
                </div>
                <div className="min-w-0 text-center">
                  <h3 className="font-semibold text-foreground mb-2"><span className="text-primary font-semibold">Calorie Counter</span></h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Search over 300,000 foods from the USDA database and instantly see calories, protein, carbs, fat, and fiber per serving. Log meals on the fly and keep your daily nutrition honest and accurate.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Mobile Carousel - With descriptions in cards */}
        <div className="lg:hidden">
          <SwipeToExplore onPrev={() => toolsCarouselApi?.scrollPrev()} onNext={() => toolsCarouselApi?.scrollNext()} />
          <Carousel 
            setApi={setToolsCarouselApi}
            opts={{ align: "center", loop: true, startIndex: 0 }}
            className="w-full"
          >
            <CarouselContent className="-ml-2">
              {tools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <CarouselItem key={tool.id} className="pl-2 basis-[75%] sm:basis-[60%]">
                    <div
                      onClick={() => navigate(tool.route)}
                      className="smarty-carousel-card-portrait-tablet flex flex-col h-[300px] min-[540px]:h-[600px] bg-card border-2 border-green-500/60 rounded-xl overflow-hidden cursor-pointer hover:border-green-500 hover:scale-[1.02] hover:shadow-xl transition-all duration-300"
                    >
                      {/* Image section */}
                      <div className="smarty-carousel-image-portrait-tablet relative h-[58%] min-[540px]:h-[72%] min-[540px]:aspect-auto overflow-hidden flex-shrink-0 bg-muted">
                        <img 
                          src={tool.mobileImage} 
                          alt={tool.title}
                          loading="lazy"
                          className="w-full h-full object-cover object-center"
                        />
                      </div>
                      {/* Content section */}
                      <div className="smarty-carousel-content-portrait-tablet flex flex-col justify-center flex-1 px-3 py-3 min-[540px]:p-4 text-center">
                        <div className="smarty-carousel-title-row-portrait-tablet flex items-center justify-center gap-2 mb-1 min-[540px]:mb-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Icon className="w-4 h-4 text-primary" />
                          </div>
                          <h3 className="smarty-carousel-card-title m-0 min-h-0 min-w-0 text-sm min-[540px]:text-base font-bold text-foreground leading-tight line-clamp-2">
                            {tool.title}
                          </h3>
                        </div>
                        <p className="smarty-carousel-card-copy text-xs min-[540px]:text-sm text-muted-foreground leading-snug line-clamp-2 h-[2rem] min-h-0 min-[540px]:h-auto">
                          {tool.description}
                        </p>
                      </div>
                    </div>
                  </CarouselItem>
                );
              })}
            </CarouselContent>
            <CarouselPrevious className="hidden" />
            <CarouselNext className="hidden" />
          </Carousel>
          {/* Navigation dots */}
          <div className="flex justify-center gap-2 mt-4">
            {tools.map((_, index) => (
              <button
                key={index}
                onClick={() => toolsCarouselApi?.scrollTo(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  toolsCurrentSlide === index ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Desktop Grid - Big timer card + 4 smaller cards */}
        <div className="hidden lg:block space-y-4">
          {/* Big Workout Timer Card */}
          {(() => {
            const timerTool = tools.find(t => t.id === "workout-timer");
            if (!timerTool) return null;
            const Icon = timerTool.icon;
            return (
              <div
                onClick={() => navigate(timerTool.route)}
                className="group relative h-72 rounded-xl overflow-hidden cursor-pointer transition-all duration-500 ease-out transform-gpu hover:scale-[1.02] hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/40 hover:z-10"
              >
                <img 
                  src={timerTool.image} 
                  alt={timerTool.title}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/20 group-hover:from-black/95 transition-all duration-300" />
                <div className="relative h-full flex flex-col justify-end p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-2xl font-bold text-white">{timerTool.title}</h3>
                    <div className="w-12 h-12 rounded-full bg-background/90 flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                  <p className="text-sm text-white/80 max-w-xl">{timerTool.description}</p>
                </div>
              </div>
            );
          })()}

          {/* Smaller Cards — single row alongside the big timer above */}
          <div className="grid grid-cols-5 gap-4">
            {tools.filter(t => t.id !== "workout-timer").map((tool) => {
              const Icon = tool.icon;
              return (
                <div
                  key={tool.id}
                  onClick={() => navigate(tool.route)}
                  className="group relative h-64 rounded-xl overflow-hidden cursor-pointer transition-all duration-500 ease-out transform-gpu hover:scale-[1.08] hover:-translate-y-3 hover:shadow-2xl hover:shadow-primary/40 hover:z-10"
                >
                  <img 
                    src={tool.mobileImage} 
                    alt={tool.title}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/20 group-hover:from-black/95 transition-all duration-300" />
                  <div className="relative h-full flex flex-col justify-end p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-base font-semibold text-white truncate mr-2">{tool.title}</h3>
                      <div className="w-9 h-9 rounded-full bg-background/90 flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                    </div>
                    <p className="text-xs text-white/80 line-clamp-2 min-h-[2.5rem]">{tool.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      </div>
    </>
  );
};

export default Tools;
