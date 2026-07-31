import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet";
import { useAdminRole } from "@/hooks/useAdminRole";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Folder, Users, Mail, FileText, Settings, BarChart3, BookOpen, MessageSquare, Inbox, Megaphone, TrendingUp, Plus, Dumbbell, Calendar, Bell, ShoppingBag, Sparkles, Building2, Video, Smartphone, Clock, WifiOff, Search, CreditCard } from "lucide-react";
import { ContentManager } from "@/components/admin/ContentManager";
import { CommunicationsManager } from "@/components/admin/CommunicationsManager";
import { EmailManager } from "@/components/admin/EmailManager";
import { UsersManager } from "@/components/admin/UsersManager";
import { ModerationDashboard } from "@/components/admin/ModerationDashboard";
import { AnalyticsDashboard } from "@/components/admin/AnalyticsDashboard";
import { SocialMediaAnalytics } from "@/components/admin/SocialMediaAnalytics";
import { BlogManager } from "@/components/admin/BlogManager";
import { ContactManager } from "@/components/admin/ContactManager";
import { MarketingManager } from "@/components/admin/MarketingManager";
import { ShopManager } from "@/components/admin/ShopManager";
import { ShopOrdersManager } from "@/components/admin/ShopOrdersManager";
import { SettingsManager } from "@/components/admin/SettingsManager";
import { CommentModerationPanel } from "@/components/admin/CommentModerationPanel";
import { NotificationHistoryManager } from "@/components/admin/NotificationHistoryManager";
import { AdminDocumentationManager } from "@/components/admin/AdminDocumentationManager";
import { CorporateDashboard } from "@/components/admin/CorporateDashboard";
import ExerciseLibraryManager from "@/components/admin/ExerciseLibraryManager";
import SmartyGymAppVault from "@/pages/admin/SmartyGymAppVault";
import { CronJobsManager } from "@/components/admin/CronJobsManager";
import { PaymentsManager } from "@/components/admin/PaymentsManager";
import { supabase } from "@/integrations/supabase/client";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { OfflineBanner } from "@/components/OfflineBanner";

export default function AdminBackoffice() {
  const navigate = useNavigate();
  const { isAdmin, loading } = useAdminRole();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('section') || null;
  
  const setActiveTab = useCallback((tab: string | null) => {
    if (tab) {
      setSearchParams({ section: tab });
    } else {
      setSearchParams({});
    }
  }, [setSearchParams]);
  const [contentInnerTab, setContentInnerTab] = useState("workouts");
  const [showWorkoutDialog, setShowWorkoutDialog] = useState(false);
  const [showProgramDialog, setShowProgramDialog] = useState(false);
  const [showRitualDialog, setShowRitualDialog] = useState(false);
  const [newContactCount, setNewContactCount] = useState(0);
  const { isOffline } = useNetworkStatus();

  // Admin sections configuration with colorful icons
  const adminSections = [
    { id: "content", label: "Content", description: "Workouts, programs & rituals", icon: Folder, color: "text-blue-500", bgColor: "bg-blue-500/10" },
    { id: "community", label: "Community", description: "Moderation & comments", icon: Users, color: "text-purple-500", bgColor: "bg-purple-500/10" },
    { id: "contact", label: "Contact", description: "User messages & support", icon: Inbox, color: "text-red-500", bgColor: "bg-red-500/10", badge: newContactCount },
    { id: "communications", label: "Auto-Messages", description: "Automated notifications", icon: MessageSquare, color: "text-green-500", bgColor: "bg-green-500/10" },
    { id: "email", label: "Email", description: "Campaigns & templates", icon: Mail, color: "text-amber-500", bgColor: "bg-amber-500/10" },
    { id: "cron-jobs", label: "Cron Jobs", description: "Scheduled tasks", icon: Clock, color: "text-cyan-500", bgColor: "bg-cyan-500/10" },
    { id: "users", label: "Users", description: "User management", icon: Users, color: "text-indigo-500", bgColor: "bg-indigo-500/10" },
    { id: "corporate", label: "Corporate", description: "Business accounts", icon: Building2, color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
    { id: "blog", label: "Blog", description: "Articles & posts", icon: BookOpen, color: "text-orange-500", bgColor: "bg-orange-500/10" },
    { id: "marketing", label: "Marketing", description: "Campaigns & promos", icon: Megaphone, color: "text-pink-500", bgColor: "bg-pink-500/10" },
    { id: "analytics", label: "Analytics", description: "Stats & reports", icon: BarChart3, color: "text-violet-500", bgColor: "bg-violet-500/10" },
    { id: "social", label: "Social", description: "Social media tracking", icon: TrendingUp, color: "text-sky-500", bgColor: "bg-sky-500/10" },
    { id: "settings", label: "Settings", description: "System configuration", icon: Settings, color: "text-slate-500", bgColor: "bg-slate-500/10" },
    { id: "notification-history", label: "Notifications", description: "Push notification logs", icon: Bell, color: "text-yellow-500", bgColor: "bg-yellow-500/10" },
    { id: "shop", label: "Shop", description: "Products & orders", icon: ShoppingBag, color: "text-rose-500", bgColor: "bg-rose-500/10" },
    { id: "payments", label: "Payments", description: "Stripe & platform controls", icon: CreditCard, color: "text-green-600", bgColor: "bg-green-600/10" },
    { id: "exercise-library", label: "Exercise Library", description: "Video tutorials", icon: Video, color: "text-teal-500", bgColor: "bg-teal-500/10" },
    { id: "docs", label: "Docs", description: "Documentation", icon: FileText, color: "text-lime-600", bgColor: "bg-lime-500/10" },
    { id: "smartygym-app", label: "SmartyGym App", description: "App vault & settings", icon: Smartphone, color: "text-fuchsia-500", bgColor: "bg-fuchsia-500/10" },
    { id: "seo-preview", label: "SEO Preview", description: "Inspect schemas & meta tags", icon: Search, color: "text-orange-400", bgColor: "bg-orange-400/10" },
  ];

  useEffect(() => {
    if (isAdmin) {
      fetchNewContactCount();

      // AUTO-RUN: Fix Stripe metadata once per 24 hours (no button needed)
      const runStripeMetadataFix = async () => {
        const STORAGE_KEY = 'lastStripeMetadataFix';
        const lastRun = localStorage.getItem(STORAGE_KEY);
        const now = Date.now();
        const ONE_DAY = 24 * 60 * 60 * 1000;
        
        if (lastRun && now - parseInt(lastRun) < ONE_DAY) {
          console.log('[AdminBackoffice] Stripe metadata fix already ran today, skipping');
          return;
        }
        
        try {
          console.log('[AdminBackoffice] Running automatic Stripe metadata fix...');
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return;
          
          const { data, error } = await supabase.functions.invoke('fix-stripe-metadata', {
            body: { dryRun: false }
          });
          
          if (error) {
            console.error('[AdminBackoffice] Stripe metadata fix failed:', error);
          } else if (data?.fixed > 0) {
            console.log(`[AdminBackoffice] Stripe metadata fix complete: ${data.fixed} products fixed`);
          } else {
            console.log('[AdminBackoffice] Stripe metadata check complete: all products correctly tagged');
          }
          
          localStorage.setItem(STORAGE_KEY, now.toString());
        } catch (err) {
          console.error('[AdminBackoffice] Stripe metadata fix error:', err);
        }
      };
      
      runStripeMetadataFix();

      // Subscribe to real-time updates
      const channel = supabase
        .channel('contact_messages_admin')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'contact_messages'
          },
          () => {
            fetchNewContactCount();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'contact_messages'
          },
          () => {
            fetchNewContactCount();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isAdmin]);

  const fetchNewContactCount = async () => {
    const { count } = await supabase
      .from('contact_messages')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'new');
    
    setNewContactCount(count || 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You don't have permission to access this area.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/")} className="w-full">
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
    <Helmet>
      <title>Admin Backoffice | SmartyGym</title>
      <meta name="description" content="Private SmartyGym administration area for content, users, messages, analytics, shop, and system settings." />
      <meta name="robots" content="noindex, nofollow" />
    </Helmet>
    <div className="min-h-screen bg-background">
      <OfflineBanner />
      
      {/* Offline Read-Only Mode Banner */}
      {isOffline && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-3 mt-8">
          <div className="container mx-auto flex items-center gap-3">
            <WifiOff className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-sm font-medium text-amber-500">Offline Mode - Read Only</p>
              <p className="text-xs text-muted-foreground">You're viewing cached data. Changes will not be saved until you're back online.</p>
            </div>
          </div>
        </div>
      )}
      
      <div className={`container mx-auto pb-4 sm:pb-8 px-2 sm:px-4 ${isOffline ? '' : ''}`}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
          <div className="flex items-center gap-2 sm:gap-4">
            <div>
              <h1 className="text-2xl sm:text-4xl font-bold">Admin Backoffice</h1>
              <p className="text-xs sm:text-base text-muted-foreground">Manage your platform</p>
            </div>
          </div>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="default" className="gap-2" disabled={isOffline}>
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Create Content</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-background border-border z-50">
                <DropdownMenuItem 
                  onClick={() => {
                    setActiveTab("content");
                    setTimeout(() => setShowWorkoutDialog(true), 100);
                  }}
                  className="cursor-pointer"
                >
                  <Dumbbell className="h-4 w-4 mr-2" />
                  New Workout
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => {
                    setActiveTab("content");
                    setContentInnerTab("programs");
                    setTimeout(() => setShowProgramDialog(true), 100);
                  }}
                  className="cursor-pointer"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  New Training Program
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => {
                    setActiveTab("content");
                    setContentInnerTab("rituals");
                    setTimeout(() => setShowRitualDialog(true), 100);
                  }}
                  className="cursor-pointer"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  New Ritual
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => setActiveTab("content")}
                  className="cursor-pointer"
                >
                  <Folder className="h-4 w-4 mr-2" />
                  Go to Content Library
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Main Content */}
        {activeTab === null ? (
          /* Grid Navigation View */
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {adminSections.map((section) => {
              const IconComponent = section.icon;
              return (
                <Card 
                  key={section.id}
                  onClick={() => {
                    if (section.id === "seo-preview") {
                      navigate("/admin/seo-preview");
                    } else {
                      setActiveTab(section.id);
                    }
                  }}
                  className="cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all duration-200 group relative"
                >
                  <CardContent className="p-4 sm:p-6 flex flex-col items-center text-center gap-2 sm:gap-3">
                    <div className={`p-3 sm:p-4 rounded-full ${section.bgColor} group-hover:scale-110 transition-transform duration-200`}>
                      <IconComponent className={`h-6 w-6 sm:h-8 sm:w-8 ${section.color}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm sm:text-base">{section.label}</h3>
                      <p className="text-xs text-muted-foreground hidden sm:block mt-1">
                        {section.description}
                      </p>
                    </div>
                    {section.badge && section.badge > 0 && (
                      <Badge variant="destructive" className="absolute top-2 right-2">
                        {section.badge} new
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          /* Section Content View */
          <div>

            {/* Content Section */}
            {activeTab === "content" && (
              <ContentManager 
                externalWorkoutDialog={showWorkoutDialog}
                setExternalWorkoutDialog={setShowWorkoutDialog}
                externalProgramDialog={showProgramDialog}
                setExternalProgramDialog={setShowProgramDialog}
                externalRitualDialog={showRitualDialog}
                setExternalRitualDialog={setShowRitualDialog}
                activeInnerTab={contentInnerTab}
              />
            )}

            {/* Community Section */}
            {activeTab === "community" && (
              <Tabs defaultValue="moderation" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="moderation">Moderation</TabsTrigger>
                  <TabsTrigger value="comments">Comments & Flags</TabsTrigger>
                </TabsList>
                <TabsContent value="moderation" className="mt-4">
                  <ModerationDashboard />
                </TabsContent>
                <TabsContent value="comments" className="mt-4">
                  <CommentModerationPanel />
                </TabsContent>
              </Tabs>
            )}

            {/* Contact Section */}
            {activeTab === "contact" && <ContactManager />}

            {/* Communications Section */}
            {activeTab === "communications" && <CommunicationsManager />}

            {/* Email Section */}
            {activeTab === "email" && <EmailManager />}

            {/* Cron Jobs Section */}
            {activeTab === "cron-jobs" && <CronJobsManager />}

            {/* Users Section */}
            {activeTab === "users" && <UsersManager />}

            {/* Corporate Section */}
            {activeTab === "corporate" && <CorporateDashboard />}

            {/* Blog Section */}
            {activeTab === "blog" && <BlogManager />}

            {/* Marketing Section */}
            {activeTab === "marketing" && <MarketingManager />}

            {/* Analytics Section */}
            {activeTab === "analytics" && <AnalyticsDashboard />}

            {/* Social Section */}
            {activeTab === "social" && <SocialMediaAnalytics />}

            {/* Settings Section */}
            {activeTab === "settings" && <SettingsManager />}

            {/* Notification History Section */}
            {activeTab === "notification-history" && <NotificationHistoryManager />}

            {/* Shop Section */}
            {activeTab === "shop" && (
              <Tabs defaultValue="products" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="products">Products</TabsTrigger>
                  <TabsTrigger value="orders">Orders</TabsTrigger>
                </TabsList>
                <TabsContent value="products" className="mt-4">
                  <ShopManager />
                </TabsContent>
                <TabsContent value="orders" className="mt-4">
                  <ShopOrdersManager />
                </TabsContent>
              </Tabs>
            )}

            {/* Exercise Library Section */}
            {activeTab === "exercise-library" && <ExerciseLibraryManager />}

            {/* Payments Section */}
            {activeTab === "payments" && <PaymentsManager />}

            {/* Docs Section */}
            {activeTab === "docs" && <AdminDocumentationManager />}

            {/* SmartyGym App Section */}
            {activeTab === "smartygym-app" && <SmartyGymAppVault />}
          </div>
        )}
      </div>
    </div>
    </>
  );
}
