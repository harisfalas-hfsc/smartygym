import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Sunrise, Sun, Moon, Share2, Lock, Crown, Loader2, BookOpen, Clock, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAccessControl } from "@/hooks/useAccessControl";

import { HTMLContent } from "@/components/HTMLContent";

import { RitualShareDialog } from "@/components/ritual/RitualShareDialog";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { DesktopPageIntro } from "@/components/DesktopPageIntro";
import { SEOEnhancer } from "@/components/SEOEnhancer";
import { ReaderModeDialog } from "@/components/ReaderModeDialog";

interface DailyRitual {
  id: string;
  ritual_date: string;
  day_number: number;
  morning_content: string;
  midday_content: string;
  evening_content: string;
}

const DailySmartyRitual = () => {
  const navigate = useNavigate();
  const { userTier, isLoading: accessLoading } = useAccessControl();
  
  
  const [ritual, setRitual] = useState<DailyRitual | null>(null);
  const [loading, setLoading] = useState(true);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showReaderMode, setShowReaderMode] = useState(false);

  const isAuthenticated = userTier !== "guest";
  const isPremium = userTier === "premium";

  // Today in Cyprus timezone — used for display so the page always shows the real
  // current date, never the library row's original `ritual_date`.
  const todayCyprus = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Nicosia" })
  )
    .toISOString()
    .split("T")[0];

  // Fetch ritual - rituals are generated at 00:05 Cyprus time and available immediately
  useEffect(() => {
    const fetchRitual = async () => {
      try {
        // Get today's date in Cyprus timezone
        const now = new Date();
        const cyprusTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Nicosia" }));
        const today = cyprusTime.toISOString().split('T')[0];

        // Today's ritual is selected from the library by daily_ritual_assignments
        // (rotation through all 180 rituals, random within each cycle).
        const { data: assignment } = await supabase
          .from("daily_ritual_assignments")
          .select("ritual_id, daily_smarty_rituals(*)")
          .eq("ritual_date", today)
          .maybeSingle();

        const data = (assignment?.daily_smarty_rituals ?? null) as DailyRitual | null;

        if (!data) {
          // For non-premium users, RLS blocks the data but ritual likely exists
          // Non-premium users should see the locked premium card instead
          // For premium users without data, ritual may not be generated yet (rare edge case)
          setLoading(false);
          return;
        }

        setRitual(data);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching ritual:", err);
        setLoading(false);
      }
    };

    if (!accessLoading) {
      fetchRitual();
    }
  }, [accessLoading]);

  if (loading || accessLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Smarty Ritual | Daily Movement System | SmartyGym</title>
        <meta name="description" content="Daily movement, recovery, and performance rituals by Haris Falas with morning, midday, and evening phases." />
        <meta name="keywords" content="daily movement ritual, morning routine workout, midday movement, evening recovery, wellness routine, daily fitness habit, movement system, recovery routine, performance optimization, Haris Falas, SmartyGym, daily wellness, lifestyle fitness, morning activation, mobility routine" />
        <link rel="canonical" href="https://smartygym.com/daily-ritual" />
        
        <meta property="og:title" content="Smarty Ritual | Daily Movement System | SmartyGym" />
        <meta property="og:description" content="All-day movement, recovery, and performance system with Morning, Midday, and Evening phases by Sports Scientist Haris Falas" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://smartygym.com/daily-ritual" />
        <meta property="og:image" content="https://smartygym.com/smarty-gym-logo.png" />
        
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Smarty Ritual | Daily Movement System" />
        <meta name="twitter:description" content="Morning, Midday, and Evening wellness phases designed by Haris Falas" />
        
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Service",
            "name": "Smarty Ritual - Daily Movement System",
            "description": "All-day movement, recovery, and performance system with Morning, Midday, and Evening phases designed by Sports Scientist Haris Falas.",
            "serviceType": "Wellness & Movement Program",
            "url": "https://smartygym.com/daily-ritual",
            "provider": {
              "@type": "Organization",
              "name": "SmartyGym",
              "url": "https://smartygym.com"
            },
            "creator": {
              "@type": "Person",
              "name": "Haris Falas",
              "jobTitle": "Sports Scientist"
            },
            "areaServed": { "@type": "Place", "name": "Worldwide" }
          })}
        </script>
        
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://smartygym.com" },
              { "@type": "ListItem", "position": 2, "name": "Smarty Ritual", "item": "https://smartygym.com/daily-ritual" }
            ]
          })}
        </script>
      </Helmet>
      
      <SEOEnhancer 
        entities={["SmartyGym", "Haris Falas", "Daily Smarty Ritual", "Movement System", "Wellness Routine"]}
        topics={["daily movement ritual", "morning routine", "midday reset", "evening recovery", "wellness optimization", "lifestyle fitness"]}
        expertise={["Sports Science", "Movement Optimization", "Recovery", "Wellness"]}
        contentType="wellness-service"
        aiSummary="Smarty Ritual: Daily all-day movement, recovery, and performance system by Sports Scientist Haris Falas. Three phases: Morning (activation, joint unlock), Midday (desk reset, micro movements), Evening (decompression, sleep hygiene). 100% human-designed for optimal daily wellbeing."
        aiKeywords={["daily movement ritual", "morning activation", "midday movement", "evening recovery", "wellness routine", "lifestyle fitness", "movement system", "daily wellness"]}
        relatedContent={["Smarty Workouts", "Smarty Programs", "Smarty Check-ins", "Fitness Tools"]}
        targetAudience="adults seeking daily movement, desk workers, busy professionals, wellness enthusiasts"
        pageType="Service"
      />

      <div className="min-h-screen bg-background">
        <div className="container mx-auto max-w-6xl md:max-w-[1500px] px-4 md:px-6 pb-8">
          {/* Header */}
          <div className="flex items-center justify-end mb-6">
            <div className="flex items-center gap-2">
              {isAuthenticated && ritual && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setShowReaderMode(true)}>
                    <BookOpen className="mr-2 h-4 w-4" />
                    Reader Mode
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowShareDialog(true)}>
                    <Share2 className="mr-2 h-4 w-4" />
                    Share
                  </Button>
                </>
              )}
            </div>
          </div>

          <PageBreadcrumbs 
            items={[
              { label: "Home", href: "/" },
              { label: "Smarty Ritual" }
            ]} 
          />

          {/* Description Card - Always visible */}
          <Card className="mb-8 bg-white dark:bg-card border-2 border-primary/40 shadow-primary">
            <div className="p-4 sm:p-5">
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight uppercase mb-3 text-center">Smarty Ritual</h2>
              <div className="space-y-2 text-muted-foreground max-w-3xl mx-auto">
                <p className="text-sm sm:text-base text-center font-bold">
                  Your all-day game plan for movement, recovery, and performance. Each day brings a fresh ritual with three expertly designed phases:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 justify-items-center mt-4">
                  <div className="flex items-center gap-2">
                    <Sunrise className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-bold"><strong>Morning:</strong> Activation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Sun className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm font-bold"><strong>Midday:</strong> Reset</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Moon className="h-4 w-4 text-purple-600" />
                    <span className="text-sm font-bold"><strong>Evening:</strong> Unwind</span>
                  </div>
                </div>
                <p className="text-sm sm:text-base font-semibold text-foreground text-center mt-4">
                  Designed by <a href="/coach-profile" className="text-primary hover:underline">Haris Falas</a> to keep you energized, mobile, and performing at your best.
                </p>
              </div>
            </div>
          </Card>

          {/* Mobile: Simplified Card with "See the Ritual" button */}
          <div className="md:hidden">
            <Card className="overflow-hidden">
              <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-6">
                <div className="flex flex-col items-center text-center">
                  <Sparkles aria-label="Smarty Ritual" className="mb-3 h-16 w-16 text-purple-500" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Designed by <a href="/coach-profile" className="text-primary font-semibold hover:underline">Haris Falas</a>
                  </p>
                  <h1 className="text-2xl font-bold mb-2">
                    Daily <span className="text-primary">Smarty</span> Ritual
                  </h1>
                  <p className="text-muted-foreground text-sm mb-4">
                    Your all-day game plan for movement, recovery, and performance
                  </p>
                  
                  {/* Mobile Access States */}
                  {!isAuthenticated && (
                    <div className="w-full pt-4 border-t border-primary/20">
                      <Lock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground mb-3">Sign in to access</p>
                      <Button onClick={() => navigate("/auth")} className="w-full">
                        Sign In
                      </Button>
                    </div>
                  )}
                  
                  {isAuthenticated && !ritual && (
                    <div className="w-full pt-4 border-t border-primary/20">
                      <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Available at <span className="text-primary font-semibold">00:05 AM</span> Cyprus time
                      </p>
                    </div>
                  )}
                  
                  {isAuthenticated && ritual && (
                    <Button onClick={() => setShowReaderMode(true)} className="w-full">
                      <BookOpen className="mr-2 h-4 w-4" />
                      See the Ritual
                    </Button>
                  )}
                </div>
              </div>
            </Card>
            
          </div>

          {/* Desktop: Full Card with all content */}
          <div className="hidden md:block">
            <Card className="overflow-hidden">
              {/* Header Section - Elegant Centered Layout */}
              <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-8 relative">
                <div className="flex flex-col items-center text-center">
                  <Sparkles aria-label="Smarty Ritual" className="mb-3 h-20 w-20 text-purple-500" />
                  <p className="text-sm text-muted-foreground mb-3">
                    Designed by <a href="/coach-profile" className="text-primary font-semibold hover:underline">Haris Falas</a>
                  </p>
                  <h1 className="text-3xl font-bold mb-3">
                    Daily <span className="text-primary">Smarty</span> Ritual
                  </h1>
                  <p className="text-muted-foreground max-w-md">
                    Your all-day game plan for movement, recovery, and performance
                  </p>
                </div>
              </div>

              {/* Access Gate for guests (non-authenticated users) */}
              {!isAuthenticated && (
                <div className="p-6 bg-muted/50">
                  <div className="flex flex-col items-center justify-center gap-4 text-center">
                    <Lock className="h-12 w-12 text-muted-foreground" />
                    <div>
                      <h3 className="text-xl font-semibold mb-2">Sign In Required</h3>
                      <p className="text-muted-foreground mb-4 max-w-md">
                        The Daily Smarty Ritual is available to all members. Sign in to access daily movement rituals designed for optimal health and performance.
                      </p>
                      <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Button onClick={() => navigate("/auth")}>
                          Sign In
                        </Button>
                        <Button variant="outline" onClick={() => navigate("/auth")}>
                          Create Account
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Empty state for authenticated users when ritual not yet generated */}
              {isAuthenticated && !ritual && (
                <div className="p-6 bg-muted/50">
                  <div className="flex flex-col items-center justify-center gap-4 text-center">
                    <Clock className="h-12 w-12 text-muted-foreground" />
                    <div>
                      <h3 className="text-xl font-semibold mb-2">Today's Ritual is Being Prepared</h3>
                      <p className="text-muted-foreground max-w-md">
                        Your Daily Smarty Ritual will be available at <span className="text-primary font-semibold">00:05 AM</span> Cyprus time.
                      </p>
                      <p className="text-sm text-muted-foreground/70 mt-2">
                        Check back shortly!
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Ritual Content */}
              {isAuthenticated && ritual && (
                <CardContent className="p-6 space-y-8">

                  {/* Morning Ritual */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-900/20">
                        <Sunrise className="h-6 w-6 text-orange-500" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">Morning Ritual</h2>
                        <p className="text-sm text-muted-foreground">~8:00 AM • Start Strong</p>
                      </div>
                    </div>
                    <div className="pl-12">
                      <HTMLContent content={ritual.morning_content} />
                    </div>
                  </div>

                  <Separator />

                  {/* Midday Ritual */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-yellow-100 dark:bg-yellow-900/20">
                        <Sun className="h-6 w-6 text-yellow-600" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">Midday Ritual</h2>
                        <p className="text-sm text-muted-foreground">~1:00 PM • Reset & Reload</p>
                      </div>
                    </div>
                    <div className="pl-12">
                      <HTMLContent content={ritual.midday_content} />
                    </div>
                  </div>

                  <Separator />

                  {/* Evening Ritual */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/20">
                        <Moon className="h-6 w-6 text-purple-600" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">Evening Ritual</h2>
                        <p className="text-sm text-muted-foreground">~5:00 PM • Unwind</p>
                      </div>
                    </div>
                    <div className="pl-12">
                      <HTMLContent content={ritual.evening_content} />
                    </div>
                  </div>

                </CardContent>
              )}
            </Card>
          </div>

        </div>
      </div>

      {/* Share Dialog */}
      {isAuthenticated && ritual && (
        <RitualShareDialog 
          open={showShareDialog} 
          onOpenChange={setShowShareDialog}
          ritualDate={todayCyprus}
          dayNumber={ritual.day_number}
        />
      )}

      {/* Reader Mode Dialog - for authenticated users with access */}
      {isAuthenticated && ritual && (
        <ReaderModeDialog
          open={showReaderMode}
          onOpenChange={setShowReaderMode}
          title={`Daily Smarty Ritual - ${new Date(todayCyprus).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`}
          content={`
            <h2>🌅 Morning Ritual</h2>
            ${ritual.morning_content}
            <hr style="margin: 24px 0; border-color: rgba(212, 175, 55, 0.3);" />
            <h2>☀️ Midday Ritual</h2>
            ${ritual.midday_content}
            <hr style="margin: 24px 0; border-color: rgba(212, 175, 55, 0.3);" />
            <h2>🌙 Evening Ritual</h2>
            ${ritual.evening_content}
          `}
          metadata={{ author: "Haris Falas", date: todayCyprus }}
        />
      )}
    </>
  );
};

export default DailySmartyRitual;