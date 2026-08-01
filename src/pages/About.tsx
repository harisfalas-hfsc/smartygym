import { Helmet } from "react-helmet";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollReveal } from "@/components/ScrollReveal";
import { CheckCircle2, Target, Heart, Users, Shield, Award, Compass, GraduationCap, Plane, Dumbbell, UserCheck, Smartphone, Calendar, Video, Wrench, FileText, BookOpen, ChevronRight, Flame, Crown, Sparkles, Rocket } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import harisPhoto from "@/assets/haris-falas-coach.png";
import { useAccessControl } from "@/hooks/useAccessControl";
import { SEOEnhancer } from "@/components/SEOEnhancer";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { useState, useEffect, useRef } from "react";
import { DesktopAboutContent } from "@/components/home/DesktopAboutContent";

const About = () => {
  const navigate = useNavigate();
  const { user, userTier } = useAccessControl();
  const isPremium = userTier === "premium";
  const [activeAudienceTooltipMobile, setActiveAudienceTooltipMobile] = useState<string | null>(null);
  const audienceGridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeAudienceTooltipMobile) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (audienceGridRef.current && !audienceGridRef.current.contains(e.target as Node)) {
        setActiveAudienceTooltipMobile(null);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [activeAudienceTooltipMobile]);

  const audienceList = [
    { icon: Users, label: "Busy Adults", color: "text-blue-500", description: "Perfect for professionals juggling work and life. Get effective workouts that fit your schedule—no commute, no waiting for equipment. Train when you have time, not when the gym is open." },
    { icon: Heart, label: "Parents", color: "text-pink-500", description: "Train at home while kids nap or play nearby. No babysitter needed, no guilt about \"me time.\" Quick, focused sessions that work around your family's schedule." },
    { icon: GraduationCap, label: "Beginners", color: "text-emerald-500", description: "Start your fitness journey with confidence. Clear instructions, proper form guidance, and progressive programs designed to build your foundation safely." },
    { icon: Target, label: "Intermediate", color: "text-orange-500", description: "Break through plateaus with structured periodization. Challenge yourself with varied programming that keeps you progressing without the guesswork." },
    { icon: Plane, label: "Travelers", color: "text-cyan-500", description: "Stay consistent no matter where you are. Hotel room, Airbnb, or park—these workouts adapt to any space with minimal or no equipment needed." },
    { icon: Dumbbell, label: "Gym-Goers", color: "text-purple-500", description: "Enhance your gym routine with expert programming. Follow structured plans that maximize your gym time and ensure balanced, progressive training." },
  ];

  return (
    <>
      <Helmet>
        <title>About SmartyGym | Science-Based Online Fitness</title>
        <meta name="description" content="Learn about SmartyGym - Your leading online fitness platform. Science-based workouts, expert coaching by Haris Falas, and accessible training for everyone, anywhere." />
        <meta name="keywords" content="about smartygym, online fitness platform, science-based training, haris falas, online personal training, functional workouts, home gym" />
        
        {/* Open Graph */}
        <meta property="og:title" content="About SmartyGym - Your Online Gym Re-imagined" />
        <meta property="og:description" content="Discover how SmartyGym makes quality fitness accessible to everyone with science-based workouts and expert coaching." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://smartygym.com/about" />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="About SmartyGym - Online Fitness Platform" />
        <meta name="twitter:description" content="Science-based workouts and expert coaching by certified coach Haris Falas." />
        
        {/* Canonical URL */}
        <link rel="canonical" href="https://smartygym.com/about" />
        
        {/* Structured Data - Organization */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "SmartyGym",
            "url": "https://smartygym.com",
            "logo": "https://smartygym.com/smarty-gym-logo.png",
            "description": "Online fitness platform providing science-based workouts and training programs designed by certified coach Haris Falas",
            "founder": {
              "@type": "Person",
              "name": "Haris Falas",
              "jobTitle": "Sports Scientist & Strength & Conditioning Coach"
            },
            "areaServed": "Worldwide",
            "sameAs": [
              "https://www.instagram.com/smartygym",
              "https://www.facebook.com/smartygym"
            ]
          })}
        </script>
        
        {/* Breadcrumb Schema */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              {
                "@type": "ListItem",
                "position": 1,
                "name": "Home",
                "item": "https://smartygym.com"
              },
              {
                "@type": "ListItem",
                "position": 2,
                "name": "About",
                "item": "https://smartygym.com/about"
              }
            ]
          })}
        </script>
      </Helmet>

      <SEOEnhancer
        entities={["About SmartyGym", "Company Information", "Our Mission", "Haris Falas"]}
        topics={["company background", "fitness mission", "online gym platform", "expert coaching"]}
        expertise={["platform development", "fitness coaching", "sports science"]}
        contentType="About Page"
        aiSummary="About SmartyGym: Global online fitness platform founded by Sports Scientist Haris Falas. Science-based workouts, accessible training, and 100% human-designed programs. Your gym reimagined for real life."
        aiKeywords={["about smartygym", "online fitness platform", "haris falas", "fitness mission", "company background", "gym platform"]}
        relatedContent={["Coach Profile", "FAQ", "Contact", "Premium Membership"]}
        targetAudience="users learning about the platform"
        pageType="AboutPage"
      />

      <div className="min-h-screen bg-background">
        <div className="container mx-auto max-w-6xl md:max-w-[1500px] px-4 md:px-6 pb-8">
          
          <PageBreadcrumbs items={[
            { label: "Home", href: "/" },
            { label: "About" }
          ]} />

          {/* Desktop: mirror the homepage content from "Your Gym Re-imagined" and below */}
          <div className="hidden md:block">
            <DesktopAboutContent showPremiumCta />
          </div>

          {/* Mobile-only About content (desktop untouched by this wrapper) */}
          <div className="md:hidden">
          {/* Hero Section (desktop only) */}
          <ScrollReveal>
            <div className="mb-8 text-center">
              <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight uppercase mb-4 text-foreground leading-tight">
                About <span className="text-primary">SmartyGym</span>
              </h1>
            </div>
          </ScrollReveal>

          {/* Cards (mobile layout, also used on desktop) */}
          <div className="space-y-6 mb-12">
            <Card className="border-2 border-primary">
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <Target className="w-12 h-12 text-primary mx-auto" />
                  <h2 className="text-2xl font-bold text-foreground">
                    Anywhere, Anytime.
                  </h2>
                  {/* Mobile: vertical list */}
                  <div className="space-y-3 text-left md:hidden">
                    {[
                      { icon: Flame, color: "text-red-500", label: "Workout of the Day", to: "/workout/wod" },
                      { icon: Dumbbell, color: "text-orange-500", label: "Expert-Crafted Workouts", to: "/workout" },
                      { icon: Calendar, color: "text-blue-500", label: "Structured Training Programs", to: "/trainingprogram" },
                      { icon: Sparkles, color: "text-yellow-500", label: "Smarty Ritual", to: "/daily-ritual" },
                      { icon: Video, color: "text-emerald-500", label: "Exercise Library", to: "/exerciselibrary" },
                      { icon: Wrench, color: "text-purple-500", label: "Smarty Tools", to: "/tools" },
                      { icon: FileText, color: "text-cyan-500", label: "Articles", to: "/blog" },
                      { icon: BookOpen, color: "text-pink-500", label: "LogBook", to: "/userdashboard?tab=logbook" },
                    ].map(({ icon: Icon, color, label, to }) => (
                      <div key={label} className="flex items-center gap-3 cursor-pointer active:opacity-70" onClick={() => navigate(to)}>
                        <Icon className={`w-6 h-6 ${color} flex-shrink-0`} />
                        <span className="text-sm font-semibold text-primary hover:underline">{label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Desktop: 4×2 grid of bordered tiles */}
                  <div className="hidden md:grid grid-cols-4 gap-4">
                    {[
                      { icon: Flame, color: "text-red-500", label: "Workout of the Day", to: "/workout/wod" },
                      { icon: Dumbbell, color: "text-orange-500", label: "Expert-Crafted Workouts", to: "/workout" },
                      { icon: Calendar, color: "text-blue-500", label: "Structured Training Programs", to: "/trainingprogram" },
                      { icon: Sparkles, color: "text-yellow-500", label: "Smarty Ritual", to: "/daily-ritual" },
                      { icon: Video, color: "text-emerald-500", label: "Exercise Library", to: "/exerciselibrary" },
                      { icon: Wrench, color: "text-purple-500", label: "Smarty Tools", to: "/tools" },
                      { icon: FileText, color: "text-cyan-500", label: "Articles", to: "/blog" },
                      { icon: BookOpen, color: "text-pink-500", label: "LogBook", to: "/userdashboard?tab=logbook" },
                    ].map(({ icon: Icon, color, label, to }) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => navigate(to)}
                        className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-border bg-card hover:border-primary hover:bg-primary/5 transition-all group"
                      >
                        <Icon className={`w-12 h-12 ${color} group-hover:scale-110 transition-transform`} />
                        <span className="text-xs font-semibold text-foreground text-center leading-tight">{label}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-base text-muted-foreground text-center leading-relaxed">
                    Everything a complete gym must offer, built by real professionals, in your pocket at <strong className="text-primary">smartygym.com</strong>.
                  </p>
                  {!isPremium && (
                    <Link
                      to="/smarty-premium"
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-500 hover:text-green-600 hover:underline md:hidden"
                    >
                      <Crown className="w-4 h-4" />
                      Unlock everything with Premium
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary">
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <Smartphone className="w-12 h-12 text-primary mx-auto" />
                  <h2 className="text-2xl font-bold text-foreground">
                    Who Is <span className="text-primary">SmartyGym</span> For
                  </h2>
                  <div ref={audienceGridRef} className="grid grid-cols-3 md:grid-cols-6 gap-3">
                    {audienceList.map((audience) => {
                      const Icon = audience.icon;
                      return (
                        <Tooltip key={audience.label} open={activeAudienceTooltipMobile === audience.label}>
                          <TooltipTrigger asChild>
                            <div
                              className="flex flex-col items-center gap-1 cursor-pointer"
                              onClick={() => setActiveAudienceTooltipMobile(activeAudienceTooltipMobile === audience.label ? null : audience.label)}
                            >
                              <Icon className={`w-7 h-7 ${audience.color}`} />
                              <span className="text-xs font-bold text-foreground text-center">{audience.label}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs text-center">
                            {audience.description}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                  <div className="pt-4 space-y-2">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      We are not here to replace your gym. We are here to back you up when life gets in the way.
                    </p>
                    <p className="text-sm font-semibold text-primary">
                      Wherever you are, your gym comes with you.
                    </p>
                  </div>
                  <Link 
                    to="/why-invest-in-smartygym" 
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-500 hover:text-green-600 hover:underline"
                  >
                    Why Invest in SmartyGym
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Core Values - compact card (mobile only) */}
          <Card className="mb-12 border-2 border-primary md:hidden">
            <CardContent className="p-6">
              <div className="text-center space-y-4">
                <h2 className="text-2xl font-bold text-foreground">What We Stand For</h2>
                <div className="space-y-3 text-left">
                  <div className="flex items-center gap-3">
                    <UserCheck className="w-6 h-6 text-red-500 flex-shrink-0" />
                    <span className="text-sm font-semibold text-foreground">100% Human. 0% AI.</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Heart className="w-6 h-6 text-orange-500 flex-shrink-0" />
                    <span className="text-sm font-semibold text-foreground">Built for Real Life</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Award className="w-6 h-6 text-purple-500 flex-shrink-0" />
                    <span className="text-sm font-semibold text-foreground">Science-Based Approach</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Users className="w-6 h-6 text-emerald-500 flex-shrink-0" />
                    <span className="text-sm font-semibold text-foreground">Accessible to Everyone</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Shield className="w-6 h-6 text-blue-500 flex-shrink-0" />
                    <span className="text-sm font-semibold text-foreground">Safe and Effective</span>
                  </div>
                  </div>
                   <Link to="/the-smarty-method" className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-500 hover:text-green-600 hover:underline mt-2">
                     <BookOpen className="w-4 h-4" />
                     Discover The Smarty Method
                     <ChevronRight className="w-4 h-4" />
                   </Link>
                 </div>
               </CardContent>
             </Card>

           {/* Premium CTA card (mobile only) */}
           <Card
             role="button"
             tabIndex={0}
             onClick={() => navigate('/smarty-premium')}
             onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/smarty-premium'); }}
             className="mb-12 border-2 border-primary md:hidden cursor-pointer active:opacity-80 hover:bg-primary/5 transition-colors"
           >
             <CardContent className="p-6">
               <div className="text-center space-y-3">
                 <Crown className="w-12 h-12 text-primary mx-auto" />
                 <h2 className="text-2xl font-bold text-foreground">Get the Full Experience</h2>
                 <p className="text-sm text-muted-foreground leading-relaxed">
                   Every workout, program, ritual and tool — designed 100% by humans. €9.99/month, cancel anytime.
                 </p>
                 <p className="text-3xl font-extrabold text-primary">€9.99<span className="text-lg font-medium text-muted-foreground">/month</span></p>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-500">
                    Unlock Smarty Premium
                    <ChevronRight className="w-4 h-4" />
                  </span>
               </div>
             </CardContent>
           </Card>

          {/* Core Values - Desktop grid with descriptions */}
          <ScrollReveal>
            <section className="mb-12 hidden md:block">
              <div className="text-center mb-6 pb-3 border-b border-border">
                <p className="text-xs uppercase tracking-[0.25em] text-primary font-semibold mb-1">Principles</p>
                <h2 className="text-2xl md:text-3xl font-bold">What We Stand For</h2>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="border-2 border-border hover:border-primary transition-all group">
                  <CardContent className="p-6 text-center space-y-3">
                    <Heart className="w-10 h-10 text-orange-500 group-hover:scale-110 transition-transform mx-auto" />
                    <h3 className="font-bold text-lg">Built for Real Life</h3>
                    <p className="text-sm text-muted-foreground">
                      Flexible training that fits your schedule, location, and lifestyle — not the other way around.
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-2 border-border hover:border-primary transition-all group">
                  <CardContent className="p-6 text-center space-y-3">
                    <Award className="w-10 h-10 text-purple-500 group-hover:scale-110 transition-transform mx-auto" />
                    <h3 className="font-bold text-lg">Science-Based Approach</h3>
                    <p className="text-sm text-muted-foreground">
                      Every workout is designed using evidence-based training principles, not trends or fads.
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-2 border-border hover:border-primary transition-all group">
                  <CardContent className="p-6 text-center space-y-3">
                    <Users className="w-10 h-10 text-emerald-500 group-hover:scale-110 transition-transform mx-auto" />
                    <h3 className="font-bold text-lg">Accessible to Everyone</h3>
                    <p className="text-sm text-muted-foreground">
                      From beginners to advanced athletes, everyone deserves access to quality fitness guidance.
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-2 border-border hover:border-primary transition-all group">
                  <CardContent className="p-6 text-center space-y-3">
                    <Shield className="w-10 h-10 text-blue-500 group-hover:scale-110 transition-transform mx-auto" />
                    <h3 className="font-bold text-lg">Safe and Effective</h3>
                    <p className="text-sm text-muted-foreground">
                      Proper technique, realistic progressions, and injury prevention are at the core of everything we do.
                    </p>
                  </CardContent>
                </Card>
              </div>
              <div className="text-center mt-6">
                <Link to="/the-smarty-method" className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-500 hover:text-green-600 hover:underline">
                  <BookOpen className="w-4 h-4" />
                  Discover The Smarty Method
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </section>
          </ScrollReveal>

          {/* Meet the Coach Card (mobile + desktop) */}
          <Card className="mb-12 border-2 border-primary">
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <h2 className="text-2xl font-bold text-foreground">Meet the Coach</h2>
                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-primary/30 flex-shrink-0">
                  <img 
                    src={harisPhoto} 
                    alt="Haris Falas - Head Coach" 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-primary">Message from Haris Falas</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    For more than twenty years, I've coached athletes, teams, and everyday people — helping them move better, train smarter, and build lasting fitness habits.
                  </p>
                </div>
                <Link 
                  to="/coach-profile" 
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                >
                  Read More
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* The SmartyGym Promise */}
          <ScrollReveal>
            <Card className="mb-12 border-2 border-green-500 md:border-border bg-primary/5">
              <CardContent className="p-8 lg:p-10">
                <div className="space-y-8">
                  <div className="text-center">
                    <div className="hidden md:inline-flex w-14 h-14 rounded-xl bg-primary/15 items-center justify-center mb-3">
                      <Compass className="w-7 h-7 text-primary" />
                    </div>
                    <p className="text-xs uppercase tracking-[0.25em] text-primary font-semibold mb-1">Our commitment</p>
                    <h2 className="text-2xl md:text-3xl font-bold text-foreground">The <span className="text-primary">SmartyGym</span> Promise</h2>
                  </div>

                  <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 text-center">
                    
                    <div className="space-y-2">
                      <GraduationCap className="w-8 h-8 text-primary mx-auto" />
                      <h3 className="font-bold">Real Expertise</h3>
                      <p className="text-sm text-muted-foreground">
                        Every program is designed by certified coach <a href="/coach-profile" className="text-primary hover:underline font-medium">Haris Falas</a> — never by AI, always with 20+ years of experience.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Heart className="w-8 h-8 text-primary mx-auto" />
                      <h3 className="font-bold">Personal Touch</h3>
                      <p className="text-sm text-muted-foreground">
                        Direct access to the coach who created your program. Real support, real guidance, real results.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <UserCheck className="w-8 h-8 text-primary mx-auto" />
                      <h3 className="font-bold">Not a Robot</h3>
                      <p className="text-sm text-muted-foreground">
                        We don't generate workouts with algorithms. We design them with care, experience, and your goals in mind.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Rocket className="w-8 h-8 text-primary mx-auto" />
                      <h3 className="font-bold">Never Stop Expanding</h3>
                      <p className="text-sm text-muted-foreground">
                        New workouts, programs, tools, and articles — keeping you current with the latest science and trends.
                      </p>
                    </div>

                  </div>

                </div>
              </CardContent>
            </Card>
          </ScrollReveal>


          {/* Ready to Start Your Journey */}
          <ScrollReveal>
            <Card className="mb-12 border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-background">
              <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2 text-xl md:text-2xl whitespace-nowrap">
                <Crown className="h-5 w-5 text-primary flex-shrink-0" />
                Ready to Start Your Journey
              </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground text-center max-w-3xl mx-auto">
                  One simple membership unlocks every workout, program, ritual and tool —
                  designed 100% by humans, no AI guesswork.
                </p>
                <div className="max-w-md mx-auto">
                  <button
                    type="button"
                    onClick={() => navigate(isPremium ? "/userdashboard" : "/smarty-premium")}
                    className="w-full text-left p-6 rounded-lg border-2 border-primary shadow-lg bg-gradient-to-br from-primary/10 to-background transition-all hover:shadow-xl hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 cursor-pointer"
                    aria-label={isPremium ? "Go to your dashboard" : "View Smarty Premium"}
                  >
                    <div className="text-center space-y-3">
                      <div className="flex items-center justify-center gap-2">
                        <Crown className="h-6 w-6 text-primary" />
                        <h4 className="text-2xl font-bold">Smarty Premium</h4>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Full access to every workout, program, ritual and tool.
                      </p>
                      <div className="text-sm font-semibold text-primary flex items-center justify-center gap-1">
                        {isPremium ? "✓ Included in your plan" : (<>See plans &amp; pricing <ChevronRight className="h-4 w-4" /></>)}
                      </div>
                    </div>
                  </button>
                </div>
              </CardContent>
            </Card>
          </ScrollReveal>

          </div>
        </div>
      </div>
    </>
  );
};

export default About;
