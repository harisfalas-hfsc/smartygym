import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { usePurchases } from "@/hooks/usePurchases";
import { UserMessagesPanel } from "@/components/UserMessagesPanel";
import { MyOrders } from "@/components/MyOrders";
import { useQuery } from "@tanstack/react-query";
import { useAccessControl } from "@/hooks/useAccessControl";
import { openExternal } from "@/utils/native";

import { useAdminRole } from "@/hooks/useAdminRole";
import { Heart, CheckCircle, Clock, Star, Play, Dumbbell, Calendar, Crown, Calculator, ShoppingBag, MessageSquare, Loader2, RefreshCw, ExternalLink, ClipboardList, TrendingUp, BookOpen, Headphones, Sparkles, Quote, User as UserIcon, Scale, Building2, Users, ClipboardCheck, FileText, Trash2, Settings } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MyRecordsReport } from "@/components/dashboard/MyRecordsReport";
import { LogBookFilters } from "@/components/logbook/LogBookFilters";
import { LogBookCalendar } from "@/components/logbook/LogBookCalendar";
import { LogBookAdvancedCharts } from "@/components/logbook/LogBookAdvancedCharts";
import { LogBookAdvancedExport } from "@/components/logbook/LogBookAdvancedExport";
import { MeasurementDialog } from "@/components/logbook/MeasurementDialog";
import { GoalsSummaryCard } from "@/components/dashboard/GoalsSummaryCard";

import { CheckInModalManager, useCheckInBanner } from "@/components/checkins/CheckInModalManager";
import { CheckInBanner } from "@/components/checkins/CheckInBanner";
import { CheckInDashboardCard } from "@/components/checkins/CheckInDashboardCard";
import { SmartyCheckinsTab } from "@/components/checkins/SmartyCheckinsTab";
import { MorningCheckInForm } from "@/components/checkins/MorningCheckInForm";
import { NightCheckInForm } from "@/components/checkins/NightCheckInForm";
import { useCheckins } from "@/hooks/useCheckins";
import { useCheckInWindow } from "@/hooks/useCheckInWindow";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";


import { AccountSettingsSection } from "@/components/dashboard/AccountSettingsSection";
import { ParQAssessmentSection } from "@/components/dashboard/ParQAssessmentSection";
import { ActivityListSheet, type ActivityItem } from "@/components/dashboard/ActivityListSheet";
import { ChevronRight } from "lucide-react";
interface WorkoutInteraction {
  id: string;
  workout_id: string;
  workout_name: string;
  workout_type: string;
  is_favorite: boolean;
  is_completed: boolean;
  has_viewed: boolean;
  rating: number | null;
  created_at: string;
  updated_at: string;
}
interface ProgramInteraction {
  id: string;
  program_id: string;
  program_name: string;
  program_type: string;
  is_favorite: boolean;
  is_completed: boolean;
  is_ongoing?: boolean | null;
  has_viewed: boolean;
  rating: number | null;
  created_at: string;
  updated_at: string;
}
interface FavoriteExercise {
  id: string;
  exercise_name: string;
  created_at: string;
}
interface CalculatorRecord {
  id: string;
  created_at: string;
}
interface OneRMRecord extends CalculatorRecord {
  weight_lifted: number;
  reps: number;
  one_rm_result: number;
  exercise_name: string | null;
}
interface BMRRecord extends CalculatorRecord {
  age: number;
  weight: number;
  height: number;
  gender: string;
  bmr_result: number;
}
interface CalorieRecord extends CalculatorRecord {
  age: number;
  weight: number;
  height: number;
  gender: string;
  activity_level: string;
  goal: string;
  maintenance_calories: number;
  target_calories: number;
}
interface SubscriptionInfo {
  subscribed: boolean;
  product_id: string | null;
  subscription_end: string | null;
  status?: string | null;
}
interface CorporateSubscriptionInfo {
  id: string;
  plan_type: string;
  current_users_count: number;
  max_users: number;
  organization_name: string;
  current_period_end: string;
  status: string;
}
interface StripeSubscription {
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
}
export default function UserDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const {
    toast
  } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [workoutInteractions, setWorkoutInteractions] = useState<WorkoutInteraction[]>([]);
  const [programInteractions, setProgramInteractions] = useState<ProgramInteraction[]>([]);
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const {
    userTier
  } = useAccessControl();
  const { isAdmin, loading: adminLoading } = useAdminRole();
  const isPremium = userTier === "premium";
  const [stripeDetails, setStripeDetails] = useState<StripeSubscription | null>(null);
  const [corporateSubscription, setCorporateSubscription] = useState<CorporateSubscriptionInfo | null>(null);
  const [favoriteExercises, setFavoriteExercises] = useState<FavoriteExercise[]>([]);
  const [oneRMHistory, setOneRMHistory] = useState<OneRMRecord[]>([]);
  const [bmrHistory, setBMRHistory] = useState<BMRRecord[]>([]);
  const [calorieHistory, setCalorieHistory] = useState<CalorieRecord[]>([]);
  const [measurementHistory, setMeasurementHistory] = useState<any[]>([]);
  const [isMeasurementDialogOpen, setIsMeasurementDialogOpen] = useState(false);
  const [showMorningForm, setShowMorningForm] = useState(false);
  const [showNightForm, setShowNightForm] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; type: string; id: string } | null>(null);

  // Activity drill-in sheet (Favorites / Completed / Viewed / Rated / In Progress)
  const [activitySheet, setActivitySheet] = useState<
    | { kind: "workout" | "program"; bucket: "favorites" | "completed" | "viewed" | "rated" | "inprogress" }
    | null
  >(null);

  // Check-in hooks
  const {
    bannerState,
    handleBannerStateChange
  } = useCheckInBanner();
  const {
    todayCheckin,
    stats,
    submitMorningCheckin,
    submitNightCheckin,
    fetchTodayCheckin
  } = useCheckins();
  const {
    isMorningWindow,
    isNightWindow,
    morningWindowEnd,
    nightWindowEnd
  } = useCheckInWindow();

  // Get tab from URL or default to null (grid view)
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<string | null>(tabParam || null);

  // LogBook filter state
  const [logBookFilter, setLogBookFilter] = useState<'all' | 'workout' | 'program' | 'tool' | 'measurement'>('all');
  const [logBookSecondaryFilter, setLogBookSecondaryFilter] = useState("all");
  const [logBookTimeFilter, setLogBookTimeFilter] = useState<'last_month' | 'last_12_months' | 'last_6_months' | 'custom'>('last_6_months');
  const [logBookCustomStartDate, setLogBookCustomStartDate] = useState<Date | undefined>();
  const [logBookCustomEndDate, setLogBookCustomEndDate] = useState<Date | undefined>();

  // Fetch user purchases
  const {
    data: purchases = [],
    isLoading: purchasesLoading
  } = usePurchases(user?.id);

  // Fetch unread messages count (both contact and system)
  const {
    data: unreadCount = 0,
    refetch: refetchUnreadCount
  } = useQuery({
    queryKey: ['unread-messages-count', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const [contactResult, systemResult] = await Promise.all([supabase.from('contact_messages').select('id, response').eq('user_id', user.id).is('response_read_at', null), supabase.from('user_system_messages').select('*', {
        count: 'exact',
        head: true
      }).eq('user_id', user.id).eq('is_read', false)]);
      if (contactResult.error) throw contactResult.error;

      const contactIds = (contactResult.data || []).map((thread) => thread.id);
      let historyReplyIds = new Set<string>();
      if (contactIds.length > 0) {
        const { data: historyReplies, error: historyError } = await supabase
          .from('contact_message_history')
          .select('contact_message_id')
          .in('contact_message_id', contactIds)
          .neq('sender', 'customer');
        if (historyError) throw historyError;
        historyReplyIds = new Set((historyReplies || []).map((reply) => reply.contact_message_id));
      }

      const contactCount = (contactResult.data || []).filter((thread) => Boolean(thread.response) || historyReplyIds.has(thread.id)).length;
      const systemCount = systemResult.count || 0;
      return contactCount + systemCount;
    },
    enabled: !!user
  });

  // Dashboard sections configuration for card grid (must be after unreadCount hook)
  const dashboardSections = [
    { 
      id: "workouts", 
      label: "Workouts", 
      description: "Favorites, completed & rated",
      icon: Dumbbell, 
      color: "text-orange-500", 
      bgColor: "bg-orange-500/10",
      hoverBorder: "hover:border-orange-500/50"
    },
    { 
      id: "programs", 
      label: "Programs", 
      description: "Training programs progress",
      icon: Calendar, 
      color: "text-blue-500", 
      bgColor: "bg-blue-500/10",
      hoverBorder: "hover:border-blue-500/50"
    },
    { 
      id: "purchases", 
      label: "My Purchases", 
      description: "Bought content & orders",
      icon: ShoppingBag, 
      color: "text-emerald-500", 
      bgColor: "bg-emerald-500/10",
      hoverBorder: "hover:border-emerald-500/50"
    },
    { 
      id: "messages", 
      label: "Messages", 
      description: "Inbox & notifications",
      icon: MessageSquare, 
      color: "text-purple-500", 
      bgColor: "bg-purple-500/10",
      hoverBorder: "hover:border-purple-500/50",
      badge: unreadCount
    },
    { 
      id: "logbook", 
      label: "My LogBook", 
      description: "Activity history & stats",
      icon: BookOpen, 
      color: "text-amber-500", 
      bgColor: "bg-amber-500/10",
      hoverBorder: "hover:border-amber-500/50"
    },
    { 
      id: "account", 
      label: "Account", 
      description: "Privacy & data settings",
      icon: Settings, 
      color: "text-slate-500", 
      bgColor: "bg-slate-500/10",
      hoverBorder: "hover:border-slate-500/50"
    },
  ];

  useEffect(() => {
    initDashboard();

    // Listen for auth state changes to handle session updates after refresh
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        setUser(null);
        setLoading(false);
        navigate('/auth');
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // Defer Supabase calls to prevent deadlock
        setUser(session.user);
        setTimeout(async () => {
          await Promise.allSettled([fetchAllData(session.user.id), checkSubscription(session.user.id)]);
          setLoading(false);
        }, 0);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Listen for purchase verification events to refresh data
  useEffect(() => {
    const handlePurchaseVerified = () => {
      if (user) {
        fetchAllData(user.id);
      }
    };
    window.addEventListener('purchase-verified', handlePurchaseVerified);
    return () => window.removeEventListener('purchase-verified', handlePurchaseVerified);
  }, [user]);

  // Sync activeTab with URL tab parameter changes
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam !== activeTab) {
      setActiveTab(tabParam || null);
    }
  }, [searchParams]);

  // Handle scroll to active-goals section from URL param
  useEffect(() => {
    const scrollTarget = searchParams.get('scroll');
    if (scrollTarget === 'active-goals' && !loading) {
      // Small delay to ensure the element is rendered
      setTimeout(() => {
        const element = document.getElementById('active-goals');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, [searchParams, loading]);
  const initDashboard = async () => {
    try {
      const {
        data: {
          session
        }
      } = await supabase.auth.getSession();
      if (!session?.user) {
        setLoading(false);
        navigate('/auth');
        return;
      }
      setUser(session.user);

      // Fetch all data in parallel with individual error handling
      await Promise.allSettled([fetchAllData(session.user.id), checkSubscription(session.user.id), fetchCorporateSubscription(session.user.id)]);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error initializing dashboard:", error);
      }
      toast({
        title: "Error",
        description: "Failed to load dashboard. Please refresh the page.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const fetchAllData = async (userId: string) => {
    // Use allSettled so individual failures don't block others
    await Promise.allSettled([fetchWorkoutInteractions(userId), fetchProgramInteractions(userId), fetchFavoriteExercises(userId), fetchCalculatorHistory(userId), fetchMeasurementHistory(userId)]);
  };
  const fetchWorkoutInteractions = async (userId: string) => {
    try {
      const {
        data,
        error
      } = await supabase.from("workout_interactions").select("*").eq("user_id", userId).order("updated_at", {
        ascending: false
      });
      if (error) throw error;
      if (data) setWorkoutInteractions(data);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error fetching workout interactions:", error);
      }
    }
  };
  const fetchProgramInteractions = async (userId: string) => {
    try {
      const {
        data,
        error
      } = await supabase.from("program_interactions").select("*").eq("user_id", userId).order("updated_at", {
        ascending: false
      });
      if (error) throw error;
      if (data) setProgramInteractions(data);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error fetching program interactions:", error);
      }
    }
  };
  const fetchFavoriteExercises = async (userId: string) => {
    // Favorite exercises feature removed
    setFavoriteExercises([]);
  };
  const fetchCorporateSubscription = async (userId: string) => {
    try {
      const {
        data,
        error
      } = await supabase.from('corporate_subscriptions').select('id, plan_type, current_users_count, max_users, organization_name, current_period_end, status').eq('admin_user_id', userId).eq('status', 'active').maybeSingle();
      if (error) {
        if (import.meta.env.DEV) {
          console.error("Error fetching corporate subscription:", error);
        }
        return;
      }
      if (data) {
        setCorporateSubscription(data);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error fetching corporate subscription:", error);
      }
    }
  };
  const getCorporatePlanDisplayName = (planType: string) => {
    const names: Record<string, string> = {
      'dynamic': 'Dynamic',
      'power': 'Power',
      'elite': 'Elite',
      'enterprise': 'Enterprise'
    };
    return names[planType.toLowerCase()] || planType;
  };
  const getCorporateDaysRemaining = () => {
    if (!corporateSubscription?.current_period_end) return null;
    const endDate = new Date(corporateSubscription.current_period_end);
    const today = new Date();
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };
  const fetchCalculatorHistory = async (userId: string) => {
    try {
      // Fetch all calculator histories in parallel
      const [onermResult, bmrResult, calorieResult] = await Promise.allSettled([supabase.from("onerm_history").select("*").eq("user_id", userId).order("created_at", {
        ascending: false
      }).limit(5), supabase.from("bmr_history").select("*").eq("user_id", userId).order("created_at", {
        ascending: false
      }).limit(5), supabase.from("calorie_history").select("*").eq("user_id", userId).order("created_at", {
        ascending: false
      }).limit(5)]);
      if (onermResult.status === 'fulfilled' && onermResult.value.data) {
        setOneRMHistory(onermResult.value.data);
      }
      if (bmrResult.status === 'fulfilled' && bmrResult.value.data) {
        setBMRHistory(bmrResult.value.data);
      }
      if (calorieResult.status === 'fulfilled' && calorieResult.value.data) {
        setCalorieHistory(calorieResult.value.data);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error fetching calculator history:", error);
      }
    }
  };
  const fetchMeasurementHistory = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_activity_log")
        .select("*")
        .eq("user_id", userId)
        .eq("content_type", "measurement")
        .order("created_at", { ascending: false })
        .limit(5);
      
      if (error) throw error;
      if (data) setMeasurementHistory(data);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error fetching measurements:", error);
      }
    }
  };

  const handleDeleteRecord = async () => {
    if (!deleteDialog || !user) return;
    
    const { type, id } = deleteDialog;
    let error = null;

    if (type === "1rm") {
      const result = await supabase.from("onerm_history").delete().eq("id", id);
      error = result.error;
      if (!error) await fetchCalculatorHistory(user.id);
    } else if (type === "bmr") {
      const result = await supabase.from("bmr_history").delete().eq("id", id);
      error = result.error;
      if (!error) await fetchCalculatorHistory(user.id);
    } else if (type === "macro") {
      const result = await supabase.from("calorie_history").delete().eq("id", id);
      error = result.error;
      if (!error) await fetchCalculatorHistory(user.id);
    } else if (type === "measurement") {
      const result = await supabase.from("user_activity_log").delete().eq("id", id);
      error = result.error;
      if (!error) await fetchMeasurementHistory(user.id);
    }

    if (error) {
      toast({ title: "Error", description: "Failed to delete record", variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Record deleted successfully" });
    }
    setDeleteDialog(null);
  };

  const checkSubscription = async (userId?: string) => {
    try {
      const uid = userId || user?.id;
      if (!uid) return;
      const {
        data: dbData,
        error: dbError
      } = await supabase.from('user_subscriptions').select('plan_type, status, current_period_end, current_period_start, stripe_subscription_id, cancel_at_period_end, subscription_source').eq('user_id', uid).maybeSingle();
      if (dbError) {
        if (import.meta.env.DEV) {
          console.error("Dashboard subscription error:", dbError);
        }
        return;
      }
      if (!dbData) {
        setSubscriptionInfo({
          subscribed: false,
          product_id: null,
          subscription_end: null
        });
        return;
      }
      // Note: 'gold'/'platinum' are legacy plan types no longer offered for purchase.
      // 'legacy_premium' is used by the webhook for historical Stripe events.
      const isSubscribed = dbData?.status === 'active' && ['premium', 'lifetime', 'legacy_premium'].includes(dbData.plan_type);
      setSubscriptionInfo({
        subscribed: isSubscribed,
        product_id: dbData?.plan_type || null,
        subscription_end: dbData?.current_period_end || null,
        status: dbData?.status || null
      });
      if (dbData?.current_period_start && dbData?.current_period_end) {
        setStripeDetails({
          current_period_start: new Date(dbData.current_period_start).getTime() / 1000,
          current_period_end: new Date(dbData.current_period_end).getTime() / 1000,
          cancel_at_period_end: dbData.cancel_at_period_end || false
        });
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error checking subscription:", error);
      }
    }
  };
  const getPlanName = (productId: string | null) => {
    if (!productId) return "Free";
    const planType = productId.toLowerCase();
    if (planType === "free") return "Free";
    return "Premium";
  };
  const getDaysRemaining = () => {
    if (!subscriptionInfo?.subscription_end) return null;
    const endDate = new Date(subscriptionInfo.subscription_end);
    const today = new Date();
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };
  const handleNavigateToWorkout = (workoutType: string, workoutId: string) => {
    navigate(`/workout/${workoutType}/${workoutId}`);
  };
  const handleNavigateToProgram = (programType: string, programId: string) => {
    navigate(`/trainingprogram/${programType}/${programId}`);
  };

  // Map a WorkoutInteraction / ProgramInteraction to a generic ActivityItem for the sheet
  const toWorkoutItem = (w: WorkoutInteraction): ActivityItem => ({
    id: w.id,
    name: w.workout_name,
    type: w.workout_type,
    rating: w.rating,
    is_completed: w.is_completed,
    is_favorite: w.is_favorite,
  });
  const toProgramItem = (p: ProgramInteraction): ActivityItem => ({
    id: p.id,
    name: p.program_name,
    type: p.program_type,
    rating: p.rating,
    is_completed: p.is_completed,
    is_favorite: p.is_favorite,
  });
  const handleRefreshSubscription = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Admins don't have a Stripe customer — skip the Stripe sync and
      // just reload local subscription/role state so the refresh button
      // doesn't fail with "Failed to refresh subscription status".
      if (!isAdmin) {
        const { error } = await supabase.functions.invoke('check-subscription');
        if (error) {
          // Non-fatal — fall through to local reload so the UI still refreshes.
          if (import.meta.env.DEV) {
            console.warn('check-subscription returned an error (continuing):', error);
          }
        }
      }

      // Reload subscription data locally
      await checkSubscription();
      toast({
        title: "Status refreshed",
        description: isAdmin
          ? "Your administrator access has been refreshed."
          : "Your subscription status has been updated."
      });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error refreshing subscription:', error);
      }
      toast({
        title: "Error",
        description: "Failed to refresh status. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get route type from content ID prefix
  const getRouteTypeFromId = (contentType: string, contentId: string): string => {
    if (contentType === "workout") {
      if (contentId.startsWith("WOD-")) return "wod";
      if (contentId.startsWith("S-")) return "strength";
      if (contentId.startsWith("CB-")) return "calorie-burning";
      if (contentId.startsWith("M-")) return "metabolic";
      if (contentId.startsWith("C-")) return "cardio";
      if (contentId.startsWith("MB-")) return "mobility";
      if (contentId.startsWith("P-")) return "power";
      if (contentId.startsWith("CH-")) return "challenge";
      return "strength"; // default fallback
    } else {
      // programs
      if (contentId.startsWith("HY-")) return "hypertrophy";
      if (contentId.startsWith("FS-")) return "functional-strength";
      if (contentId.startsWith("CA-")) return "cardio";
      if (contentId.startsWith("WL-")) return "weight-loss";
      if (contentId.startsWith("LB-")) return "back-care";
      if (contentId.startsWith("MS-")) return "mobility";
      return "strength"; // default fallback
    }
  };
  if (loading || adminLoading) {
    return <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-lg">Loading dashboard...</div>
      </div>;
  }
  // Premium members have an active Lifetime / Premium / legacy subscription
  const hasActivePlan = subscriptionInfo?.subscribed && subscriptionInfo?.product_id;

  // Separate flag for standalone purchases (only count non-deleted content)
  const validPurchases = purchases?.filter(p => !p.content_deleted) || [];
  const hasStandalonePurchases = validPurchases.length > 0;

  // Build sets of purchased content IDs so non-premium subscribers can still
  // see activity stats / lists for the items they actually paid for.
  const purchasedWorkoutIds = new Set(
    validPurchases.filter(p => p.content_type === "workout").map(p => p.content_id)
  );
  const purchasedProgramIds = new Set(
    validPurchases.filter(p => p.content_type === "program").map(p => p.content_id)
  );
  const hasPurchasedWorkouts = purchasedWorkoutIds.size > 0;
  const hasPurchasedPrograms = purchasedProgramIds.size > 0;

  // Scope interactions for non-premium users to only purchased content.
  // Premium users see everything (no scoping).
  const visibleWorkoutInteractions = isPremium
    ? workoutInteractions
    : workoutInteractions.filter(w => purchasedWorkoutIds.has(w.workout_id));
  const visibleProgramInteractions = isPremium
    ? programInteractions
    : programInteractions.filter(p => purchasedProgramIds.has(p.program_id));

  const favoriteWorkouts = visibleWorkoutInteractions.filter(w => w.is_favorite);
  const completedWorkouts = visibleWorkoutInteractions.filter(w => w.is_completed);
  const viewedWorkouts = visibleWorkoutInteractions.filter(w => w.has_viewed);
  const ratedWorkouts = visibleWorkoutInteractions.filter(w => w.rating && w.rating > 0);
  const favoritePrograms = visibleProgramInteractions.filter(p => p.is_favorite);
  const completedPrograms = visibleProgramInteractions.filter(p => p.is_completed);
  const viewedPrograms = visibleProgramInteractions.filter(p => p.has_viewed);
  const ratedPrograms = visibleProgramInteractions.filter(p => p.rating && p.rating > 0);
  const inProgressPrograms = visibleProgramInteractions.filter(p => p.is_ongoing);

  // Tab-level access: allow non-premium users in if they have relevant purchases.
  const canAccessWorkoutsTab = isPremium || hasPurchasedWorkouts;
  const canAccessProgramsTab = isPremium || hasPurchasedPrograms;
  const canAccessLogbookTab = isPremium || hasStandalonePurchases;
  const canAccessCheckinsTab = isPremium;
  return <>
    <Helmet>
      <title>My Dashboard | SmartyGym</title>
      <meta name="description" content="Your private SmartyGym dashboard for workouts, programs, activity, orders, check-ins, and account tools." />
      <meta name="robots" content="noindex, nofollow" />
    </Helmet>
    <div className="min-h-screen bg-background">
      <main className="container mx-auto max-w-7xl px-4 pb-8">
        {/* Check-in Modal Manager - shows pop-up during time windows */}
        {isPremium && <CheckInModalManager onBannerStateChange={handleBannerStateChange} />}
        
        {/* Check-in Banner - shows when user clicked "Later" on modal */}
        {isPremium && bannerState.show && bannerState.type && <div className="mb-4">
            <CheckInBanner type={bannerState.type} windowEnd={bannerState.type === 'morning' ? morningWindowEnd : nightWindowEnd} currentStreak={stats?.currentStreak} onCheckIn={() => {
          if (bannerState.type === 'morning') setShowMorningForm(true);else setShowNightForm(true);
        }} />
          </div>}

        <PageBreadcrumbs items={[
          { label: "Home", href: "/" },
          { label: "Dashboard" }
        ]} />
        
        <h1 className="text-3xl sm:text-4xl font-bold text-center mb-2">My Dashboard</h1>
        
        <Card className="mb-8 bg-primary/10 border-primary/20">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">
              Track your fitness journey, monitor your progress, and stay on top of your goals.
            </p>
          </CardContent>
        </Card>

        <div className="mb-8 flex items-center justify-between">
          <div>
          </div>
        </div>

        {/* Subscription Info */}
        {subscriptionInfo && <Card className="mb-6 border-primary/50 bg-gradient-to-r from-primary/5 to-primary/10">
            <CardContent className="p-4">
              {/* Administrator Card - Show first if user is admin */}
              {isAdmin && <div className="space-y-3">
                  <h2 className="flex items-center gap-2 text-lg font-bold">
                    <Crown className="h-5 w-5 text-amber-500" />
                    Administrator Access
                  </h2>
                  <div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <Badge variant="outline" className="text-xs h-5 px-1.5 bg-gradient-to-r from-amber-500/20 to-amber-600/20 text-amber-600 dark:text-amber-400 border-amber-500/30">
                        <Crown className="h-3 w-3 mr-1" />
                        Administrator
                      </Badge>
                      <Badge variant="outline" className="text-xs h-5 px-1.5 bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                        Full Access
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      As an administrator, you have full access to all premium features and content.
                    </p>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button onClick={handleRefreshSubscription} disabled={loading} variant="outline" className="h-7 px-2 text-xs">
                      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <>
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Refresh
                        </>}
                    </Button>
                    <Button onClick={() => navigate("/admin")} className="h-7 px-2 text-xs bg-amber-500 hover:bg-amber-600">
                      <Crown className="h-3 w-3 mr-1" />
                      Admin Panel
                    </Button>
                  </div>
                </div>}

              {/* Free Plan with Purchases - Only show if not admin */}
              {!isAdmin && !subscriptionInfo.subscribed && purchases && purchases.length > 0 && !isPremium && <div className="space-y-3">
                  <h2 className="flex items-center gap-2 text-lg font-bold">
                    <ShoppingBag className="h-5 w-5 text-primary" />
                    Your Active Membership
                  </h2>
                  <div>
                    <h3 className="text-sm font-semibold mb-1">Free Plan with Purchases</h3>
                    <p className="text-sm text-muted-foreground">
                      You have {purchases.length} purchased item{purchases.length !== 1 ? 's' : ''}. 
                      Upgrade for unlimited access to all content!
                    </p>
                  </div>
                  <Button onClick={() => navigate("/smarty-premium")} className="w-full sm:w-auto cta-button">
                    Upgrade to Premium
                  </Button>
                </div>}

              {/* Free Plan without Purchases - Only show if not admin */}
              {!isAdmin && !subscriptionInfo.subscribed && (!purchases || purchases.length === 0) && !isPremium && <div className="space-y-3">
                  <h2 className="flex items-center gap-2 text-lg font-bold">
                    <UserIcon className="h-5 w-5 text-muted-foreground" />
                    Your Free Membership
                  </h2>
                  <div>
                    <h3 className="text-sm font-semibold mb-1">Free Plan</h3>
                    <p className="text-sm text-muted-foreground">
                      You're currently on the free plan with limited access.
                    </p>
                  </div>
                  <Button onClick={() => navigate("/smarty-premium")} className="w-full sm:w-auto cta-button">
                    Upgrade Now
                  </Button>
                </div>}

              {/* Premium Plan - Two Column Layout with Title in Left Column - Only show if not admin */}
            {!isAdmin && subscriptionInfo.status === 'past_due' && !subscriptionInfo.subscribed && (
              <div className="rounded-md border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 p-3 mb-3">
                <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                  ⚠️ Your last renewal payment failed
                </p>
                <p className="text-xs text-red-700/80 dark:text-red-300/80 mt-1">
                  Update your card in the Stripe portal to retry the charge and restore Premium.
                </p>
                <button
                  onClick={async () => {
                    try {
                      const { data, error } = await supabase.functions.invoke('customer-portal');
                      if (error) throw error;
                      if (data?.url) window.location.href = data.url;
                    } catch (err) { console.error('Portal error:', err); }
                  }}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded px-3 py-1.5"
                >
                  Update payment & retry →
                </button>
              </div>
            )}
            {!isAdmin && subscriptionInfo.subscribed && <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {/* LEFT COLUMN - Title + Plan Info & Actions */}
                  <div className="col-span-1 md:col-span-2 space-y-3">
                    {/* Title at top of left column */}
                    <h2 className="flex items-center gap-2 text-lg font-bold">
                      <Crown className="h-5 w-5 text-primary" />
                      Your {getPlanName(subscriptionInfo.product_id)} Membership
                    </h2>
                    
                    {/* Plan Status */}
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold">{getPlanName(subscriptionInfo.product_id)} Plan</h3>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="outline" className="text-xs h-5 px-1.5 bg-gradient-to-r from-primary/20 to-sky-500/20 text-primary border-primary/30">
                          <Crown className="h-3 w-3 mr-1" />
                          Premium Member
                        </Badge>
                        <Badge variant="outline" className="text-xs h-5 px-1.5 bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                          Active
                        </Badge>
                      </div>
                    </div>

                    {/* Subscription Details */}
                    <div className="space-y-2 text-sm">
                      {subscriptionInfo.status === 'past_due' && (
                        <div className="rounded-md border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 p-2 mb-2">
                          <p className="text-xs font-semibold text-red-700 dark:text-red-300">
                            ⚠️ Your last renewal payment failed
                          </p>
                          <p className="text-[11px] text-red-700/80 dark:text-red-300/80 mt-0.5">
                            Update your card to restore Premium and retry now.
                          </p>
                          <button
                            onClick={async () => {
                              try {
                                const { data, error } = await supabase.functions.invoke('customer-portal');
                                if (error) throw error;
                                if (data?.url) window.location.href = data.url;
                              } catch (err) { console.error('Portal error:', err); }
                            }}
                            className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-red-600 hover:bg-red-700 rounded px-2 py-1"
                          >
                            Update payment & retry →
                          </button>
                        </div>
                      )}
                      {['lifetime', 'legacy_premium'].includes(subscriptionInfo.product_id || '') ? (
                        <>
                          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                            Lifetime Access
                          </Badge>
                          <p className="text-xs text-muted-foreground">
                            Your grandfathered membership has no expiration date
                          </p>
                        </>
                      ) : (
                        <>
                          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                            Monthly — €9.99
                          </Badge>
                          <p className="text-xs text-muted-foreground">
                            {subscriptionInfo.subscription_end
                              ? `Renews on ${new Date(subscriptionInfo.subscription_end).toLocaleDateString()}`
                              : 'Billed monthly. Cancel anytime.'}
                          </p>
                        </>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-1">
                      <Button onClick={handleRefreshSubscription} disabled={loading} variant="outline" className="h-7 px-2 text-xs">
                        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <>
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Refresh
                          </>}
                      </Button>
                      {!['lifetime', 'legacy_premium'].includes(subscriptionInfo.product_id || '') && (
                        <Button
                          onClick={async () => {
                            try {
                              const { data, error } = await supabase.functions.invoke('customer-portal');
                              if (error) throw error;
                              if (data?.url) window.location.href = data.url;
                            } catch (err) {
                              console.error('Portal error:', err);
                            }
                          }}
                          variant="outline"
                          className="h-7 px-2 text-xs"
                        >
                          Manage / Cancel
                        </Button>
                      )}
                    </div>

                    {/* Motivational Message from Coach */}
                    <div className="mt-4 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 rounded-lg p-3 border border-primary/20 relative overflow-hidden">
                      {/* Decorative quote icon background */}
                      <div className="absolute top-1 right-1 opacity-5">
                        <Quote className="h-12 w-12" />
                      </div>
                      
                      <div className="relative flex gap-2">
                        {/* Left side icon */}
                        <div className="flex-shrink-0 mt-0.5">
                          <div className="p-1.5 rounded-full bg-primary/10">
                            <Heart className="h-4 w-4 text-primary" />
                          </div>
                        </div>
                        
                        {/* Message content */}
                        <div className="flex-1 space-y-1.5">
                          <p className="text-xs leading-relaxed text-foreground/90 italic">
                            "Thank you for trusting SmartyGym with your fitness journey. Every workout you complete, every step you log, every effort you make is an investment in a stronger, healthier you. Keep showing up. Your consistency today becomes your confidence tomorrow."
                          </p>
                          
                          {/* Coach signature - clickable */}
                          <div className="flex items-center gap-1.5 pt-0.5">
                            <div className="h-px flex-1 bg-primary/20"></div>
                            <button onClick={() => navigate("/coach-profile")} className="text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors flex items-center gap-0.5 group">
                              <span>Haris Falas</span>
                              <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                            <div className="h-px flex-1 bg-primary/20"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT COLUMN - Membership Benefits (aligned with title) */}
                  <div className="col-span-1 md:col-span-3 bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg p-4 border border-primary/20 flex flex-col h-full">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-3 tracking-wide">
                      Membership Benefits
                    </h4>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 flex-1">
                      <div className="bg-white/50 dark:bg-gray-800/50 rounded-md p-3 border border-primary/10 hover:border-primary/30 transition-colors flex items-center justify-center">
                        <div className="flex flex-col items-center text-center gap-1">
                          <Dumbbell className="h-6 w-6 text-primary" />
                          <span className="text-sm font-semibold">500+ Premium</span>
                          <span className="text-xs font-medium text-muted-foreground">Workouts</span>
                        </div>
                      </div>
                      
                      <div className="bg-white/50 dark:bg-gray-800/50 rounded-md p-3 border border-primary/10 hover:border-primary/30 transition-colors flex items-center justify-center">
                        <div className="flex flex-col items-center text-center gap-1">
                          <ClipboardList className="h-6 w-6 text-primary" />
                          <span className="text-sm font-semibold">Training</span>
                          <span className="text-xs font-medium text-muted-foreground">Programs</span>
                        </div>
                      </div>
                      
                      <div className="bg-white/50 dark:bg-gray-800/50 rounded-md p-3 border border-primary/10 hover:border-primary/30 transition-colors flex items-center justify-center">
                        <div className="flex flex-col items-center text-center gap-1">
                          <TrendingUp className="h-6 w-6 text-primary" />
                          <span className="text-sm font-semibold">Progress</span>
                          <span className="text-xs font-medium text-muted-foreground">Tracking</span>
                        </div>
                      </div>
                      
                      <div className="bg-white/50 dark:bg-gray-800/50 rounded-md p-3 border border-primary/10 hover:border-primary/30 transition-colors flex items-center justify-center">
                        <div className="flex flex-col items-center text-center gap-1">
                          <Calculator className="h-6 w-6 text-primary" />
                          <span className="text-sm font-semibold">Fitness</span>
                          <span className="text-xs font-medium text-muted-foreground">Calculators</span>
                        </div>
                      </div>
                      
                      <div className="bg-white/50 dark:bg-gray-800/50 rounded-md p-3 border border-primary/10 hover:border-primary/30 transition-colors flex items-center justify-center">
                        <div className="flex flex-col items-center text-center gap-1">
                          <BookOpen className="h-6 w-6 text-primary" />
                          <span className="text-sm font-semibold">Exercise</span>
                          <span className="text-xs font-medium text-muted-foreground">Library</span>
                        </div>
                      </div>
                      
                      <div className="bg-white/50 dark:bg-gray-800/50 rounded-md p-3 border border-primary/10 hover:border-primary/30 transition-colors flex items-center justify-center">
                        <div className="flex flex-col items-center text-center gap-1">
                          <Headphones className="h-6 w-6 text-primary" />
                          <span className="text-sm font-semibold">Premium</span>
                          <span className="text-xs font-medium text-muted-foreground">Support</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>}
            </CardContent>
          </Card>}

        {/* Corporate Admin Subscription Card */}
        {corporateSubscription && <Card className="mb-6 border-blue-500/50 bg-gradient-to-r from-blue-500/5 to-blue-500/10">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {/* LEFT COLUMN - Corporate Admin Info */}
                <div className="col-span-1 md:col-span-2 space-y-3">
                  <h2 className="flex items-center gap-2 text-lg font-bold">
                    <Building2 className="h-5 w-5 text-blue-500" />
                    Corporate Administrator
                  </h2>
                  
                  {/* Plan Status */}
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold">{corporateSubscription.organization_name}</h3>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline" className="text-xs h-5 px-1.5 bg-gradient-to-r from-blue-500/20 to-blue-600/20 text-blue-600 dark:text-blue-400 border-blue-500/30">
                        <Building2 className="h-3 w-3 mr-1" />
                        {getCorporatePlanDisplayName(corporateSubscription.plan_type)} Plan
                      </Badge>
                      <Badge variant="outline" className="text-xs h-5 px-1.5 bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                        Active
                      </Badge>
                    </div>
                  </div>

                  {/* Corporate Subscription Details */}
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Team Members:</span>
                      <span className="font-medium">{corporateSubscription.current_users_count} / {corporateSubscription.max_users}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Expires:</span>
                      <span className="font-medium">{formatDate(corporateSubscription.current_period_end)}</span>
                    </div>
                    {getCorporateDaysRemaining() !== null && <div className="flex justify-between">
                        <span className="text-muted-foreground">Days Left:</span>
                        <span className="font-medium text-blue-500">{getCorporateDaysRemaining()} days</span>
                      </div>}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-1">
                    <Button onClick={() => navigate("/corporate-admin")} className="h-7 px-2 text-xs bg-blue-500 hover:bg-blue-600">
                      <Users className="h-3 w-3 mr-1" />
                      Manage Team
                    </Button>
                  </div>
                </div>

                {/* RIGHT COLUMN - Team Access Info */}
                <div className="col-span-1 md:col-span-3 bg-gradient-to-br from-blue-500/5 to-blue-500/10 rounded-lg p-3 border border-blue-500/20">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2 tracking-wide">
                    Team Benefits
                  </h4>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                    <div className="bg-white/50 dark:bg-gray-800/50 rounded-md p-2 border border-blue-500/10 hover:border-blue-500/30 transition-colors">
                      <div className="flex flex-col items-center text-center gap-1">
                        <Users className="h-5 w-5 text-blue-500" />
                        <span className="text-xs font-semibold">{corporateSubscription.max_users}</span>
                        <span className="text-xs font-medium">Team Slots</span>
                      </div>
                    </div>
                    
                    <div className="bg-white/50 dark:bg-gray-800/50 rounded-md p-2 border border-blue-500/10 hover:border-blue-500/30 transition-colors">
                      <div className="flex flex-col items-center text-center gap-1">
                        <Crown className="h-5 w-5 text-blue-500" />
                        <span className="text-xs font-semibold">Premium</span>
                        <span className="text-xs font-medium">Access</span>
                      </div>
                    </div>
                    
                    <div className="bg-white/50 dark:bg-gray-800/50 rounded-md p-2 border border-blue-500/10 hover:border-blue-500/30 transition-colors">
                      <div className="flex flex-col items-center text-center gap-1">
                        <Dumbbell className="h-5 w-5 text-blue-500" />
                        <span className="text-xs font-semibold">All Content</span>
                        <span className="text-xs font-medium">Included</span>
                      </div>
                    </div>
                    
                    <div className="bg-white/50 dark:bg-gray-800/50 rounded-md p-2 border border-blue-500/10 hover:border-blue-500/30 transition-colors">
                      <div className="flex flex-col items-center text-center gap-1">
                        <Building2 className="h-5 w-5 text-blue-500" />
                        <span className="text-xs font-semibold">Central</span>
                        <span className="text-xs font-medium">Billing</span>
                      </div>
                    </div>
                    
                    <div className="bg-white/50 dark:bg-gray-800/50 rounded-md p-2 border border-blue-500/10 hover:border-blue-500/30 transition-colors">
                      <div className="flex flex-col items-center text-center gap-1">
                        <ClipboardList className="h-5 w-5 text-blue-500" />
                        <span className="text-xs font-semibold">Team</span>
                        <span className="text-xs font-medium">Management</span>
                      </div>
                    </div>
                    
                    <div className="bg-white/50 dark:bg-gray-800/50 rounded-md p-2 border border-blue-500/10 hover:border-blue-500/30 transition-colors">
                      <div className="flex flex-col items-center text-center gap-1">
                        <Headphones className="h-5 w-5 text-blue-500" />
                        <span className="text-xs font-semibold">Priority</span>
                        <span className="text-xs font-medium">Support</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>}

        {/* Goals Summary Card - Show for premium users */}
        {isPremium && user && (
          <div id="active-goals" className="mb-6">
            <GoalsSummaryCard userId={user.id} />
          </div>
        )}

        {/* Dashboard Navigation - Card Grid or Section Content */}
        {activeTab === null ? (
          /* Card Grid View */
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {dashboardSections.map((section) => {
              const IconComponent = section.icon;
              return (
                <Card 
                  key={section.id}
                  onClick={() => navigate('/userdashboard?tab=' + section.id)}
                  className={`cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all duration-200 group relative ${section.hoverBorder}`}
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
                      <Badge variant="destructive" className="absolute top-2 right-2 h-5 min-w-5 flex items-center justify-center rounded-full p-1 text-xs">
                        {section.badge}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          /* Section Content View */
          <div className="space-y-6">


            {/* Workouts Section */}
            {activeTab === "workouts" && <div className="space-y-6">
            {!canAccessWorkoutsTab ? <Card className="border-primary/50 bg-gradient-to-r from-primary/5 to-primary/10">
                <CardContent className="text-center py-12">
                  <Crown className="h-12 w-12 text-primary mx-auto mb-4" />
                  <h3 className="text-xl font-bold mb-2">Premium Feature</h3>
                  <p className="text-muted-foreground mb-6">
                    Track your workouts, mark favorites, and monitor your progress with SmartyGym Premium.
                  </p>
                  <Button onClick={() => navigate("/smarty-premium")} className="cta-button">
                    Upgrade to Premium
                  </Button>
                </CardContent>
              </Card> : <>
                {!isPremium && <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="py-3 px-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground">
                      Showing activity for your <strong>{purchasedWorkoutIds.size}</strong> purchased workout{purchasedWorkoutIds.size === 1 ? '' : 's'}. Upgrade to Premium to track every workout.
                    </p>
                    <Button size="sm" variant="outline" onClick={() => navigate("/smarty-premium")}>
                      <Crown className="h-3 w-3 mr-1" /> Upgrade
                    </Button>
                  </CardContent>
                </Card>}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {([
                { bucket: "favorites" as const, label: "Favorites", icon: <Heart className="h-4 w-4 text-red-500" />, count: favoriteWorkouts.length },
                { bucket: "completed" as const, label: "Completed", icon: <CheckCircle className="h-4 w-4 text-green-500" />, count: completedWorkouts.length },
                { bucket: "viewed" as const, label: "Viewed", icon: <Clock className="h-4 w-4 text-blue-500" />, count: viewedWorkouts.length },
                { bucket: "rated" as const, label: "Rated", icon: <Star className="h-4 w-4 text-yellow-500" />, count: ratedWorkouts.length },
              ]).map(s => (
                <Card
                  key={s.bucket}
                  role="button"
                  tabIndex={0}
                  onClick={() => setActivitySheet({ kind: "workout", bucket: s.bucket })}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActivitySheet({ kind: "workout", bucket: s.bucket }); } }}
                  className="cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">{s.icon}{s.label}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{s.count}</div>
                    <p className="text-xs text-muted-foreground mt-1">Tap to view all</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            </>}
            </div>}

            {/* Programs Section */}
            {activeTab === "programs" && <div className="space-y-6">
            {!canAccessProgramsTab ? <Card className="border-primary/50 bg-gradient-to-r from-primary/5 to-primary/10">
                <CardContent className="text-center py-12">
                  <Crown className="h-12 w-12 text-primary mx-auto mb-4" />
                  <h3 className="text-xl font-bold mb-2">Premium Feature</h3>
                  <p className="text-muted-foreground mb-6">
                    Access structured training programs, track your progress, and achieve your fitness goals with SmartyGym Premium.
                  </p>
                  <Button onClick={() => navigate("/smarty-premium")} className="cta-button">
                    Upgrade to Premium
                  </Button>
                </CardContent>
              </Card> : <>
                {!isPremium && <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="py-3 px-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground">
                      Showing activity for your <strong>{purchasedProgramIds.size}</strong> purchased program{purchasedProgramIds.size === 1 ? '' : 's'}. Upgrade to Premium to track every program.
                    </p>
                    <Button size="sm" variant="outline" onClick={() => navigate("/smarty-premium")}>
                      <Crown className="h-3 w-3 mr-1" /> Upgrade
                    </Button>
                  </CardContent>
                </Card>}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {([
                { bucket: "favorites" as const, label: "Favorites", icon: <Heart className="h-4 w-4 text-red-500" />, count: favoritePrograms.length },
                { bucket: "inprogress" as const, label: "In Progress", icon: <Play className="h-4 w-4 text-purple-500" />, count: inProgressPrograms.length },
                { bucket: "completed" as const, label: "Completed", icon: <CheckCircle className="h-4 w-4 text-green-500" />, count: completedPrograms.length },
                { bucket: "viewed" as const, label: "Viewed", icon: <Clock className="h-4 w-4 text-blue-500" />, count: viewedPrograms.length },
                { bucket: "rated" as const, label: "Rated", icon: <Star className="h-4 w-4 text-yellow-500" />, count: ratedPrograms.length },
              ]).map(s => (
                <Card
                  key={s.bucket}
                  role="button"
                  tabIndex={0}
                  onClick={() => setActivitySheet({ kind: "program", bucket: s.bucket })}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActivitySheet({ kind: "program", bucket: s.bucket }); } }}
                  className="cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">{s.icon}{s.label}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{s.count}</div>
                    <p className="text-xs text-muted-foreground mt-1">Tap to view all</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            </>}
            </div>}

            {/* My Purchases Section */}
            {activeTab === "purchases" && <div className="space-y-6">
            {/* Premium Member Special Message */}
            {hasActivePlan && <Card className="border-primary bg-gradient-to-br from-primary/10 via-primary/5 to-background overflow-hidden">
                <CardContent className="text-center py-12 px-6 relative">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent"></div>
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
                    <Crown className="h-10 w-10 text-primary animate-pulse" />
                  </div>
                  <h3 className="text-3xl font-bold mb-3 bg-gradient-to-r from-primary via-primary/80 to-primary bg-clip-text text-transparent">
                    🎉 Congratulations! 🎉
                  </h3>
                  <p className="text-xl font-semibold mb-2 text-foreground">
                    You're a {getPlanName(subscriptionInfo?.product_id)} Member!
                  </p>
                  <p className="text-lg text-muted-foreground mb-4">
                    No need to purchase anything — everything is unlocked for you!
                  </p>
                  <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary/5 border border-primary/20">
                    <CheckCircle className="h-5 w-5 text-primary" />
                    <span className="font-medium text-primary">Full Access to All Content</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-6 max-w-2xl mx-auto">
                    As a premium member, you have unlimited access to all workouts, training programs, and exclusive features. 
                    Enjoy your complete fitness experience!
                  </p>
                </CardContent>
              </Card>}

            {/* Free User with Purchases Message */}
            {!hasActivePlan && hasStandalonePurchases && <Card className="border-border bg-accent/10">
                <CardContent className="text-center py-8 px-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-3">
                    <ShoppingBag className="h-8 w-8 text-primary" />
                  </div>
                  <p className="text-lg font-medium mb-2">Your Purchases</p>
                  <p className="text-sm text-muted-foreground">
                    View and access your individually purchased content below
                  </p>
                </CardContent>
              </Card>}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5" />
                  My Purchases
                </CardTitle>
              </CardHeader>
              <CardContent>
                {purchasesLoading ? <p className="text-center text-muted-foreground py-8">Loading purchases...</p> : purchases.length === 0 ? <div className="text-center py-8 space-y-4">
                    {!hasActivePlan && <>
                        <p className="text-muted-foreground">You haven't purchased any individual content yet</p>
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                          <Button onClick={() => navigate("/workout/strength")}>
                            Browse Workouts
                          </Button>
                          <Button variant="outline" onClick={() => navigate("/trainingprogram/functional-strength")}>
                            Browse Programs
                          </Button>
                        </div>
                      </>}
                    {hasActivePlan && <p className="text-muted-foreground">No individual purchases — but you have full access to everything as a premium member!</p>}
                  </div> : <div className="space-y-4">
                    {purchases.map(purchase => <Card key={purchase.id} className={`overflow-hidden transition-shadow ${purchase.content_deleted ? 'opacity-60 bg-muted/30' : 'hover:shadow-lg'}`}>
                        <CardContent className="p-6">
                          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="text-xs">
                                  {purchase.content_type === "workout" ? "Workout" : "Program"}
                                </Badge>
                                {purchase.content_deleted && <Badge variant="destructive" className="text-xs">
                                    Content Removed
                                  </Badge>}
                                <span className="text-xs text-muted-foreground">
                                  Purchased {new Date(purchase.purchased_at).toLocaleDateString()}
                                </span>
                              </div>
                              <h3 className={`text-lg font-semibold ${purchase.content_deleted ? 'line-through text-muted-foreground' : ''}`}>
                                {purchase.content_name}
                              </h3>
                              <p className="text-sm text-muted-foreground">€{Number(purchase.price).toFixed(2)}</p>
                            </div>
                            <Button disabled={purchase.content_deleted} variant={purchase.content_deleted ? "outline" : "default"} onClick={() => {
                        const routeType = getRouteTypeFromId(purchase.content_type, purchase.content_id);
                        if (purchase.content_type === "workout") {
                          navigate(`/workout/${routeType}/${purchase.content_id}`);
                        } else {
                          navigate(`/trainingprogram/${routeType}/${purchase.content_id}`);
                        }
                      }}>
                              {purchase.content_deleted ? "No Longer Available" : "View Content"}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>)}
                  </div>}
              </CardContent>
            </Card>
            </div>}

            {/* Messages Section */}
            {activeTab === "messages" && <div className="space-y-6">
              <UserMessagesPanel />
            </div>}

            {/* Smarty Check-ins Section - direct target for check-in reminder messages */}
            {activeTab === "checkins" && <div className="space-y-6">
              {!canAccessCheckinsTab ? <Card className="border-primary/50 bg-gradient-to-r from-primary/5 to-primary/10">
                <CardContent className="text-center py-12">
                  <Crown className="h-12 w-12 text-primary mx-auto mb-4" />
                  <h3 className="text-xl font-bold mb-2">Premium Feature</h3>
                  <p className="text-muted-foreground mb-6">
                    Smarty Check-ins are available with SmartyGym Premium.
                  </p>
                  <Button onClick={() => navigate("/smarty-premium")} className="cta-button">
                    Upgrade to Premium
                  </Button>
                </CardContent>
              </Card> : <Card className="bg-primary/5 border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5 text-primary" />
                    Smarty Check-ins
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <SmartyCheckinsTab />
                </CardContent>
              </Card>}
            </div>}

            {/* LogBook Section */}
            {activeTab === "logbook" && <div className="space-y-6">
            {!canAccessLogbookTab ? <Card className="border-primary/50 bg-gradient-to-r from-primary/5 to-primary/10">
                <CardContent className="text-center py-12">
                  <Crown className="h-12 w-12 text-primary mx-auto mb-4" />
                  <h3 className="text-xl font-bold mb-2">Premium Feature</h3>
                  <p className="text-muted-foreground mb-6">
                    Track all your fitness activities in one place with SmartyGym Premium.
                  </p>
                  <Button onClick={() => navigate("/smarty-premium")} className="cta-button">
                    Upgrade to Premium
                  </Button>
                </CardContent>
              </Card> : <>
                {!isPremium && <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="py-3 px-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground">
                      Showing logbook activity for your purchased content. Upgrade to Premium to log every workout, program, and check-in.
                    </p>
                    <Button size="sm" variant="outline" onClick={() => navigate("/smarty-premium")}>
                      <Crown className="h-3 w-3 mr-1" /> Upgrade
                    </Button>
                  </CardContent>
                </Card>}
                {/* Workout Activity Stats */}
                <div>
            <h3 className="text-lg font-semibold mb-2">Workout Activity</h3>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4 mb-3">
              {([
                { bucket: "favorites" as const, label: "Favorites", icon: <Heart className="h-4 w-4 text-red-500" />, count: favoriteWorkouts.length },
                { bucket: "viewed" as const, label: "Viewed", icon: <Clock className="h-4 w-4 text-blue-500" />, count: viewedWorkouts.length },
                { bucket: "completed" as const, label: "Completed", icon: <CheckCircle className="h-4 w-4 text-green-500" />, count: completedWorkouts.length },
                { bucket: "rated" as const, label: "Rated", icon: <Star className="h-4 w-4 text-yellow-500" />, count: ratedWorkouts.length },
              ]).map(s => (
                <Card
                  key={s.bucket}
                  role="button"
                  tabIndex={0}
                  onClick={() => setActivitySheet({ kind: "workout", bucket: s.bucket })}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActivitySheet({ kind: "workout", bucket: s.bucket }); } }}
                  className="cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <CardHeader className="pb-0 pt-3">
                    <CardTitle className="text-sm font-medium flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">{s.icon}{s.label}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-1 px-4">
                    <div className="text-lg font-bold">{s.count}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
                </div>

                {/* Program Activity Stats */}
                <div>
            <h3 className="text-lg font-semibold mb-2">Program Activity</h3>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-5 mb-3">
              {([
                { bucket: "favorites" as const, label: "Favorites", icon: <Heart className="h-4 w-4 text-red-500" />, count: favoritePrograms.length },
                { bucket: "viewed" as const, label: "Viewed", icon: <Clock className="h-4 w-4 text-blue-500" />, count: viewedPrograms.length },
                { bucket: "inprogress" as const, label: "In Progress", icon: <Play className="h-4 w-4 text-purple-500" />, count: inProgressPrograms.length },
                { bucket: "completed" as const, label: "Completed", icon: <CheckCircle className="h-4 w-4 text-green-500" />, count: completedPrograms.length },
                { bucket: "rated" as const, label: "Rated", icon: <Star className="h-4 w-4 text-yellow-500" />, count: ratedPrograms.length },
              ]).map(s => (
                <Card
                  key={s.bucket}
                  role="button"
                  tabIndex={0}
                  onClick={() => setActivitySheet({ kind: "program", bucket: s.bucket })}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActivitySheet({ kind: "program", bucket: s.bucket }); } }}
                  className="cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <CardHeader className="pb-0 pt-3">
                    <CardTitle className="text-sm font-medium flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">{s.icon}{s.label}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-1 px-4">
                    <div className="text-lg font-bold">{s.count}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
                </div>

                {/* Check-Ins & Measurements */}
                <div>
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5 text-primary" />
                    Check-ins, Calculators, and Measurements
                  </h3>
                  <div className="grid gap-2 md:grid-cols-5 mb-3">
                    {/* Smarty Check-ins Card */}
                    <Card className="border-primary">
                      <CardHeader className="pb-0 pt-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <ClipboardCheck className="h-4 w-4 text-primary" />
                          Smarty Check-ins
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="py-2 px-3">
                        <CheckInDashboardCard todayCheckin={todayCheckin} stats={stats} onOpenMorning={() => setShowMorningForm(true)} onOpenNight={() => setShowNightForm(true)} />
                      </CardContent>
                    </Card>
                    {/* 1RM Calculator */}
                    <Card>
                      <CardHeader className="pb-0 pt-3">
                        <CardTitle className="text-sm font-medium">1RM Calculator</CardTitle>
                      </CardHeader>
                      <CardContent className="py-2 px-3">
                        {oneRMHistory.length === 0 ? <div className="text-center py-1">
                            <p className="text-xs text-muted-foreground mb-2">No history yet</p>
                            <Button size="sm" variant="outline" onClick={() => navigate("/1rmcalculator")}>
                              Calculate Now
                            </Button>
                          </div> : <div className="space-y-1">
                            <div className="flex items-start justify-between gap-1">
                              <div className="p-2 bg-muted rounded text-xs flex-1">
                                <div className="font-semibold">{oneRMHistory[0].one_rm_result.toFixed(1)} kg</div>
                                {oneRMHistory[0].exercise_name && <div className="text-muted-foreground">{oneRMHistory[0].exercise_name}</div>}
                                <div className="text-muted-foreground">
                                  {oneRMHistory[0].weight_lifted}kg × {oneRMHistory[0].reps} reps
                                </div>
                                <div className="text-muted-foreground mt-1">
                                  {formatDate(oneRMHistory[0].created_at)}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive flex-shrink-0"
                                onClick={() => setDeleteDialog({ open: true, type: "1rm", id: oneRMHistory[0].id })}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                            <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("/calculator-history?tab=1rm")}>
                              View All / Add New
                            </Button>
                          </div>}
                      </CardContent>
                    </Card>

                    {/* BMR Calculator */}
                    <Card>
                      <CardHeader className="pb-0 pt-3">
                        <CardTitle className="text-sm font-medium">BMR Calculator</CardTitle>
                      </CardHeader>
                      <CardContent className="py-2 px-3">
                        {bmrHistory.length === 0 ? <div className="text-center py-1">
                            <p className="text-xs text-muted-foreground mb-2">No history yet</p>
                            <Button size="sm" variant="outline" onClick={() => navigate("/bmrcalculator")}>
                              Calculate Now
                            </Button>
                          </div> : <div className="space-y-1">
                            <div className="flex items-start justify-between gap-1">
                              <div className="p-2 bg-muted rounded text-xs flex-1">
                                <div className="font-semibold">{bmrHistory[0].bmr_result.toFixed(0)} cal/day</div>
                                <div className="text-muted-foreground">
                                  {bmrHistory[0].gender === "male" ? "Male" : "Female"}, {bmrHistory[0].age} years
                                </div>
                                <div className="text-muted-foreground">
                                  {bmrHistory[0].height}cm, {bmrHistory[0].weight}kg
                                </div>
                                <div className="text-muted-foreground mt-1">
                                  {formatDate(bmrHistory[0].created_at)}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive flex-shrink-0"
                                onClick={() => setDeleteDialog({ open: true, type: "bmr", id: bmrHistory[0].id })}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                            <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("/calculator-history?tab=bmr")}>
                              View All / Add New
                            </Button>
                          </div>}
                      </CardContent>
                    </Card>

                    {/* Macro Calculator */}
                    <Card>
                      <CardHeader className="pb-0 pt-3">
                        <CardTitle className="text-sm font-medium">Macro Calculator</CardTitle>
                      </CardHeader>
                      <CardContent className="py-2 px-3">
                        {calorieHistory.length === 0 ? <div className="text-center py-1">
                            <p className="text-xs text-muted-foreground mb-2">No history yet</p>
                            <Button size="sm" variant="outline" onClick={() => navigate("/macrocalculator")}>
                              Calculate Now
                            </Button>
                          </div> : <div className="space-y-1">
                            <div className="flex items-start justify-between gap-1">
                              <div className="p-2 bg-muted rounded text-xs flex-1">
                                <div className="font-semibold">{calorieHistory[0].target_calories.toFixed(0)} cal/day</div>
                                <div className="text-muted-foreground capitalize">
                                  Goal: {calorieHistory[0].goal}
                                </div>
                                <div className="text-muted-foreground">
                                  Activity: {calorieHistory[0].activity_level.replace('_', ' ')}
                                </div>
                                <div className="text-muted-foreground mt-1">
                                  {formatDate(calorieHistory[0].created_at)}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive flex-shrink-0"
                                onClick={() => setDeleteDialog({ open: true, type: "macro", id: calorieHistory[0].id })}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                            <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("/calculator-history?tab=macro")}>
                              View All / Add New
                            </Button>
                          </div>}
                      </CardContent>
                    </Card>

                    {/* Measurements */}
                    <Card>
                      <CardHeader className="pb-0 pt-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Scale className="h-4 w-4 text-primary" />
                          Measurements
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="py-2 px-3">
                        {measurementHistory.length === 0 ? <div className="text-center py-1">
                            <p className="text-xs text-muted-foreground mb-2">Track your body measurements</p>
                            <Button size="sm" variant="outline" onClick={() => setIsMeasurementDialogOpen(true)}>
                              Add Measurement
                            </Button>
                          </div> : <div className="space-y-1">
                            <div className="flex items-start justify-between gap-1">
                              <div className="p-2 bg-muted rounded text-xs flex-1">
                                <div className="font-semibold">
                                  {measurementHistory[0].tool_result?.weight && `${measurementHistory[0].tool_result.weight} kg`}
                                  {measurementHistory[0].tool_result?.weight && (measurementHistory[0].tool_result?.body_fat || measurementHistory[0].tool_result?.muscle_mass) && ' | '}
                                  {measurementHistory[0].tool_result?.body_fat && `BF: ${measurementHistory[0].tool_result.body_fat}%`}
                                  {measurementHistory[0].tool_result?.body_fat && measurementHistory[0].tool_result?.muscle_mass && ' | '}
                                  {measurementHistory[0].tool_result?.muscle_mass && `MM: ${measurementHistory[0].tool_result.muscle_mass} kg`}
                                </div>
                                <div className="text-muted-foreground mt-1">
                                  {formatDate(measurementHistory[0].created_at)}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive flex-shrink-0"
                                onClick={() => setDeleteDialog({ open: true, type: "measurement", id: measurementHistory[0].id })}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                            <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("/calculator-history?tab=measurements")}>
                              View All / Add New
                            </Button>
                          </div>}
                      </CardContent>
                    </Card>
                  </div>
                </div>
                {/* Full Smarty Check-ins Section */}
                {isPremium && <div className="mt-6">
                    <Card className="bg-primary/5 border-primary/20">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <ClipboardCheck className="h-5 w-5 text-primary" />
                          Smarty Check-ins
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <SmartyCheckinsTab />
                      </CardContent>
                    </Card>
                  </div>}
                
                {/* Calendar - Always shows ALL activity */}
                <div id="logbook-calendar" className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <LogBookCalendar userId={user!.id} filter="all" />
                </div>
                
                <div id="logbook-charts">
                  <LogBookAdvancedCharts userId={user!.id} primaryFilter={logBookFilter} onPrimaryFilterChange={filter => setLogBookFilter(filter as any)} secondaryFilter={logBookSecondaryFilter} onSecondaryFilterChange={filter => setLogBookSecondaryFilter(filter)} timeFilter={logBookTimeFilter} onTimeFilterChange={filter => setLogBookTimeFilter(filter as any)} customStartDate={logBookCustomStartDate} onCustomStartDateChange={setLogBookCustomStartDate} customEndDate={logBookCustomEndDate} onCustomEndDateChange={setLogBookCustomEndDate} />
                </div>

                {/* My Records Section */}
                <Card className="bg-primary/5 border-primary/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      My Records
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <MyRecordsReport userId={user?.id} />
                  </CardContent>
                </Card>

                <LogBookAdvancedExport userId={user!.id} />
              </>}
            </div>}

            {/* Account Section */}
            {activeTab === "account" && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <Settings className="h-6 w-6 text-slate-500" />
                  <h2 className="text-2xl font-bold">Account & Privacy</h2>
                </div>
                <ParQAssessmentSection />
                <AccountSettingsSection 
                  userEmail={user?.email || ""} 
                  onAccountDeleted={() => navigate("/")} 
                />
              </div>
            )}
          </div>
        )}
      </main>

      <MeasurementDialog isOpen={isMeasurementDialogOpen} onClose={() => setIsMeasurementDialogOpen(false)} userId={user?.id || ''} onSaved={() => user && fetchMeasurementHistory(user.id)} />

      {/* Morning Check-in Form Dialog */}
      <Dialog open={showMorningForm} onOpenChange={setShowMorningForm}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader className="sr-only">
            <DialogTitle>Morning Check-in</DialogTitle>
            <DialogDescription>Complete your morning wellness check-in.</DialogDescription>
          </DialogHeader>
          <MorningCheckInForm onSubmit={async data => {
          const success = await submitMorningCheckin(data);
          if (success) {
            setShowMorningForm(false);
            fetchTodayCheckin();
          }
          return success;
        }} isWindowOpen={isMorningWindow} windowEnd={morningWindowEnd} />
        </DialogContent>
      </Dialog>

      {/* Night Check-in Form Dialog */}
      <Dialog open={showNightForm} onOpenChange={setShowNightForm}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader className="sr-only">
            <DialogTitle>Night Check-in</DialogTitle>
            <DialogDescription>Complete your night wellness check-in.</DialogDescription>
          </DialogHeader>
          <NightCheckInForm onSubmit={async data => {
          const success = await submitNightCheckin(data);
          if (success) {
            setShowNightForm(false);
            fetchTodayCheckin();
          }
          return success;
        }} isWindowOpen={isNightWindow} windowEnd={nightWindowEnd} />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog?.open || false} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Record</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this record? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRecord} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Activity drill-in sheet (Favorites/Completed/Viewed/Rated/In Progress) */}
      {(() => {
        const s = activitySheet;
        const isWorkout = s?.kind === "workout";
        const sourceWorkouts: Record<string, WorkoutInteraction[]> = {
          favorites: favoriteWorkouts,
          completed: completedWorkouts,
          viewed: viewedWorkouts,
          rated: ratedWorkouts,
          inprogress: [],
        };
        const sourcePrograms: Record<string, ProgramInteraction[]> = {
          favorites: favoritePrograms,
          completed: completedPrograms,
          viewed: viewedPrograms,
          rated: ratedPrograms,
          inprogress: inProgressPrograms,
        };
        const titleMap: Record<string, string> = {
          favorites: isWorkout ? "Favorite Workouts" : "Favorite Programs",
          completed: isWorkout ? "Completed Workouts" : "Completed Programs",
          viewed: isWorkout ? "Viewed Workouts" : "Viewed Programs",
          rated: isWorkout ? "Rated Workouts" : "Rated Programs",
          inprogress: "In-Progress Programs",
        };
        const iconMap: Record<string, ReactNode> = {
          favorites: <Heart className="h-4 w-4 text-red-500" />,
          completed: <CheckCircle className="h-4 w-4 text-green-500" />,
          viewed: <Clock className="h-4 w-4 text-blue-500" />,
          rated: <Star className="h-4 w-4 text-yellow-500" />,
          inprogress: <Play className="h-4 w-4 text-purple-500" />,
        };
        const items: ActivityItem[] = s
          ? isWorkout
            ? sourceWorkouts[s.bucket].map(toWorkoutItem)
            : sourcePrograms[s.bucket].map(toProgramItem)
          : [];
        return (
          <ActivityListSheet
            open={!!s}
            onOpenChange={(o) => { if (!o) setActivitySheet(null); }}
            title={s ? titleMap[s.bucket] : ""}
            icon={s ? iconMap[s.bucket] : null}
            items={items}
            emptyText={isWorkout ? "No workouts in this list yet" : "No programs in this list yet"}
            onItemClick={(item) => {
              if (isWorkout) handleNavigateToWorkout(item.type, (sourceWorkouts[s!.bucket].find(w => w.id === item.id))?.workout_id || item.id);
              else handleNavigateToProgram(item.type, (sourcePrograms[s!.bucket].find(p => p.id === item.id))?.program_id || item.id);
            }}
          />
        );
      })()}
    </div>
  </>;
}