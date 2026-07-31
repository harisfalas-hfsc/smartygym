import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { Button } from "@/components/ui/button";
import { usePaymentsEnabled } from "@/hooks/usePaymentsEnabled";
import { PaymentsDisabledNotice } from "@/components/PaymentsDisabledNotice";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import {
  Crown,
  Check,
  Dumbbell,
  Calendar,
  Calculator,
  BookOpen,
  Zap,
  Sparkles,
  Heart,
  TrendingUp,
  Target,
  Eye,
  UserCheck,
  X,
  ClipboardCheck,
  LayoutDashboard,
  MessageCircle,
  Flame,
  CircleMinus,
  FileText,
  Rocket,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";

import { useAccessControl } from "@/hooks/useAccessControl";
import { SEOEnhancer } from "@/components/SEOEnhancer";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { AlreadyPremiumCard } from "@/components/pricing/AlreadyPremiumCard";

export default function SmartyPremium() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const { userTier } = useAccessControl();
  const isPremium = userTier === "premium";
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const { paymentsEnabled } = usePaymentsEnabled();

  const monthlyPrice = 9.99;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubscribe = async () => {
    if (isPremium) {
      toast({
        title: "Already Premium",
        description: "Congratulations, you are already a premium member!",
      });
      navigate('/userdashboard');
      return;
    }

    if (!user) {
      navigate('/auth');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-lifetime-checkout', {
        body: { cancelPath: window.location.pathname + window.location.search }
      });

      if (data?.alreadyPremium || data?.hasActiveSubscription) {
        toast({
          title: "You're Already Premium!",
          description: "Your Premium Membership is already active.",
        });
        navigate('/userdashboard');
        return;
      }

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error("No checkout URL returned");
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast({
        title: "Error",
        description: "Failed to start checkout process. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const comparisonFeatures = [
    { category: "Smarty Workouts", icon: Dumbbell, visitor: false, subscriber: "limited", premium: true },
    { category: "Smarty Training Programs", icon: Flame, visitor: false, subscriber: "limited", premium: true },
    { category: "Smarty Ritual", icon: Sparkles, visitor: false, subscriber: true, premium: true },
    { category: "Smarty Check-ins", icon: ClipboardCheck, visitor: false, subscriber: false, premium: true },
    { category: "Smarty Tools (Workout Timer, Rounds Tracker, 1RM, BMR, Macro, Calorie Counter)", icon: Calculator, visitor: true, subscriber: true, premium: true },
    { category: "Dashboard", icon: LayoutDashboard, visitor: false, subscriber: "limited", premium: true },
    { category: "LogBook", icon: FileText, visitor: false, subscriber: false, premium: true },
    { category: "Exercise Library", icon: BookOpen, visitor: true, subscriber: true, premium: true },
    { category: "Blog", icon: BookOpen, visitor: true, subscriber: true, premium: true },
    { category: "Workout Interactions", icon: Heart, visitor: false, subscriber: "limited", premium: true },
    { category: "Program Interactions", icon: Heart, visitor: false, subscriber: "limited", premium: true },
    { category: "WhatsApp Interaction with Coach", icon: MessageCircle, visitor: false, subscriber: false, premium: true }
  ];

  const renderFeatureValue = (value: string | boolean) => {
    if (value === false) return <X className="w-5 h-5 text-destructive" />;
    if (value === true) return <Check className="w-5 h-5 text-green-600" />;
    if (value === "limited") return (
      <div className="relative inline-flex items-center justify-center w-8 h-8">
        <Check className="w-6 h-6 text-green-600" strokeWidth={3} />
        <CircleMinus className="absolute -bottom-0.5 -right-0.5 w-4 h-4 text-amber-500 bg-background rounded-full" strokeWidth={2.6} />
      </div>
    );
    return <span className="text-sm text-right">{value}</span>;
  };

  const benefits = [
    { icon: Dumbbell, title: "All Workouts", description: "Access to all personalized workout plans" },
    { icon: Calendar, title: "Training Programs", description: "Structured training programs to achieve long-term goals" },
    { icon: Heart, title: "Track Favorites", description: "Save and organize your favorite workouts" },
    { icon: TrendingUp, title: "Progress", description: "Monitor completed workouts and achievements" },
    { icon: Target, title: "Goal Setting", description: "Set and track your fitness goals" },
    { icon: BookOpen, title: "Exercise Library", description: "Complete exercise database with videos" },
    { icon: Calculator, title: "Fitness Tools", description: "BMR, 1RM, and macro calculators with history" },
    { icon: Sparkles, title: "Rituals & Check-ins", description: "Daily wellness routines and fitness tracking check-ins" },
    { icon: Zap, title: "Priority Support", description: "Get help when you need it" },
    { icon: Rocket, title: "Future Content", description: "All new workouts, programs & features — no extra cost", highlight: true }
  ];

  const PremiumCard = (
    <Card className="relative overflow-hidden border-2 border-[#D4AF37] shadow-lg flex flex-col h-full bg-gradient-to-br from-[#D4AF37]/5 to-[#F5D87A]/10 w-full">
      <CardHeader className="text-center pb-2 sm:pb-4 pt-4 sm:pt-6">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Crown className="h-6 w-6 sm:h-7 sm:w-7 text-[#D4AF37]" />
          <h2 className="text-2xl sm:text-3xl font-bold text-[#D4AF37]">Premium Membership</h2>
        </div>
        <Badge className="bg-[#D4AF37] text-white mx-auto mb-3 sm:mb-4">MONTHLY MEMBERSHIP</Badge>
        <CardTitle className="flex items-end justify-center gap-2 text-3xl sm:text-4xl font-bold leading-none">
          <span>€{monthlyPrice.toFixed(2)}</span>
          <span className="pb-0.5 text-base sm:text-lg font-medium leading-none text-muted-foreground">/ month</span>
        </CardTitle>
        <p className="text-xs sm:text-sm text-muted-foreground">Billed monthly. Cancel anytime.</p>
        <p className="text-xs text-[#D4AF37] font-semibold mt-2 flex items-center justify-center gap-1">
          <RefreshCw className="h-3.5 w-3.5" /> Full premium access, renewed monthly
        </p>
      </CardHeader>
      <CardContent className="space-y-2 sm:space-y-4 flex-1 flex flex-col">
        <div className="space-y-1.5 sm:space-y-2 flex-1">
          {[
            "Premium access to all Smarty Workouts",
            "Premium access to all Smarty Programs",
            "Premium access to Smarty Ritual",
            "Premium access to Smarty Tools",
            "Smarty Check-ins included",
            "All future content included — no extra cost",
            "Cancel anytime from your account — no lock-in",
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 shrink-0 mt-0.5" />
              <span className="text-xs sm:text-sm">{item}</span>
            </div>
          ))}
        </div>
        <div className="space-y-3 mt-auto">
          {!paymentsEnabled ? (
            <PaymentsDisabledNotice />
          ) : (
            <Button
              className="w-full py-5 sm:py-6 text-white bg-[#D4AF37] hover:bg-[#C9A431] text-base sm:text-lg font-semibold"
              onClick={handleSubscribe}
              disabled={loading}
            >
              {loading ? "Processing..." : "Start Premium — €9.99/month"}
            </Button>
          )}
          <p className="text-xs text-center text-muted-foreground">Recurring monthly payment. Cancel anytime from My Account.</p>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <>
      <Helmet>
        <title>Premium Membership | SmartyGym | €9.99/month, Cancel Anytime</title>
        <meta name="description" content="Unlock SmartyGym Premium for €9.99/month. 500+ human-designed workouts, training programs, and fitness tools. Cancel anytime from your account." />
        <meta name="keywords" content="SmartyGym premium, monthly gym membership, fitness subscription, smartygym pricing, online fitness membership" />

        <meta property="og:title" content="Premium Membership | SmartyGym" />
        <meta property="og:description" content="€9.99/month. Premium access to every SmartyGym workout, program and tool. Cancel anytime." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://smartygym.com/smarty-premium" />

        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Premium Membership | SmartyGym" />
        <meta name="twitter:description" content="€9.99/month. Cancel anytime." />

        <link rel="canonical" href="https://smartygym.com/smarty-premium" />

        <meta name="ai-pricing-premium" content="€9.99/month recurring subscription, cancel anytime" />
        <meta name="ai-value-proposition" content="100% human-designed workouts by certified Sports Scientist Haris Falas — €9.99/month, cancel anytime" />

        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "SmartyGym Premium Membership",
            "description": "Monthly subscription with full premium access to all SmartyGym workouts, programs, and tools. Cancel anytime.",
            "brand": { "@type": "Brand", "name": "SmartyGym" },
            "offers": {
              "@type": "Offer",
              "price": monthlyPrice.toString(),
              "priceCurrency": "EUR",
              "availability": "https://schema.org/InStock",
              "url": "https://smartygym.com/smarty-premium"
            },
            "category": "Online Fitness Membership"
          })}
        </script>

        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://smartygym.com" },
              { "@type": "ListItem", "position": 2, "name": "Smarty Premium", "item": "https://smartygym.com/smarty-premium" }
            ]
          })}
        </script>
      </Helmet>

      <SEOEnhancer
        entities={["Premium Membership", "Monthly Subscription", "SmartyGym"]}
        topics={["monthly gym membership", "fitness subscription", "cancel anytime fitness platform"]}
        expertise={["membership pricing", "monthly premium access"]}
        contentType="Product"
        aiSummary="SmartyGym Premium Membership: €9.99/month unlocks every workout, program, ritual, check-in, and tool. Cancel anytime from your account."
        aiKeywords={["monthly gym membership", "fitness subscription", "smartygym premium"]}
        relatedContent={["Premium Benefits", "Workout Library", "Training Programs", "Fitness Tools"]}
        targetAudience="fitness enthusiasts looking for a flexible monthly premium gym membership"
        pageType="Product"
      />

      <div className="min-h-screen bg-background">
        <main className="container mx-auto max-w-6xl md:max-w-[1500px] px-4 md:px-6 pb-8">
          <PageBreadcrumbs items={[{ label: "Home", href: "/" }, { label: "Smarty Premium" }]} />

          {isPremium && (
            <AlreadyPremiumCard className="mb-8" />
          )}

          {/* Header */}
          <div className="text-center mb-8">
            <Crown className="h-16 w-16 text-primary mx-auto mb-4" />
            <h1 className="font-extrabold tracking-tight uppercase mb-4">
              <span className="block text-3xl sm:text-4xl">Transform your fitness journey.</span>
              <span className="block text-base sm:text-lg font-semibold mt-2 text-muted-foreground normal-case tracking-normal">
                Unlock everything with Premium
              </span>
            </h1>
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 max-w-2xl mx-auto">
              <p className="text-sm text-muted-foreground">
                Join thousands of members unlocking SmartyGym with a Premium Monthly Membership.
              </p>
              <p className="text-sm font-semibold text-primary mt-2">
                €9.99/month. Full premium access. Cancel anytime.
              </p>
            </div>
          </div>

          {/* What You Get with Premium */}
          <Card className="mb-8 bg-white dark:bg-card border-2 border-primary/40 shadow-primary">
            <CardHeader>
              <CardTitle className="text-2xl">What's Included with Premium</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 md:hidden">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center gap-1.5 py-2 px-1 border-b border-primary/10 min-w-0">
                    <benefit.icon className={`h-3.5 w-3.5 shrink-0 ${benefit.highlight ? 'text-green-600' : 'text-primary'}`} />
                    <span className={`text-xs font-medium whitespace-nowrap truncate ${benefit.highlight ? 'text-green-600' : ''}`}>{benefit.title}</span>
                  </div>
                ))}
              </div>

              <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className={`flex items-start gap-3 p-4 rounded-lg ${benefit.highlight ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900' : 'bg-muted'}`}>
                    <div className={`p-2 rounded-full shrink-0 ${benefit.highlight ? 'bg-green-100 dark:bg-green-900/30' : 'bg-primary/10'}`}>
                      <benefit.icon className={`h-5 w-5 ${benefit.highlight ? 'text-green-600' : 'text-primary'}`} />
                    </div>
                    <div>
                      <h3 className={`font-semibold mb-1 ${benefit.highlight ? 'text-green-600' : ''}`}>{benefit.title}</h3>
                      <p className={`text-sm ${benefit.highlight ? 'text-green-600' : 'text-muted-foreground'}`}>{benefit.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Premium card (after What's Included) */}
          {!isPremium && (
            <div className="mb-8">
              {PremiumCard}
            </div>
          )}

          {/* Compare Access Levels */}
          <Card className="mb-8 overflow-hidden border-2 border-[hsl(var(--primary)/0.6)] shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl text-center">Compare Access Levels</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Mobile View */}
              <div className="md:hidden">
                <Carousel className="w-full" opts={{ align: "start", loop: false, containScroll: "trimSnaps" }}>
                  <CarouselContent className="-ml-2">
                    <CarouselItem className="pl-2 basis-[88%]">
                      <Card className="border-2 border-[hsl(var(--primary)/0.3)] h-full">
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-center gap-2 mb-4">
                            <Eye className="w-6 h-6 text-primary" />
                            <h3 className="text-2xl font-bold">Visitor</h3>
                          </div>
                          <div className="text-center text-sm text-muted-foreground mb-4">Free • No login</div>
                          <div className="space-y-3">
                            {comparisonFeatures.map((feature, idx) => {
                              const Icon = feature.icon;
                              return (
                                <div key={idx} className="flex justify-between items-center gap-2 py-2 min-h-[56px] border-b border-primary/10">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <Icon className="w-4 h-4 text-primary shrink-0" />
                                    <span className="text-sm font-medium leading-tight">{feature.category}</span>
                                  </div>
                                  <div className="w-10 flex justify-end shrink-0">{renderFeatureValue(feature.visitor)}</div>
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    </CarouselItem>

                    <CarouselItem className="pl-2 basis-[88%]">
                      <Card className="border-2 border-[hsl(var(--primary)/0.5)] h-full">
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-center gap-2 mb-4">
                            <UserCheck className="w-6 h-6 text-primary" />
                            <h3 className="text-2xl font-bold">Subscriber</h3>
                          </div>
                          <div className="text-center text-sm text-muted-foreground mb-4">Free • Login required</div>
                          <div className="space-y-3">
                            {comparisonFeatures.map((feature, idx) => {
                              const Icon = feature.icon;
                              return (
                                <div key={idx} className="flex justify-between items-center gap-2 py-2 min-h-[56px] border-b border-primary/10">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <Icon className="w-4 h-4 text-primary shrink-0" />
                                    <span className="text-sm font-medium leading-tight">{feature.category}</span>
                                  </div>
                                  <div className="w-10 flex justify-end shrink-0">{renderFeatureValue(feature.subscriber)}</div>
                                </div>
                              );
                            })}
                          </div>
                          {!user && (
                            <Button className="w-full mt-6" onClick={() => navigate("/auth")}>
                              Sign Up Free
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    </CarouselItem>

                    <CarouselItem className="pl-2 basis-[88%]">
                      <Card className="border-2 border-[hsl(var(--primary)/0.8)] h-full bg-gradient-to-br from-[hsl(var(--primary)/0.1)] to-[hsl(var(--primary)/0.2)]">
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-center gap-2 mb-4">
                            <Crown className="w-6 h-6 text-primary" />
                            <h3 className="text-2xl font-bold">Premium</h3>
                          </div>
                          <div className="text-center text-sm font-semibold text-primary mb-4">€9.99 / month</div>
                          <div className="space-y-3">
                            {comparisonFeatures.map((feature, idx) => {
                              const Icon = feature.icon;
                              return (
                                <div key={idx} className="flex justify-between items-center gap-2 py-2 min-h-[56px] border-b border-primary/10">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <Icon className="w-4 h-4 text-primary shrink-0" />
                                    <span className="text-sm font-medium leading-tight">{feature.category}</span>
                                  </div>
                                  <div className="w-10 flex justify-end shrink-0">{renderFeatureValue(feature.premium)}</div>
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    </CarouselItem>
                  </CarouselContent>
                </Carousel>
                <p className="text-center text-xs text-muted-foreground mt-2">← Swipe Visitor · Subscriber · Premium →</p>
              </div>

              {/* Desktop View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-[hsl(var(--primary)/0.4)]">
                      <th className="p-6 text-left font-bold text-lg">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-primary" />
                          <span>Feature</span>
                        </div>
                      </th>
                      <th className="p-6 text-center font-bold bg-gradient-to-b from-[hsl(var(--primary)/0.05)] to-transparent">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <Eye className="w-5 h-5 text-primary" />
                          <div className="text-lg">Visitor</div>
                        </div>
                        <div className="text-sm font-normal text-muted-foreground">Free • No login</div>
                      </th>
                      <th className="p-6 text-center font-bold bg-gradient-to-b from-[hsl(var(--primary)/0.1)] to-transparent">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <UserCheck className="w-5 h-5 text-primary" />
                          <div className="text-lg">Subscriber</div>
                        </div>
                        <div className="text-sm font-normal text-muted-foreground">Free • Login required</div>
                      </th>
                      <th className="p-6 text-center font-bold bg-gradient-to-b from-[hsl(var(--primary)/0.2)] to-transparent">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <Crown className="w-5 h-5 text-primary" />
                          <div className="text-lg">Premium</div>
                        </div>
                        <div className="text-sm font-semibold text-primary">€9.99 / month</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonFeatures.map((feature, idx) => {
                      const Icon = feature.icon;
                      return (
                        <tr key={idx} className="border-b border-[hsl(var(--primary)/0.2)] hover:bg-[hsl(var(--primary)/0.05)]">
                          <td className="p-4 font-medium">
                            <div className="flex items-center gap-2">
                              <Icon className="w-4 h-4 text-primary" />
                              <span>{feature.category}</span>
                            </div>
                          </td>
                          <td className="p-4 text-center"><div className="flex justify-center">{renderFeatureValue(feature.visitor)}</div></td>
                          <td className="p-4 text-center"><div className="flex justify-center">{renderFeatureValue(feature.subscriber)}</div></td>
                          <td className="p-4 text-center"><div className="flex justify-center">{renderFeatureValue(feature.premium)}</div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Premium card (after Compare Access Levels) */}
          {!isPremium && (
            <div className="mb-8">
              {PremiumCard}
            </div>
          )}

          {/* FAQ */}
          <Card className="mb-8 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="p-4 bg-primary/10 rounded-full">
                  <MessageCircle className="h-10 w-10 text-primary" />
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h3 className="text-xl font-bold mb-2">Frequently Asked Questions</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Want to know more? Find answers to common questions about the Premium Membership and access.
                  </p>
                  <Button variant="outline" onClick={() => navigate("/faq")}>
                    View FAQ
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {!user && (
            <div className="mt-8 text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Don't have an account yet?
              </p>
              <Button variant="outline" onClick={() => navigate('/auth')}>
                Sign Up Free
              </Button>
            </div>
          )}
        </main>
      </div>
    </>
  );
}