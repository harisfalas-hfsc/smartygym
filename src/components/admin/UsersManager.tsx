import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Download, Search, RefreshCw, Mail, Crown, Gem, Building2, UserMinus, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
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
import { UserDetailModal } from "./UserDetailModal";
import {
  CURRENT_PREMIUM_PLAN_TYPES,
  isCurrentPremiumAccess,
  isCurrentPremiumSubscription,
  isManualPremiumAccess,
  normalizePlanLabel,
} from "@/lib/admin-analytics";

interface UserData {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
  plan_type: string;
  status: string;
  stripe_status?: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
  subscription_created_at?: string | null;
  subscription_updated_at?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_source?: string | null;
  cancel_at_period_end?: boolean;
}

interface SubscriptionAction {
  userId: string;
  userName: string;
  action: 'grant' | 'revoke';
  planType: 'lifetime' | 'free';
  durationMonths?: number | null; // null/undefined = indefinite
}

const PREMIUM_PLAN_TYPES = CURRENT_PREMIUM_PLAN_TYPES;

interface CorporateInfo {
  adminPlanType: string | null;
  memberPlanType: string | null;
  organizationName: string | null;
  corporateSubscriptionId: string | null;
}

type SortOption = 'newest_registered' | 'oldest_registered' | 'newest_subscribed' | 'oldest_subscribed' | 'plan_tier';

export function UsersManager() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest_registered");
  const [userPurchases, setUserPurchases] = useState<string[]>([]);
  const [userRoles, setUserRoles] = useState<Record<string, string[]>>({});
  const [corporateInfo, setCorporateInfo] = useState<Record<string, CorporateInfo>>({});
  const [pendingAction, setPendingAction] = useState<SubscriptionAction | null>(null);
  const [pendingCorpAction, setPendingCorpAction] = useState<{userId: string; userName: string; planType: string} | null>(null);
  const [pendingCorpRevoke, setPendingCorpRevoke] = useState<{userId: string; userName: string; planType: string} | null>(null);
  const [pendingMemberRevoke, setPendingMemberRevoke] = useState<{
    userId: string;
    userName: string;
    organizationName: string;
    planType: string;
    corporateSubscriptionId: string;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [organizationFilter, setOrganizationFilter] = useState<string>("all");
  const [organizations, setOrganizations] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [syncingUserId, setSyncingUserId] = useState<string | null>(null);
  // The signed-in admin viewing this panel is treated as the "Main" admin:
  // labelled accordingly and protected from revoking their own admin role.
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setCurrentUserId(data.session?.user?.id ?? null));
  }, []);
  const isMainAdmin = (userId: string) => !!currentUserId && userId === currentUserId;

  // --- Status determination ---
  const getUserStatus = (user: UserData, hasPurchases: boolean) => {
    // Revoked by admin
    if (user.status === 'revoked') return 'Revoked';
    const periodEnded = !!user.current_period_end && new Date(user.current_period_end).getTime() < Date.now();
    if (user.stripe_subscription_id && periodEnded && user.status !== 'active') return 'Expired';
    if (user.stripe_subscription_id && periodEnded && user.status === 'active') return 'Needs Sync';
    
    if (isCurrentPremiumSubscription(user as any)) return 'Paid Premium';
    if (isManualPremiumAccess(user as any)) return 'Manual Access';
    
    // Expired / canceled
    if (user.status === 'canceled' || user.status === 'expired') return 'Expired';
    
    // Has standalone purchases but no plan
    if (hasPurchases && user.plan_type === 'free') return 'Purchase Only';
    
    return 'Free';
  };

  const getStatusBadgeVariant = (statusLabel: string) => {
    switch (statusLabel) {
      case 'Paid Premium': return 'default';
      case 'Manual Access': return 'secondary';
      case 'Purchase Only': return 'secondary';
      case 'Revoked': return 'outline';
      case 'Needs Sync': return 'destructive';
      case 'Expired': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusBadgeClassName = (statusLabel: string) => {
    switch (statusLabel) {
      case 'Paid Premium': return 'bg-green-600 text-white hover:bg-green-700';
      case 'Manual Access': return 'bg-purple-600 text-white hover:bg-purple-700';
      case 'Revoked': return 'bg-orange-500 text-white hover:bg-orange-600';
      default: return '';
    }
  };

  // --- Data fetching ---
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-users-with-emails');
      if (error) throw error;
      if (data?.users) setUsers(data.users);

      const { data: purchases } = await supabase.from('user_purchases').select('user_id');
      setUserPurchases([...new Set(purchases?.map(p => p.user_id) || [])]);

      const { data: roles } = await supabase.from('user_roles').select('user_id, role');
      const rolesMap: Record<string, string[]> = {};
      roles?.forEach(r => {
        if (!rolesMap[r.user_id]) rolesMap[r.user_id] = [];
        rolesMap[r.user_id].push(r.role);
      });

      const { data: corpSubs } = await supabase.from('corporate_subscriptions').select('id, admin_user_id, plan_type, organization_name');
      const { data: corpMembers } = await supabase.from('corporate_members').select('user_id, corporate_subscription_id, corporate_subscriptions(id, plan_type, organization_name)');
      
      const corpInfoMap: Record<string, CorporateInfo> = {};
      const orgNames: Set<string> = new Set();
      
      corpSubs?.forEach(s => {
        corpInfoMap[s.admin_user_id] = { adminPlanType: s.plan_type, memberPlanType: null, organizationName: s.organization_name, corporateSubscriptionId: s.id };
        if (s.organization_name) orgNames.add(s.organization_name);
      });
      corpMembers?.forEach(m => {
        const corpData = m.corporate_subscriptions as any;
        const planType = corpData?.plan_type || null;
        const orgName = corpData?.organization_name || null;
        const corpSubId = corpData?.id || m.corporate_subscription_id;
        if (!corpInfoMap[m.user_id]) {
          corpInfoMap[m.user_id] = { adminPlanType: null, memberPlanType: planType, organizationName: orgName, corporateSubscriptionId: corpSubId };
        } else {
          corpInfoMap[m.user_id].memberPlanType = planType;
          corpInfoMap[m.user_id].organizationName = orgName;
          corpInfoMap[m.user_id].corporateSubscriptionId = corpSubId;
        }
        if (orgName) orgNames.add(orgName);
      });
      
      setCorporateInfo(corpInfoMap);
      setOrganizations(Array.from(orgNames).sort());
      setUserRoles(rolesMap);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  // --- Actions ---
  const toggleAdminRole = async (userId: string, userEmail: string | null, isCurrentlyAdmin: boolean) => {
    if (isMainAdmin(userId) && isCurrentlyAdmin) {
      toast.error("Cannot remove admin privileges from the main administrator");
      return;
    }
    try {
      if (isCurrentlyAdmin) {
        const { error } = await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'admin');
        if (error) throw error;
        toast.success("Admin privileges removed successfully");
      } else {
        const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: 'admin' });
        if (error) throw error;
        toast.success("Admin privileges granted successfully");
      }
      fetchUsers();
    } catch (error) {
      console.error('Error toggling admin role:', error);
      toast.error("Failed to update admin privileges");
    }
  };

  const manageSubscription = async (action: SubscriptionAction) => {
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-subscription', {
        body: {
          user_id: action.userId,
          action: action.action,
          plan_type: action.planType,
          duration_months: action.durationMonths ?? null,
        }
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Unknown error');
      toast.success(data.message);
      fetchUsers();
    } catch (error) {
      console.error('Error managing subscription:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update subscription');
    } finally {
      setActionLoading(false);
      setPendingAction(null);
    }
  };

  const syncStripeSubscription = async (userId: string) => {
    setSyncingUserId(userId);
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription', {
        body: { target_user_id: userId }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Stripe subscription synced');
      fetchUsers();
    } catch (error) {
      console.error('Error syncing Stripe subscription:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to sync Stripe subscription');
    } finally {
      setSyncingUserId(null);
    }
  };

  const grantCorporateAdmin = async (userId: string, planType: string) => {
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('grant-corporate-admin', {
        body: { user_id: userId, plan_type: planType }
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Unknown error');
      toast.success(data.message);
      fetchUsers();
    } catch (error) {
      console.error('Error granting corporate admin:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to grant corporate admin');
    } finally {
      setActionLoading(false);
      setPendingCorpAction(null);
    }
  };

  const revokeCorporateAdmin = async (userId: string) => {
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('revoke-corporate-admin', { body: { user_id: userId } });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Unknown error');
      toast.success(data.message);
      fetchUsers();
    } catch (error) {
      console.error('Error revoking corporate admin:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to revoke corporate admin');
    } finally {
      setActionLoading(false);
      setPendingCorpRevoke(null);
    }
  };

  const revokeCorporateMember = async (userId: string, corporateSubscriptionId: string) => {
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('revoke-corporate-member', {
        body: { member_user_id: userId, corporate_subscription_id: corporateSubscriptionId }
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Unknown error');
      toast.success(data.message);
      fetchUsers();
    } catch (error) {
      console.error('Error revoking corporate member:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to revoke corporate member');
    } finally {
      setActionLoading(false);
      setPendingMemberRevoke(null);
    }
  };

  // --- Filtering & Sorting ---
  const filteredAndSortedUsers = useMemo(() => {
    let filtered = users;

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(user =>
        user.full_name?.toLowerCase().includes(term) || user.email?.toLowerCase().includes(term)
      );
    }

    // Plan filter
    if (planFilter !== "all") {
      if (planFilter === "corporate") {
        filtered = filtered.filter(user => corporateInfo[user.user_id]?.adminPlanType || corporateInfo[user.user_id]?.memberPlanType);
      } else if (planFilter === "premium") {
        filtered = filtered.filter(user => isCurrentPremiumAccess(user as any));
      } else if (planFilter === "paid_premium") {
        filtered = filtered.filter(user => isCurrentPremiumSubscription(user as any));
      } else if (planFilter === "manual_access") {
        filtered = filtered.filter(user => isManualPremiumAccess(user as any));
      } else if (planFilter === "free") {
        filtered = filtered.filter(user => !isCurrentPremiumAccess(user as any) && !(corporateInfo[user.user_id]?.adminPlanType || corporateInfo[user.user_id]?.memberPlanType));
      } else if (planFilter === "purchase") {
        filtered = filtered.filter(user =>
          userPurchases.includes(user.user_id) &&
          !isCurrentPremiumAccess(user as any)
        );
      } else {
        filtered = filtered.filter(user => user.plan_type === planFilter);
      }
    }

    // Status filter (new clear categories)
    if (statusFilter !== "all") {
      filtered = filtered.filter(user => {
        const hasPurchases = userPurchases.includes(user.user_id);
        const label = getUserStatus(user, hasPurchases);
        switch (statusFilter) {
          case "paid_premium": return label === 'Paid Premium';
          case "manual_access": return label === 'Manual Access';
          case "expired": return label === 'Expired';
          case "revoked": return label === 'Revoked';
          case "free": return label === 'Free';
          case "purchase_only": return label === 'Purchase Only';
          default: return true;
        }
      });
    }

    // Role filter (separated from status)
    if (roleFilter !== "all") {
      switch (roleFilter) {
        case "admins":
          filtered = filtered.filter(user => userRoles[user.user_id]?.includes('admin'));
          break;
        case "corporate_admins":
          filtered = filtered.filter(user => corporateInfo[user.user_id]?.adminPlanType);
          break;
        case "corporate_members":
          filtered = filtered.filter(user => corporateInfo[user.user_id]?.memberPlanType && !corporateInfo[user.user_id]?.adminPlanType);
          break;
      }
    }

    // Organization filter
    if (organizationFilter !== "all") {
      filtered = filtered.filter(user => corporateInfo[user.user_id]?.organizationName === organizationFilter);
    }

    // Source filter
    if (sourceFilter !== "all") {
      switch (sourceFilter) {
        case "stripe":
          filtered = filtered.filter(user => isCurrentPremiumSubscription(user as any));
          break;
        case "admin_grant":
          filtered = filtered.filter(user => user.subscription_source === 'admin_grant');
          break;
        case "corporate":
          filtered = filtered.filter(user => corporateInfo[user.user_id]?.memberPlanType || corporateInfo[user.user_id]?.adminPlanType);
          break;
      }
    }

    // Sort
    const sorted = [...filtered];
    switch (sortBy) {
      case 'newest_registered':
        sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'oldest_registered':
        sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case 'newest_subscribed':
        sorted.sort((a, b) => {
          const aDate = a.subscription_created_at ? new Date(a.subscription_created_at).getTime() : 0;
          const bDate = b.subscription_created_at ? new Date(b.subscription_created_at).getTime() : 0;
          return bDate - aDate;
        });
        break;
      case 'oldest_subscribed':
        sorted.sort((a, b) => {
          const aDate = a.subscription_created_at ? new Date(a.subscription_created_at).getTime() : Infinity;
          const bDate = b.subscription_created_at ? new Date(b.subscription_created_at).getTime() : Infinity;
          return aDate - bDate;
        });
        break;
      case 'plan_tier': {
        const tierOrder: Record<string, number> = { premium: 0, legacy_premium: 0, lifetime: 0, platinum: 0, gold: 0, free: 2 };
        sorted.sort((a, b) => (tierOrder[a.plan_type] ?? 3) - (tierOrder[b.plan_type] ?? 3));
        break;
      }
    }

    return sorted;
  }, [searchTerm, planFilter, statusFilter, roleFilter, organizationFilter, sourceFilter, sortBy, users, userPurchases, userRoles, corporateInfo]);

  // --- Stats ---
  const stats = useMemo(() => {
    const paidPremiumCount = users.filter(u => isCurrentPremiumSubscription(u as any)).length;
    const manualAccessCount = users.filter(u => isManualPremiumAccess(u as any)).length;
    return {
      total: users.length,
      paidPremium: paidPremiumCount,
      manualAccess: manualAccessCount,
      premium: paidPremiumCount + manualAccessCount,
      purchases: userPurchases.length,
      admins: Object.values(userRoles).filter(roles => roles.includes('admin')).length,
    };
  }, [users, userPurchases, userRoles]);

  // --- Helpers ---
  const exportToCSV = () => {
    const headers = ["User ID", "Name", "Email", "Is Admin", "Plan", "Status", "Stripe Status", "Period Start", "Period End", "Joined", "Subscribed"];
    const rows = filteredAndSortedUsers.map(user => [
      user.user_id,
      user.full_name || '',
      user.email || '',
      userRoles[user.user_id]?.includes('admin') ? 'Yes' : 'No',
      normalizePlanLabel(user as any),
      getUserStatus(user, userPurchases.includes(user.user_id)),
      user.stripe_status || '',
      user.current_period_start ? format(new Date(user.current_period_start), 'yyyy-MM-dd') : '',
      user.current_period_end ? format(new Date(user.current_period_end), 'yyyy-MM-dd') : '',
      format(new Date(user.created_at), 'yyyy-MM-dd'),
      user.subscription_created_at ? format(new Date(user.subscription_created_at), 'yyyy-MM-dd') : '',
    ]);
    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredAndSortedUsers.length} users`);
  };

  const getCorporatePlanLabel = (planType: string | null) => {
    if (!planType) return 'Unknown';
    if (planType === 'dynamic') return 'Full Access';
    return planType.charAt(0).toUpperCase() + planType.slice(1);
  };

  const getPlanBadgeVariant = (plan: string) => {
    if (PREMIUM_PLAN_TYPES.has(plan)) return 'default' as const;
    return 'outline' as const;
  };

  const getPlanLabel = (plan: string) => {
    return normalizePlanLabel({ plan_type: plan, status: PREMIUM_PLAN_TYPES.has(plan) ? 'active' : 'free' } as any);
  };

  const isActivePremium = (user: UserData) => {
    return isCurrentPremiumAccess(user as any);
  };

  const getDialogTitle = () => {
    if (!pendingAction) return '';
    if (pendingAction.action === 'grant') {
      return 'Grant Premium Membership';
    }
    return 'Revoke Premium Access';
  };

  const getDialogDescription = () => {
    if (!pendingAction) return '';
    if (pendingAction.action === 'grant') {
      const d = pendingAction.durationMonths;
      const period = !d ? 'with no expiration (indefinite)' : `for ${d} month${d === 1 ? '' : 's'}`;
      return `Grant Premium access to "${pendingAction.userName}" ${period}. This is a manual admin grant (not counted as paid revenue). Renewal reminders and expiry notifications will be sent automatically if a duration is set.`;
    }
    return `Are you sure you want to revoke premium access from "${pendingAction.userName}"? This will set them to the FREE plan and remove their premium benefits.`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="pt-6">
      {/* Confirmation Dialog */}
      <AlertDialog open={!!pendingAction} onOpenChange={(open) => !open && setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{getDialogTitle()}</AlertDialogTitle>
            <AlertDialogDescription>{getDialogDescription()}</AlertDialogDescription>
          </AlertDialogHeader>
          {pendingAction?.action === 'grant' && (
            <div className="py-2">
              <label className="text-sm font-medium mb-2 block">Duration</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: '1 month', value: 1 },
                  { label: '3 months', value: 3 },
                  { label: '6 months', value: 6 },
                  { label: '1 year', value: 12 },
                  { label: 'Indefinite', value: 0 },
                ].map(opt => {
                  const selected = (pendingAction.durationMonths ?? 0) === opt.value;
                  return (
                    <Button
                      key={opt.value}
                      type="button"
                      variant={selected ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPendingAction({ ...pendingAction, durationMonths: opt.value === 0 ? null : opt.value })}
                    >
                      {opt.label}
                    </Button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                A fixed duration triggers the standard renewal reminder (3 days before expiry) and expiry notification, just like a paid subscription. "Indefinite" grants never expire and do not send reminders.
              </p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => pendingAction && manageSubscription(pendingAction)} 
              disabled={actionLoading}
              className={pendingAction?.action === 'revoke' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {actionLoading ? 'Processing...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Corporate Admin Confirmation Dialog */}
      <AlertDialog open={!!pendingCorpAction} onOpenChange={(open) => !open && setPendingCorpAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Grant Corporate Admin ({pendingCorpAction?.planType?.charAt(0).toUpperCase()}{pendingCorpAction?.planType?.slice(1)})
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to make "{pendingCorpAction?.userName}" a Corporate Administrator for the{' '}
              {pendingCorpAction?.planType?.toUpperCase()} plan? They will receive Premium access and can manage up to{' '}
              {pendingCorpAction?.planType === 'dynamic' ? '10' : 
               pendingCorpAction?.planType === 'power' ? '20' : 
               pendingCorpAction?.planType === 'elite' ? '30' : 'unlimited'} team members.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingCorpAction && grantCorporateAdmin(pendingCorpAction.userId, pendingCorpAction.planType)} disabled={actionLoading}>
              {actionLoading ? 'Processing...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke Corporate Admin Confirmation Dialog */}
      <AlertDialog open={!!pendingCorpRevoke} onOpenChange={(open) => !open && setPendingCorpRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Revoke Corporate Admin Status</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke corporate admin status from "{pendingCorpRevoke?.userName}"? 
              This will remove their {pendingCorpRevoke?.planType?.toUpperCase()} plan, delete all their team members, 
              and set their subscription to FREE.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => pendingCorpRevoke && revokeCorporateAdmin(pendingCorpRevoke.userId)} 
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? 'Processing...' : 'Revoke'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke Corporate Member Confirmation Dialog */}
      <AlertDialog open={!!pendingMemberRevoke} onOpenChange={(open) => !open && setPendingMemberRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Revoke Corporate Member Access</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke corporate member access from "{pendingMemberRevoke?.userName}"?
              <br /><br />
              <strong>Organization:</strong> {pendingMemberRevoke?.organizationName}<br />
              <strong>Plan:</strong> {pendingMemberRevoke?.planType?.toUpperCase()}
              <br /><br />
              This will remove their Premium access and set their subscription to FREE.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => pendingMemberRevoke && revokeCorporateMember(pendingMemberRevoke.userId, pendingMemberRevoke.corporateSubscriptionId)} 
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? 'Processing...' : 'Revoke Member'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>User Management</CardTitle>
              <CardDescription>View and manage all registered users</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={fetchUsers} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={exportToCSV} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters Row 1: Search + Plan + Status */}
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plans</SelectItem>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="paid_premium">Paid Premium</SelectItem>
                <SelectItem value="manual_access">Manual Access</SelectItem>
                <SelectItem value="premium">All Premium Access</SelectItem>
                <SelectItem value="purchase">Standalone Purchase</SelectItem>
                <SelectItem value="corporate">Corporate</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[170px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="paid_premium">🟢 Paid Premium</SelectItem>
                <SelectItem value="manual_access">🟣 Manual Access</SelectItem>
                <SelectItem value="expired">🔴 Expired</SelectItem>
                <SelectItem value="revoked">🟠 Revoked</SelectItem>
                <SelectItem value="free">⚪ Free</SelectItem>
                <SelectItem value="purchase_only">💳 Purchase Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filters Row 2: Role + Source + Org + Sort */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-[170px]">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admins">👑 Admins</SelectItem>
                <SelectItem value="corporate_admins">🏢 Corp Admins</SelectItem>
                <SelectItem value="corporate_members">👥 Corp Members</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="stripe">Stripe Paid</SelectItem>
                <SelectItem value="admin_grant">Manual Access</SelectItem>
                <SelectItem value="corporate">Corporate</SelectItem>
              </SelectContent>
            </Select>
            {organizations.length > 0 && (
              <Select value={organizationFilter} onValueChange={setOrganizationFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Organization" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Organizations</SelectItem>
                  {organizations.map((org) => (
                    <SelectItem key={org} value={org}>🏛️ {org}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <ArrowUpDown className="h-4 w-4 mr-2 shrink-0" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest_registered">Newest Registered</SelectItem>
                <SelectItem value="oldest_registered">Oldest Registered</SelectItem>
                <SelectItem value="newest_subscribed">Newest Subscribed</SelectItem>
                <SelectItem value="oldest_subscribed">Oldest Subscribed</SelectItem>
                <SelectItem value="plan_tier">Plan Tier</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 mb-6">
            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="text-xs text-muted-foreground">Total Users</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <div className="bg-green-50 dark:bg-green-950/30 p-3 rounded-lg">
              <p className="text-xs text-muted-foreground">Paid Premium</p>
              <p className="text-2xl font-bold text-green-600">{stats.paidPremium}</p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-950/30 p-3 rounded-lg">
              <p className="text-xs text-muted-foreground">Manual Access</p>
              <p className="text-2xl font-bold text-purple-600">{stats.manualAccess}</p>
            </div>
            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="text-xs text-muted-foreground">Premium</p>
              <p className="text-2xl font-bold">{stats.premium}</p>
            </div>
            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="text-xs text-muted-foreground">Purchases</p>
              <p className="text-2xl font-bold">{stats.purchases}</p>
            </div>
            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="text-xs text-muted-foreground">Admins</p>
              <p className="text-2xl font-bold">{stats.admins}</p>
            </div>
          </div>

          {/* Users Cards */}
          <div className="space-y-3">
            {filteredAndSortedUsers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border rounded-lg">
                No users found
              </div>
            ) : (
              filteredAndSortedUsers.map((user) => {
                const hasPurchases = userPurchases.includes(user.user_id);
                const statusLabel = getUserStatus(user, hasPurchases);
                const isPremium = isActivePremium(user);
                const userName = user.full_name || user.email || 'Anonymous';
                const corpInfo = corporateInfo[user.user_id];
                const isCorporateAdmin = !!corpInfo?.adminPlanType;
                const isCorporateMember = !!corpInfo?.memberPlanType;
                const hasEndedStripePlan = !!user.stripe_subscription_id && !!user.current_period_end && new Date(user.current_period_end).getTime() < Date.now();
                
                return (
                  <div
                    key={user.user_id}
                    className="border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => {
                      setSelectedUser(user);
                      setIsDetailModalOpen(true);
                    }}
                  >
                    {/* Top section: User info */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Avatar>
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback>{user.full_name?.charAt(0) || 'U'}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{user.full_name || 'Anonymous'}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email || 'N/A'}</p>
                        </div>
                      </div>

                      {/* Badges row */}
                      <div className="flex flex-wrap items-center gap-1">
                        {userRoles[user.user_id]?.includes('admin') && (
                          <Badge variant="destructive" className="text-xs">
                            👑 Admin{isMainAdmin(user.user_id) && " (Main)"}
                          </Badge>
                        )}
                        {isCorporateMember && !user.stripe_subscription_id && user.subscription_source !== 'admin_grant' ? (
                          <Badge className="bg-teal-600 hover:bg-teal-700 text-white text-xs">Premium (Corporate)</Badge>
                        ) : (
                          <>
                            <Badge variant={getPlanBadgeVariant(user.plan_type)} className="text-xs">{getPlanLabel(user.plan_type)}</Badge>
                            {user.subscription_source === 'admin_grant' && statusLabel !== 'Manual Access' && (
                              <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">Manual Access</Badge>
                            )}
                            {user.stripe_subscription_id && (
                              <Badge variant="outline" className="text-xs border-green-600 text-green-600">Paid</Badge>
                            )}
                            {user.subscription_source === 'stripe' && (
                              <Badge variant="outline" className="text-xs">Stripe</Badge>
                            )}
                          </>
                        )}
                        <Badge 
                          variant={getStatusBadgeVariant(statusLabel)}
                          className={getStatusBadgeClassName(statusLabel) + " text-xs"}
                        >
                          {statusLabel}
                        </Badge>
                        {user.cancel_at_period_end && statusLabel === 'Paid Premium' && (
                          <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20">
                            Cancels at period end
                          </Badge>
                        )}
                        {hasEndedStripePlan && user.status === 'active' && (
                          <Badge variant="destructive" className="text-xs">Stripe sync needed</Badge>
                        )}
                        {hasPurchases && (
                          <Badge variant="outline" className="text-xs">💳 Purchases</Badge>
                        )}
                        {isCorporateAdmin && (
                          <>
                            <Badge variant="default" className="text-xs bg-blue-600">
                              🏢 Corp Admin ({getCorporatePlanLabel(corpInfo.adminPlanType)})
                            </Badge>
                            {corpInfo.organizationName && (
                              <Badge 
                                variant="outline" 
                                className="text-xs border-teal-600 text-teal-600 cursor-pointer hover:bg-teal-50 dark:hover:bg-teal-950"
                                onClick={(e) => { e.stopPropagation(); setOrganizationFilter(corpInfo.organizationName!); }}
                              >
                                🏛️ {corpInfo.organizationName}
                              </Badge>
                            )}
                          </>
                        )}
                        {isCorporateMember && (
                          <>
                            <Badge className="text-xs bg-teal-600 hover:bg-teal-700 text-white">👥 Premium (Corporate)</Badge>
                            {corpInfo.organizationName && (
                              <Badge 
                                variant="outline" 
                                className="text-xs border-teal-600 text-teal-600 cursor-pointer hover:bg-teal-50 dark:hover:bg-teal-950"
                                onClick={(e) => { e.stopPropagation(); setOrganizationFilter(corpInfo.organizationName!); }}
                              >
                                🏛️ {corpInfo.organizationName}
                              </Badge>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Middle: Dates */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mb-3">
                      <span>Joined: {format(new Date(user.created_at), 'MMM d, yyyy')}</span>
                      <span>Period End: {user.current_period_end
                        ? format(new Date(user.current_period_end), 'MMM d, yyyy')
                        : user.subscription_source === 'admin_grant' && PREMIUM_PLAN_TYPES.has(user.plan_type)
                          ? 'Manual access'
                          : 'N/A'}</span>
                      <span>Subscribed: {user.subscription_created_at && user.plan_type !== 'free'
                        ? format(new Date(user.subscription_created_at), 'MMM d, yyyy')
                        : '—'}</span>
                      <span>Last Sync: {user.subscription_updated_at
                        ? format(new Date(user.subscription_updated_at), 'MMM d, yyyy')
                        : '—'}</span>
                    </div>

                    {/* Bottom: Action buttons horizontally */}
                    <div className="flex flex-row flex-wrap items-center gap-1 border-t pt-3">
                      <Button
                        variant={userRoles[user.user_id]?.includes('admin') ? "destructive" : "default"}
                        size="sm"
                        className="h-7 text-xs px-2 whitespace-nowrap"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAdminRole(user.user_id, user.email, userRoles[user.user_id]?.includes('admin') || false);
                        }}
                        disabled={isMainAdmin(user.user_id) && userRoles[user.user_id]?.includes('admin')}
                      >
                        {userRoles[user.user_id]?.includes('admin') ? "Remove Admin" : "Make Admin"}
                      </Button>

                      {!isPremium ? (
                        <Button variant="outline" size="sm" className="h-7 text-xs px-2 text-primary border-primary hover:bg-primary/10 whitespace-nowrap"
                          onClick={(e) => { e.stopPropagation(); setPendingAction({ userId: user.user_id, userName, action: 'grant', planType: 'lifetime' }); }}>
                          <Crown className="h-3 w-3 mr-1" />Grant Premium
                        </Button>
                      ) : (
                        <>
                          <Button variant="destructive" size="sm" className="h-7 text-xs px-2 whitespace-nowrap"
                            onClick={(e) => { e.stopPropagation(); setPendingAction({ userId: user.user_id, userName, action: 'revoke', planType: 'free' }); }}>
                            Revoke
                          </Button>
                        </>
                      )}

                      <Button variant="ghost" size="sm" className="h-7 px-2"
                        onClick={(e) => { e.stopPropagation(); if (user.email) window.location.href = `mailto:${user.email}`; }}
                        disabled={!user.email}>
                        <Mail className="h-3 w-3" />
                      </Button>

                      {user.stripe_customer_id && (
                        <Button variant="outline" size="sm" className="h-7 text-xs px-2 whitespace-nowrap"
                          onClick={(e) => { e.stopPropagation(); syncStripeSubscription(user.user_id); }}
                          disabled={syncingUserId === user.user_id}>
                          <RefreshCw className={`h-3 w-3 mr-1 ${syncingUserId === user.user_id ? 'animate-spin' : ''}`} />Sync Stripe
                        </Button>
                      )}

                      {!isCorporateAdmin && !isCorporateMember ? (
                        <>
                          {['dynamic', 'power', 'elite', 'enterprise'].map(pt => (
                            <Button key={pt} variant="outline" size="sm" className="h-7 text-xs px-2 text-blue-600 border-blue-600 hover:bg-blue-50 whitespace-nowrap"
                              onClick={(e) => { e.stopPropagation(); setPendingCorpAction({ userId: user.user_id, userName, planType: pt }); }}>
                              <Building2 className="h-3 w-3 mr-1" />{pt.charAt(0).toUpperCase() + pt.slice(1)}
                            </Button>
                          ))}
                        </>
                      ) : isCorporateAdmin ? (
                        <Button variant="destructive" size="sm" className="h-7 text-xs px-2 whitespace-nowrap"
                          onClick={(e) => { e.stopPropagation(); setPendingCorpRevoke({ userId: user.user_id, userName, planType: corpInfo.adminPlanType || '' }); }}>
                          <Building2 className="h-3 w-3 mr-1" />Revoke Corp
                        </Button>
                      ) : isCorporateMember ? (
                        <Button variant="destructive" size="sm" className="h-7 text-xs px-2 whitespace-nowrap"
                          onClick={(e) => { e.stopPropagation(); setPendingMemberRevoke({ userId: user.user_id, userName, organizationName: corpInfo.organizationName || 'Unknown', planType: corpInfo.memberPlanType || '', corporateSubscriptionId: corpInfo.corporateSubscriptionId || '' }); }}>
                          <UserMinus className="h-3 w-3 mr-1" />Revoke Member
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      <UserDetailModal
        user={selectedUser}
        isOpen={isDetailModalOpen}
        onClose={() => { setIsDetailModalOpen(false); setSelectedUser(null); }}
        corporateInfo={selectedUser ? corporateInfo[selectedUser.user_id] : undefined}
        isAdmin={selectedUser ? userRoles[selectedUser.user_id]?.includes('admin') : false}
        onRefresh={fetchUsers}
      />
    </div>
  );
}
