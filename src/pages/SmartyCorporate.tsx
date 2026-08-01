import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Building2, Check, ChevronRight, Users, Crown, CreditCard, Shield, Headphones, Lightbulb } from "lucide-react";
import { openExternal } from "@/utils/native";
import { platformHeader } from "@/utils/platform";
import { usePaymentsEnabled } from "@/hooks/usePaymentsEnabled";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";

import { SEOEnhancer } from "@/components/SEOEnhancer";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { DesktopPageIntro } from "@/components/DesktopPageIntro";
import { STRIPE_PRICE_IDS } from "@/config/pricing";

// Stripe product and price IDs for corporate plans
const CORPORATE_PLANS = {
  dynamic: {
    name: "Smarty Dynamic",
    maxUsers: 10,
    price: 699,
    priceId: STRIPE_PRICE_IDS.corporate_dynamic,
    productId: "prod_TZATAcAlqgc1P7"
  },
  power: {
    name: "Smarty Power",
    maxUsers: 20,
    price: 799,
    priceId: STRIPE_PRICE_IDS.corporate_power,
    productId: "prod_TZATDsKcDvMtHc"
  },
  elite: {
    name: "Smarty Elite",
    maxUsers: 30,
    price: 899,
    priceId: STRIPE_PRICE_IDS.corporate_elite,
    productId: "prod_TZATGTAsKalmCn"
  },
  enterprise: {
    name: "Smarty Enterprise",
    maxUsers: 9999,
    price: 699,
    priceId: STRIPE_PRICE_IDS.corporate_enterprise,
    productId: "prod_TZATUtaS2jhgtK"
  }
};
export default function SmartyCorporate() {
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [orgDialogOpen, setOrgDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<keyof typeof CORPORATE_PLANS | null>(null);
  const [organizationName, setOrganizationName] = useState("");
  const { paymentsEnabled } = usePaymentsEnabled();
  useEffect(() => {
    supabase.auth.getSession().then(({
      data: {
        session
      }
    }) => {
      setUser(session?.user ?? null);
    });
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);
  const handleGetStarted = (planKey: keyof typeof CORPORATE_PLANS) => {
    if (!paymentsEnabled) {
      toast({
        title: "In-app purchases are not available",
        description:
          "Memberships, workouts and training programs are purchased on our website. Visit smartygym.com from any computer, then sign in here with the same account.",
      });
      return;
    }
    if (!user) {
      navigate('/auth');
      return;
    }
    setSelectedPlan(planKey);
    setOrgDialogOpen(true);
  };
  const handleProceedToCheckout = async () => {
    if (!selectedPlan || !organizationName.trim()) {
      toast({
        title: "Organization name required",
        description: "Please enter your organization name to continue.",
        variant: "destructive"
      });
      return;
    }
    setLoading(selectedPlan);
    setOrgDialogOpen(false);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('create-corporate-checkout', {
        body: {
          planType: selectedPlan,
          organizationName: organizationName.trim(),
          cancelPath: window.location.pathname + window.location.search
        },
        headers: platformHeader()
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start checkout process. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(null);
      setOrganizationName("");
      setSelectedPlan(null);
    }
  };
  const benefits = [{
    icon: CreditCard,
    text: "Centralized billing for your organization"
  }, {
    icon: Users,
    text: "Admin dashboard to manage team members"
  }, {
    icon: Crown,
    text: "Premium access for all members"
  }, {
    icon: Shield,
    text: "1-year subscription period"
  }, {
    icon: Headphones,
    text: "Priority support for organizations"
  }, {
    icon: Lightbulb,
    text: "Why Invest in Corporate Wellness?",
    isLink: true,
    href: "/corporate-wellness"
  }];
  return <>
      <Helmet>
        <title>Smarty Corporate | Team & Business Plans | SmartyGym</title>
        <meta name="description" content="SmartyGym Corporate plans for teams, businesses, and organizations. Get Premium access for 10-unlimited team members. Centralized billing, admin dashboard, priority support." />
        <meta name="keywords" content="corporate fitness, team fitness plan, business gym membership, organization fitness, group fitness subscription, corporate wellness, team training, SmartyGym corporate" />
        
        <meta property="og:title" content="Smarty Corporate | Team & Business Plans | SmartyGym" />
        <meta property="og:description" content="Corporate fitness plans for teams and businesses. Premium access for all members with centralized billing." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://smartygym.com/corporate" />
        
        <link rel="canonical" href="https://smartygym.com/corporate" />
      </Helmet>

      <SEOEnhancer entities={["Corporate Fitness", "Team Membership", "Business Wellness"]} topics={["corporate fitness plans", "team training", "business wellness programs"]} expertise={["corporate wellness", "team fitness management"]} contentType="Corporate Plans" aiSummary="SmartyGym Corporate: Premium fitness access for teams and organizations. Plans from €699/year (10 users) to €699/year (unlimited). All members get Premium access with admin dashboard for team management." aiKeywords={["corporate fitness", "team membership", "business wellness", "group fitness"]} relatedContent={["Premium Benefits", "Workout Library", "Training Programs"]} targetAudience="businesses and organizations seeking team fitness solutions" pageType="Product" />

      <div className="min-h-screen bg-background">
        <main className="container mx-auto max-w-6xl md:max-w-[1500px] px-4 md:px-6 pb-8">
          <PageBreadcrumbs items={[{
          label: "Home",
          href: "/"
        }, {
          label: "Smarty Corporate"
        }]} />

          {/* Desktop intro (icon + headline + description, no card) */}
          <DesktopPageIntro icon={Building2} title="Smarty Corporate">
            <p className="font-bold text-foreground">
              <span className="text-primary font-semibold">Smarty Corporate</span> is designed for teams, businesses, and organizations that want to provide premium fitness access to their members.
              With one master account, an administrator can create and manage multiple user accounts, each receiving full Premium-level access
              to all <span className="text-primary font-semibold">SmartyGym</span> features including workouts, training programs, daily rituals, and fitness tools.
            </p>
            <p className="font-semibold text-foreground">
              All team members enjoy the same benefits as individual Premium subscribers for the duration of the subscription.
              The administrator has access to a dedicated dashboard to manage team members, monitor usage, and control access.
            </p>
            <div className="pt-1">
              <Link to="/corporate-wellness" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                Why Invest in Corporate Wellness
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </DesktopPageIntro>

          {/* Header (mobile) */}
          <div className="lg:hidden text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-2">
              <Building2 className="h-8 w-8 text-primary" />
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight uppercase">Smarty Corporate</h1>
            </div>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Premium fitness access for teams, businesses, and organizations. One subscription, unlimited possibilities.
            </p>
          </div>

          {/* About Card (mobile) */}
          <Card className="lg:hidden mb-8 bg-white dark:bg-card border-2 border-primary/40 shadow-primary">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                About Smarty Corporate
              </CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm dark:prose-invert max-w-none">
              <p>
                <span className="text-primary font-semibold">Smarty Corporate</span> is designed for teams, businesses, and organizations that want to provide premium fitness access to their members.
                With one master account, an administrator can create and manage multiple user accounts, each receiving full Premium-level access
                to all <span className="text-primary font-semibold">SmartyGym</span> features including workouts, training programs, daily rituals, and fitness tools.
              </p>
              <p>
                All team members enjoy the same benefits as individual Premium subscribers for the duration of the subscription.
                The administrator has access to a dedicated dashboard to manage team members, monitor usage, and control access.
              </p>
              <div className="text-center mt-4 not-prose">
                <Link to="/corporate-wellness" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                  Why Invest in Corporate Wellness
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Benefits Card */}
          <Card className="mb-8 bg-white dark:bg-card border-2 border-primary/40 shadow-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-primary" />
                Corporate Benefits
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {benefits.map((benefit, index) => {
                const isGreenCard = 'isLink' in benefit && benefit.isLink;
                if (isGreenCard && 'href' in benefit) {
                  return <Link key={index} to={benefit.href} className="flex items-center gap-3 p-3 bg-green-500/10 border-2 border-green-500 rounded-lg hover:bg-green-500/20 transition-colors group">
                        <div className="p-2 bg-green-500/20 rounded-full">
                          <benefit.icon className="h-5 w-5 text-green-500" />
                        </div>
                        <span className="text-sm font-medium text-green-600 dark:text-green-400 group-hover:underline">{benefit.text}</span>
                      </Link>;
                }
                return <div key={index} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                      <div className="p-2 bg-primary/10 rounded-full">
                        <benefit.icon className="h-5 w-5 text-primary" />
                      </div>
                      <span className="text-sm font-medium">{benefit.text}</span>
                    </div>;
              })}
              </div>
            </CardContent>
          </Card>

          {/* Plans Section Header */}
          <Card className="mb-8 bg-white dark:bg-card border-2 border-primary/40 shadow-primary">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-xl">Smarty Corporate Plans</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-muted-foreground">
                <strong>All plans include 1-year subscription.</strong> Team members receive Premium access from the date the administrator purchases the plan until the subscription expires.
              </p>
            </CardContent>
          </Card>

          {/* Pricing Plans */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Smarty Dynamic - 10 users */}
            <Card className="relative border-2 border-primary transition-colors flex flex-col">
              <CardHeader className="text-center pb-2">
                <div className="flex items-center justify-center gap-2 min-h-[56px]">
                  <Users className="h-5 w-5 text-primary shrink-0" />
                  <h2 className="text-lg font-bold whitespace-nowrap">Smarty Dynamic</h2>
                </div>
                <div className="min-h-[28px] flex items-center justify-center">
                  <Badge className="bg-primary/20 text-primary">
                    Up to 10 Users
                  </Badge>
                </div>
                <CardTitle className="text-3xl font-bold mt-3">€699</CardTitle>
                <p className="text-sm text-muted-foreground">per year</p>
              </CardHeader>
              <CardContent className="space-y-4 flex-1 flex flex-col">
                <div className="space-y-2 flex-1">
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-sm">10 team member accounts</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-sm">Premium access for all</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-sm">Admin dashboard</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-sm">1-year subscription</span>
                  </div>
                </div>
                <Button className="w-full mt-auto" onClick={() => handleGetStarted('dynamic')} disabled={loading === 'dynamic'}>
                  {loading === 'dynamic' ? "Processing..." : "Get Started"}
                </Button>
              </CardContent>
            </Card>

            {/* Smarty Power - 20 users */}
            <Card className="relative border-2 border-primary transition-colors flex flex-col">
              <CardHeader className="text-center pb-2">
                <div className="flex items-center justify-center gap-2 min-h-[56px]">
                  <Users className="h-5 w-5 text-primary shrink-0" />
                  <h2 className="text-lg font-bold whitespace-nowrap">Smarty Power</h2>
                </div>
                <div className="min-h-[28px] flex items-center justify-center">
                  <Badge className="bg-primary/20 text-primary">
                    Up to 20 Users
                  </Badge>
                </div>
                <CardTitle className="text-3xl font-bold mt-3">€799</CardTitle>
                <p className="text-sm text-muted-foreground">per year</p>
              </CardHeader>
              <CardContent className="space-y-4 flex-1 flex flex-col">
                <div className="space-y-2 flex-1">
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-sm">20 team member accounts</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-sm">Premium access for all</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-sm">Admin dashboard</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-sm">1-year subscription</span>
                  </div>
                </div>
                <Button className="w-full mt-auto" onClick={() => handleGetStarted('power')} disabled={loading === 'power'}>
                  {loading === 'power' ? "Processing..." : "Get Started"}
                </Button>
              </CardContent>
            </Card>

            {/* Smarty Elite - 30 users */}
            <Card className="relative border-2 border-primary transition-colors flex flex-col">
              <CardHeader className="text-center pb-2">
                <div className="flex items-center justify-center gap-2 min-h-[56px]">
                  <Users className="h-5 w-5 text-primary shrink-0" />
                  <h2 className="text-lg font-bold whitespace-nowrap">Smarty Elite</h2>
                </div>
                <div className="min-h-[28px] flex items-center justify-center">
                  <Badge className="bg-primary/20 text-primary">
                    Up to 30 Users
                  </Badge>
                </div>
                <CardTitle className="text-3xl font-bold mt-3">€899</CardTitle>
                <p className="text-sm text-muted-foreground">per year</p>
              </CardHeader>
              <CardContent className="space-y-4 flex-1 flex flex-col">
                <div className="space-y-2 flex-1">
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-sm">30 team member accounts</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-sm">Premium access for all</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-sm">Admin dashboard</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-sm">1-year subscription</span>
                  </div>
                </div>
                <Button className="w-full mt-auto" onClick={() => handleGetStarted('elite')} disabled={loading === 'elite'}>
                  {loading === 'elite' ? "Processing..." : "Get Started"}
                </Button>
              </CardContent>
            </Card>

            {/* Smarty Enterprise - Unlimited */}
            <Card className="relative border-2 border-primary shadow-lg flex flex-col bg-gradient-to-br from-primary/5 to-sky-500/5">
              <Badge className="absolute -top-2 right-2 bg-green-600 text-white px-2 py-1 text-xs shadow-md z-10">
                BEST VALUE
              </Badge>
              <CardHeader className="text-center pb-2">
                <div className="flex items-center justify-center gap-2 min-h-[56px]">
                  <Building2 className="h-5 w-5 text-primary shrink-0" />
                  <h2 className="text-lg font-bold text-primary whitespace-nowrap">Smarty Enterprise</h2>
                </div>
                <div className="min-h-[28px] flex items-center justify-center">
                  <Badge className="bg-primary text-primary-foreground">
                    Unlimited Users
                  </Badge>
                </div>
                <CardTitle className="text-3xl font-bold mt-3">€699</CardTitle>
                <p className="text-sm text-muted-foreground">per year</p>
              </CardHeader>
              <CardContent className="space-y-4 flex-1 flex flex-col">
                <div className="space-y-2 flex-1">
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-sm font-semibold">Unlimited team members</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-sm">Premium access for all</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-sm">Admin dashboard</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-sm">Priority enterprise support</span>
                  </div>
                </div>
                <Button className="w-full mt-auto" onClick={() => handleGetStarted('enterprise')} disabled={loading === 'enterprise'}>
                  {loading === 'enterprise' ? "Processing..." : "Get Started"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Organization Name Dialog */}
          <Dialog open={orgDialogOpen} onOpenChange={setOrgDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Enter Your Organization Name</DialogTitle>
                <DialogDescription>
                  This name will be displayed to your team members and used in your corporate dashboard.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Label htmlFor="orgName">Organization Name</Label>
                <Input id="orgName" placeholder="e.g., Acme Corporation" value={organizationName} onChange={e => setOrganizationName(e.target.value)} className="mt-2" />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOrgDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleProceedToCheckout} disabled={!organizationName.trim()}>
                  Continue to Payment
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Contact CTA */}
          <Card className="bg-muted/50">
            <CardContent className="p-6 text-center">
              <h3 className="text-lg font-semibold mb-2">Need a Custom Solution?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Have specific requirements or need a tailored corporate wellness program? Get in touch with us.
              </p>
              <Button variant="outline" onClick={() => navigate('/contact')}>
                Contact Us
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    </>;
}