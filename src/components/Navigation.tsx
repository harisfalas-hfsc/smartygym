import { useEffect, useState, useRef, useLayoutEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User as UserIcon, Settings, LogOut, LayoutDashboard, Crown, Bell, Facebook, Instagram, Youtube, ShoppingBag, Info, Dumbbell, ListChecks, Wrench, BookOpen, Users, Newspaper, Mail, Sparkles, Building2, Shield, HelpCircle, Compass, ArrowLeft, Menu, Home, FileText, AlertTriangle } from "lucide-react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useToast } from "@/hooks/use-toast";
import smartyGymLogo from "@/assets/smarty-gym-logo.png";
import { HeaderBackButton } from "@/components/HeaderBackButton";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { useIsMobile } from "@/hooks/use-mobile";

import { SafeNotificationBadge } from "@/components/NotificationBadge";

import { useAdminRole } from "@/hooks/useAdminRole";
import { SmartyCoachModal, SmartyCoachButton } from "@/components/smarty-coach";
import smartyCoachIcon from "@/assets/smarty-gym-icon-noborder.png";
import { cn } from "@/lib/utils";

interface SubscriptionInfo {
  subscribed: boolean;
  product_id: string | null;
  subscription_end: string | null;
}

interface CorporateSubscriptionInfo {
  plan_type: string;
  status: string;
}

export const Navigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { resolvedTheme, setTheme } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const [corporateSubscription, setCorporateSubscription] = useState<CorporateSubscriptionInfo | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [desktopMenuOpen, setDesktopMenuOpen] = useState(false);
  const [smartyCoachOpen, setSmartyCoachOpen] = useState(false);
  const isMobile = useIsMobile();
  const { data: unreadCount = 0, refetch: refetchUnread } = useUnreadMessages();
  const { isAdmin } = useAdminRole();
  const headerRef = useRef<HTMLElement>(null);
  const [headerHidden, setHeaderHidden] = useState(false);

  // Header stays permanently visible — no hide-on-scroll.
  useEffect(() => {
    setHeaderHidden(false);
  }, [isMobile]);

  // Dynamically set --app-header-h CSS variable based on actual header height
  useLayoutEffect(() => {
    let frame = 0;
    const updateHeaderHeight = () => {
      if (headerRef.current) {
        const height = headerRef.current.offsetHeight;
        document.documentElement.style.setProperty('--app-header-h', `${height}px`);
      }
    };

    updateHeaderHeight();

    const resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateHeaderHeight);
    });
    if (headerRef.current) {
      resizeObserver.observe(headerRef.current);
    }

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
    };
  }, [isMobile]);

  // Listen for messages being read to update badge immediately
  useEffect(() => {
    const handleMessagesRead = () => {
      refetchUnread();
    };
    
    window.addEventListener('messages-read', handleMessagesRead);
    return () => window.removeEventListener('messages-read', handleMessagesRead);
  }, [refetchUnread]);

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserData(session.user.id);
        checkSubscription();
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        // Defer Supabase calls to prevent deadlock
        setTimeout(() => {
          loadUserData(session.user.id);
          checkSubscription();
        }, 0);
      } else {
        setAvatarUrl(null);
        setSubscriptionInfo(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserData = async (userId: string) => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("avatar_url, full_name")
      .eq("user_id", userId)
      .maybeSingle();

    if (profile) {
      setAvatarUrl(profile.avatar_url);
      setProfileName(profile.full_name || null);
    }

    // Check for corporate subscription
    const { data: corpSub } = await supabase
      .from('corporate_subscriptions')
      .select('plan_type, status')
      .eq('admin_user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    if (corpSub) {
      setCorporateSubscription(corpSub);
    } else {
      setCorporateSubscription(null);
    }
  };

  const getCorporatePlanName = (planType: string) => {
    const names: Record<string, string> = {
      'dynamic': 'Dynamic',
      'power': 'Power',
      'elite': 'Elite',
      'enterprise': 'Enterprise'
    };
    return names[planType.toLowerCase()] || planType;
  };

  const checkSubscription = async () => {
    try {
      // Read subscription directly from database for faster access
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: dbData, error: dbError } = await supabase
        .from('user_subscriptions')
        .select('plan_type, status, current_period_end, stripe_subscription_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (dbError && dbError.code !== 'PGRST116') {
        console.error("Database subscription error:", dbError);
        return;
      }

      const isSubscribed = dbData?.status === 'active' &&
                         ['premium', 'lifetime', 'legacy_premium'].includes(dbData?.plan_type ?? '');

      setSubscriptionInfo({
        subscribed: isSubscribed,
        product_id: dbData?.plan_type || null,
        subscription_end: dbData?.current_period_end || null
      });
    } catch (error) {
      console.error("Error checking subscription:", error);
    }
  };

  const handleLogout = async () => {
    try {
      // Clear all local state first
      setUser(null);
      setAvatarUrl(null);
      setSubscriptionInfo(null);
      
      // Sign out with global scope to clear all sessions
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      
      if (error) {
        console.error("Logout error:", error);
        toast({
          title: "Error",
          description: "Failed to log out completely. Please try again.",
          variant: "destructive"
        });
        return;
      }
      
      toast({
        title: "Logged out",
        description: "You have been logged out successfully",
      });
      
      // Navigate to home and force page reload to clear all state
      navigate("/");
      setTimeout(() => {
        window.scrollTo(0, 0);
        window.location.reload();
      }, 100);
    } catch (error) {
      console.error("Logout error:", error);
      toast({
        title: "Error",
        description: "Failed to log out. Please try again.",
        variant: "destructive"
      });
    }
  };

  const getUserInitials = () => {
    // Prefer profile name from DB, fall back to auth metadata, then email
    const name = (profileName || user?.user_metadata?.full_name || "").trim();
    if (name) {
      const parts = name.split(" ").filter(p => p.length > 0);
      return parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0][0];
    }
    return user?.email?.[0].toUpperCase() || "U";
  };

  const getPlanName = (productId: string | null) => {
    if (!productId) return null;
    // productId mirrors plan_type from the database.
    const planType = productId.toLowerCase();
    if (planType === "free") return null; // Don't show "Free" as a plan name
    if (planType === "lifetime") return "Grandfathered Premium";
    // Legacy gold/platinum holders (and any future 'premium' / 'legacy_premium') all surface as Premium.
    return "Premium";
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
    setDesktopMenuOpen(false);
    setMobileDrawerOpen(false);
    // Scroll to top after navigation
    setTimeout(() => window.scrollTo(0, 0), 0);
  };

  const handleProfileNavigate = (path: string) => {
    navigate(path);
    // Scroll to top after navigation
    setTimeout(() => window.scrollTo(0, 0), 0);
  };

  const discoveryItems = [
    { label: "About SmartyGym", path: "/about", icon: Info, iconClass: "text-teal-500", track: undefined },
    { label: "Smarty Workouts", path: "/workout", icon: Dumbbell, iconClass: "text-primary", track: undefined },
    { label: "Smarty Programs", path: "/trainingprogram", icon: ListChecks, iconClass: "text-blue-500", track: undefined },
    { label: "Smarty Ritual", path: "/daily-ritual", icon: Sparkles, iconClass: "text-purple-500", track: undefined },
    { label: "Smarty Tools", path: "/tools", icon: Wrench, iconClass: "text-orange-500", track: undefined },
    { label: "Smarty Blog", path: "/blog", icon: Newspaper, iconClass: "text-red-500", track: undefined },
    { label: "Exercise Library", path: "/exerciselibrary", icon: BookOpen, iconClass: "text-emerald-500", track: undefined },
    { label: "Community", path: "/community", icon: Users, iconClass: "text-cyan-500", track: undefined },
    { label: "Smarty Premium", path: "/smarty-premium", icon: Crown, iconClass: "text-yellow-500", track: undefined },
    { label: "FAQ", path: "/faq", icon: HelpCircle, iconClass: "text-purple-500", track: undefined },
    { label: "Contact", path: "/contact", icon: Mail, iconClass: "text-indigo-500", track: undefined, subtitle: "One click away, always." },
  ];

  type NavSection = { heading: string; items: { label: string; path: string; icon: any }[] };

  const exploreItems = [
    { label: "Smarty Workouts", path: "/workout", icon: Dumbbell },
    { label: "Smarty Programs", path: "/trainingprogram", icon: ListChecks },
    { label: "Smarty Ritual", path: "/daily-ritual", icon: Sparkles },
    { label: "Smarty Tools", path: "/tools", icon: Wrench },
    { label: "Smarty Blog", path: "/blog", icon: Newspaper },
    { label: "Exercise Library", path: "/exerciselibrary", icon: BookOpen },
    { label: "Community", path: "/community", icon: Users },
  ];

  const legalItems = [
    { label: "Privacy Policy", path: "/privacy", icon: Shield },
    { label: "Terms of Service", path: "/termsofservice", icon: FileText },
    { label: "Disclaimer", path: "/disclaimer", icon: AlertTriangle },
  ];

  // Desktop hides the About page (content overlaps with the homepage) and uses Home instead.
  const mobileSections: NavSection[] = [
    { heading: "Explore", items: exploreItems },
    {
      heading: "SmartyGym",
      items: [
        { label: "About SmartyGym", path: "/about", icon: Info },
        { label: "Smarty Premium", path: "/smarty-premium", icon: Crown },
        { label: "FAQ", path: "/faq", icon: HelpCircle },
        { label: "Contact", path: "/contact", icon: Mail },
      ],
    },
    { heading: "Legal", items: legalItems },
  ];

  const desktopSections: NavSection[] = [
    { heading: "Explore", items: exploreItems },
    {
      heading: "SmartyGym",
      items: [
        { label: "Home", path: "/", icon: Home },
        { label: "Smarty Premium", path: "/smarty-premium", icon: Crown },
        { label: "FAQ", path: "/faq", icon: HelpCircle },
        { label: "Contact", path: "/contact", icon: Mail },
      ],
    },
    { heading: "Legal", items: legalItems },
  ];

  const renderNavSections = (sections: NavSection[]) => (
    <nav className="flex-1 overflow-y-auto px-1 pb-6">
      {sections.map((section) => (
        <div key={section.heading} className="mt-1">
          <div className="px-2 pb-1.5 pt-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {section.heading}
          </div>
          <ul className="space-y-0.5">
            {section.items.map(({ label, path, icon: Icon }) => {
              const active = location.pathname === path;
              return (
                <li key={path}>
                  <button
                    type="button"
                    onClick={() => handleNavigate(path)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition-colors",
                      active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-primary/10",
                    )}
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    {label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
    {isMobile && (
      <header
        ref={headerRef}
        className="fixed top-0 left-0 right-0 z-50 bg-background"
      >
        <div className="flex h-11 items-center justify-between gap-2 px-3">
          <div className="flex items-center gap-2">
            <Sheet open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label="Open menu"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-primary hover:bg-primary/10"
                >
                  <Menu className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="flex h-full w-[85%] max-w-[340px] flex-col gap-0 border-0 p-3 sm:max-w-[340px]">
                <div className="mb-1 flex h-10 shrink-0 items-center">
                  <div className="text-base font-extrabold tracking-tight">
                    <span className="text-primary">SMARTY</span>
                    <span className="text-green-500">GYM</span>
                  </div>
                </div>
                {renderNavSections(mobileSections)}
              </SheetContent>
            </Sheet>
            <HeaderBackButton />
            <button
              type="button"
              onClick={() => {
                if (location.pathname === "/") {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                } else {
                  navigate("/");
                  setTimeout(() => window.scrollTo(0, 0), 0);
                }
              }}
              aria-label="SmartyGym home"
              className="text-lg font-extrabold tracking-tight leading-none"
            >
              <span className="text-primary">SMARTY</span>
              <span className="text-green-500">GYM</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSmartyCoachOpen(true)}
            aria-label="Smarty Coach"
            className="smarty-coach-blink motion-reduce:animate-none inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary bg-background shadow-[0_2px_8px_-2px_hsl(var(--primary)/0.4)]"
          >
            <img src={smartyCoachIcon} alt="" aria-hidden="true" className="h-6 w-6 rounded-full object-contain" width={24} height={24} />
          </button>
          {user ? (
            <DropdownMenu open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Account"
                  className="relative inline-flex items-center justify-center rounded-full"
                >
                  <Avatar className="h-8 w-8 border-2 border-primary">
                    <AvatarImage src={avatarUrl || undefined} alt="Profile" />
                    <AvatarFallback className="text-xs">{getUserInitials()}</AvatarFallback>
                  </Avatar>
                  {unreadCount > 0 && (
                    <span className="pointer-events-none absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-background" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 max-w-[calc(100vw-2rem)] bg-popover" align="end" sideOffset={6}>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{profileName || user.user_metadata?.full_name || "User"}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => handleProfileNavigate("/userdashboard")}>
                  <LayoutDashboard className="mr-2 h-4 w-4" /><span>Dashboard</span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleProfileNavigate("/userdashboard?tab=messages")}>
                  <div className="relative mr-2">
                    <Mail className={`h-4 w-4 ${unreadCount > 0 ? 'text-red-500' : ''}`} />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-popover" />
                    )}
                  </div>
                  <span>Messages</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    setTheme(resolvedTheme === "dark" ? "light" : "dark");
                    setMobileMenuOpen(false);
                  }}
                >
                  {resolvedTheme === "dark" ? (
                    <><Sun className="mr-2 h-4 w-4" /><span>Light Mode</span></>
                  ) : (
                    <><Moon className="mr-2 h-4 w-4" /><span>Dark Mode</span></>
                  )}
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => { navigate("/admin"); setTimeout(() => window.scrollTo(0, 0), 0); }}>
                      <Shield className="mr-2 h-4 w-4" /><span>Admin</span>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" /><span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <DropdownMenu open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-7 items-center justify-center rounded-full border-2 border-primary px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  Log In
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48 max-w-[calc(100vw-2rem)] bg-popover" align="end" sideOffset={6}>
                <DropdownMenuItem onSelect={() => { navigate("/auth?mode=login"); setTimeout(() => window.scrollTo(0, 0), 0); }}>
                  <UserIcon className="mr-2 h-4 w-4" /><span>Login</span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => { navigate("/auth?mode=signup"); setTimeout(() => window.scrollTo(0, 0), 0); }}>
                  <UserIcon className="mr-2 h-4 w-4" /><span>Sign Up</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => {
                    setTheme(resolvedTheme === "dark" ? "light" : "dark");
                    setMobileMenuOpen(false);
                  }}
                >
                  {resolvedTheme === "dark" ? (
                    <><Sun className="mr-2 h-4 w-4" /><span>Light Mode</span></>
                  ) : (
                    <><Moon className="mr-2 h-4 w-4" /><span>Dark Mode</span></>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          </div>
        </div>
      </header>
    )}
    {!isMobile && (
    <header
      ref={headerRef}
      className={cn(
        "fixed top-0 left-0 right-0 z-50 bg-background transition-transform duration-300 will-change-transform",
        headerHidden && "-translate-y-full"
      )}
    >
      <div className="relative flex h-11 items-center px-3">
        {/* Left: Hamburger + SMARTYGYM wordmark */}
        <div className="flex items-center gap-2">
        <Sheet open={desktopMenuOpen} onOpenChange={setDesktopMenuOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-primary hover:bg-primary/10 transition-colors"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="flex h-full w-[340px] flex-col gap-0 border-0 p-3 sm:max-w-[340px]">
            <div className="mb-1 flex h-10 shrink-0 items-center">
              <div className="text-base font-extrabold tracking-tight">
                <span className="text-primary">SMARTY</span>
                <span className="text-green-500">GYM</span>
              </div>
            </div>
            {renderNavSections(desktopSections)}
          </SheetContent>
        </Sheet>
          <HeaderBackButton />
          <button
            type="button"
            onClick={() => {
              if (location.pathname === "/") {
                window.scrollTo({ top: 0, behavior: "smooth" });
              } else {
                navigate("/");
                setTimeout(() => window.scrollTo(0, 0), 0);
              }
            }}
            aria-label="SmartyGym home"
            className="text-lg font-extrabold tracking-tight leading-none"
          >
            <span className="text-primary">SMARTY</span>
            <span className="text-green-500">GYM</span>
          </button>
        </div>

        {/* Far-right: Avatar/Login */}
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Account"
                  className="relative inline-flex items-center justify-center rounded-full"
                >
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary transition-colors hover:bg-primary/10 ${subscriptionInfo?.subscribed ? 'ring-2 ring-yellow-500 ring-offset-2 ring-offset-background' : ''} ${corporateSubscription ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-background' : ''}`}>
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={avatarUrl || undefined} alt="Profile" />
                      <AvatarFallback className="text-xs">{getUserInitials()}</AvatarFallback>
                    </Avatar>
                  </div>
                  {unreadCount > 0 && (
                    <span className="pointer-events-none absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-background" />
                  )}
                  {subscriptionInfo?.subscribed && (
                    <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-yellow-500 flex items-center justify-center">
                      <Crown className="h-2.5 w-2.5 text-white" />
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-popover" align="end" forceMount sideOffset={6}>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{profileName || user.user_metadata?.full_name || "User"}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {subscriptionInfo && (
                  <>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex items-center gap-2">
                        <Crown className={`h-4 w-4 ${subscriptionInfo.subscribed ? 'text-primary' : 'text-muted-foreground'}`} />
                        <p className="text-sm font-medium leading-none">
                          {subscriptionInfo.subscribed ? `${getPlanName(subscriptionInfo.product_id)} Plan` : "Free Plan"}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                  </>
                )}
                {corporateSubscription && (
                  <>
                    <DropdownMenuItem onSelect={() => handleProfileNavigate("/corporate-admin")}>
                      <Users className="mr-2 h-4 w-4" /><span>Manage Team</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onSelect={() => handleProfileNavigate("/userdashboard")}>
                  <LayoutDashboard className="mr-2 h-4 w-4" /><span>Dashboard</span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleProfileNavigate("/userdashboard?tab=messages")}>
                  <div className="relative mr-2">
                    <Mail className={`h-4 w-4 ${unreadCount > 0 ? 'text-red-500' : ''}`} />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-popover" />
                    )}
                  </div>
                  <span>Messages</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    setTheme(resolvedTheme === "dark" ? "light" : "dark");
                  }}
                >
                  {resolvedTheme === "dark" ? (
                    <><Sun className="mr-2 h-4 w-4" /><span>Light Mode</span></>
                  ) : (
                    <><Moon className="mr-2 h-4 w-4" /><span>Dark Mode</span></>
                  )}
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => { navigate("/admin"); setTimeout(() => window.scrollTo(0, 0), 0); }}>
                      <Shield className="mr-2 h-4 w-4" /><span>Admin</span>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" /><span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-7 items-center justify-center rounded-full border-2 border-primary px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  Log In
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48 bg-popover" align="end" sideOffset={6}>
                <DropdownMenuItem onSelect={() => { navigate("/auth?mode=login"); setTimeout(() => window.scrollTo(0, 0), 0); }}>
                  <UserIcon className="mr-2 h-4 w-4" /><span>Login</span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => { navigate("/auth?mode=signup"); setTimeout(() => window.scrollTo(0, 0), 0); }}>
                  <UserIcon className="mr-2 h-4 w-4" /><span>Sign Up</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(e) => {
                    setTheme(resolvedTheme === "dark" ? "light" : "dark");
                  }}
                >
                  {resolvedTheme === "dark" ? (
                    <><Sun className="mr-2 h-4 w-4" /><span>Light Mode</span></>
                  ) : (
                    <><Moon className="mr-2 h-4 w-4" /><span>Dark Mode</span></>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
    )}
    <SmartyCoachModal isOpen={smartyCoachOpen} onClose={() => setSmartyCoachOpen(false)} />
    {!isMobile && <SmartyCoachButton />}
    </>
  );
};
