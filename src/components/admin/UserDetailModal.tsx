import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Mail, 
  Bell, 
  Crown, 
  Gem, 
  Building2, 
  ShoppingBag,
  Calendar,
  User,
  Copy,
  Check,
  MessageSquare,
  UserMinus,
  Shield,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { UserParQHistoryTab } from "./UserParQHistoryTab";
import { isCurrentPremiumAccess, normalizePlanLabel } from "@/lib/admin-analytics";

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
  created_at: string; // Profile creation date (joined platform)
  subscription_created_at?: string | null; // When first subscribed
  subscription_updated_at?: string | null; // Last subscription modification
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_source?: string | null;
  cancel_at_period_end?: boolean;
}

interface CorporateInfo {
  adminPlanType: string | null;
  memberPlanType: string | null;
  organizationName: string | null;
  corporateSubscriptionId: string | null;
  periodEnd?: string | null;
  addedBy?: string | null;
  addedAt?: string | null;
}

interface Purchase {
  id: string;
  content_type: string;
  content_name: string;
  price: number;
  purchased_at: string;
}

interface StripeInvoice {
  id: string;
  number: string | null;
  amount_paid: number;
  currency: string;
  created: number;
  description: string;
  hosted_invoice_url: string | null;
}

interface UserDetailModalProps {
  user: UserData | null;
  isOpen: boolean;
  onClose: () => void;
  corporateInfo?: CorporateInfo;
  isAdmin?: boolean;
  onRefresh: () => void;
}

export function UserDetailModal({ 
  user, 
  isOpen, 
  onClose, 
  corporateInfo,
  isAdmin = false,
  onRefresh
}: UserDetailModalProps) {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loadingPurchases, setLoadingPurchases] = useState(false);
  const [stripeInvoices, setStripeInvoices] = useState<StripeInvoice[]>([]);
  const [stripeFirstSubscribedAt, setStripeFirstSubscribedAt] = useState<string | null>(null);
  const [loadingStripe, setLoadingStripe] = useState(false);
  const [copied, setCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [corporateDetails, setCorporateDetails] = useState<{
    periodEnd?: string;
    createdAt?: string;
    adminEmail?: string;
  } | null>(null);

  useEffect(() => {
    if (user && isOpen) {
      fetchPurchases();
      fetchStripeHistory();
      if (corporateInfo?.memberPlanType || corporateInfo?.adminPlanType) {
        fetchCorporateDetails();
      }
    }
  }, [user, isOpen, corporateInfo]);

  const fetchPurchases = async () => {
    if (!user) return;
    setLoadingPurchases(true);
    try {
      const { data } = await supabase
        .from('user_purchases')
        .select('*')
        .eq('user_id', user.user_id)
        .order('purchased_at', { ascending: false });
      
      setPurchases(data || []);
    } finally {
      setLoadingPurchases(false);
    }
  };

  const fetchStripeHistory = async () => {
    if (!user) return;
    setLoadingStripe(true);
    setStripeInvoices([]);
    setStripeFirstSubscribedAt(null);
    try {
      const { data, error } = await supabase.functions.invoke('admin-get-stripe-history', {
        body: { target_user_id: user.user_id }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setStripeInvoices(data?.invoices || []);
      setStripeFirstSubscribedAt(data?.first_subscribed_at || null);
    } catch (e) {
      console.error('Stripe history fetch failed:', e);
    } finally {
      setLoadingStripe(false);
    }
  };

  const fetchCorporateDetails = async () => {
    if (!user || !corporateInfo?.corporateSubscriptionId) return;
    
    try {
      // Fetch corporate subscription details
      const { data: corpSub } = await supabase
        .from('corporate_subscriptions')
        .select('current_period_end, created_at, admin_user_id')
        .eq('id', corporateInfo.corporateSubscriptionId)
        .single();

      if (corpSub) {
        // If this is a member, fetch admin's profile
        let adminEmail = undefined;
        if (corporateInfo.memberPlanType && corpSub.admin_user_id !== user.user_id) {
          const { data: adminProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', corpSub.admin_user_id)
            .single();
          
          // Get admin email from edge function
          const { data: usersData } = await supabase.functions.invoke('get-users-with-emails');
          const adminUser = usersData?.users?.find((u: any) => u.user_id === corpSub.admin_user_id);
          adminEmail = adminUser?.email;
        }

        setCorporateDetails({
          periodEnd: corpSub.current_period_end,
          createdAt: corpSub.created_at,
          adminEmail
        });
      }
    } catch (error) {
      console.error('Error fetching corporate details:', error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied to clipboard');
  };

  const sendNotification = async () => {
    if (!user) return;
    
    // Open email composer or notification form
    // For now, open email
    if (user.email) {
      window.location.href = `mailto:${user.email}`;
    }
  };

  const manageSubscription = async (action: 'grant' | 'revoke', planType: string) => {
    if (!user) return;
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-subscription', {
        body: { 
          user_id: user.user_id, 
          action, 
          plan_type: planType 
        }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Unknown error');

      toast.success(data.message);
      onRefresh();
      onClose();
    } catch (error) {
      console.error('Error managing subscription:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update subscription');
    } finally {
      setActionLoading(false);
    }
  };

  const syncStripeSubscription = async () => {
    if (!user) return;
    setSyncLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription', {
        body: { target_user_id: user.user_id }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Stripe subscription synced');
      onRefresh();
      onClose();
    } catch (error) {
      console.error('Error syncing Stripe subscription:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to sync Stripe subscription');
    } finally {
      setSyncLoading(false);
    }
  };

  const toggleAdminRole = async () => {
    if (!user) return;
    setActionLoading(true);
    try {
      if (isAdmin) {
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', user.user_id)
          .eq('role', 'admin');
        
        if (error) throw error;
        toast.success("Admin privileges removed");
      } else {
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: user.user_id, role: 'admin' });
        
        if (error) throw error;
        toast.success("Admin privileges granted");
      }
      
      onRefresh();
      onClose();
    } catch (error) {
      console.error('Error toggling admin role:', error);
      toast.error("Failed to update admin privileges");
    } finally {
      setActionLoading(false);
    }
  };

  const revokeCorporateMember = async () => {
    if (!user || !corporateInfo?.corporateSubscriptionId) return;
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('revoke-corporate-member', {
        body: { 
          member_user_id: user.user_id, 
          corporate_subscription_id: corporateInfo.corporateSubscriptionId 
        }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Unknown error');

      toast.success(data.message);
      onRefresh();
      onClose();
    } catch (error) {
      console.error('Error revoking corporate member:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to revoke member');
    } finally {
      setActionLoading(false);
    }
  };

  const revokeCorporateAdmin = async () => {
    if (!user) return;
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('revoke-corporate-admin', {
        body: { user_id: user.user_id }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Unknown error');

      toast.success(data.message);
      onRefresh();
      onClose();
    } catch (error) {
      console.error('Error revoking corporate admin:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to revoke corporate admin');
    } finally {
      setActionLoading(false);
    }
  };

  if (!user) return null;

  const isPremium = isCurrentPremiumAccess(user as any);
  const isCorporateAdmin = !!corporateInfo?.adminPlanType;
  const isCorporateMember = !!corporateInfo?.memberPlanType;
  const hasEndedStripePlan = !!user.stripe_subscription_id && !!user.current_period_end && new Date(user.current_period_end).getTime() < Date.now();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>User Details</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[70vh] pr-4">
          {/* Profile Header */}
          <div className="flex items-start gap-4 mb-6">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.avatar_url || undefined} />
              <AvatarFallback className="text-xl">
                {user.full_name?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="text-xl font-semibold">{user.full_name || 'Anonymous'}</h3>
              <p className="text-muted-foreground">{user.email || 'No email'}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {isAdmin && (
                  <Badge variant="destructive">👑 Admin</Badge>
                )}
                <Badge variant={isPremium ? 'default' : 'outline'}>
                  {normalizePlanLabel(user as any).toUpperCase()}
                </Badge>
                {user.subscription_source === 'admin_grant' && (
                  <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                    Manual Access
                  </Badge>
                )}
                {user.subscription_source === 'stripe' && (
                  <Badge variant="outline">Stripe</Badge>
                )}
                {hasEndedStripePlan && user.status === 'active' && (
                  <Badge variant="destructive">Needs Stripe Sync</Badge>
                )}
                {isCorporateAdmin && (
                  <Badge className="bg-blue-600">🏢 Corp Admin ({corporateInfo.adminPlanType})</Badge>
                )}
                {isCorporateMember && (
                  <Badge variant="outline" className="border-blue-600 text-blue-600">
                    👥 Corp Member ({corporateInfo.memberPlanType})
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
            <span>User ID:</span>
            <code className="bg-muted px-2 py-1 rounded text-xs">{user.user_id}</code>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => copyToClipboard(user.user_id)}
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>

          <Separator className="my-4" />

          <Tabs defaultValue="subscription" className="w-full">
            <TabsList className="grid w-full h-auto grid-cols-2 gap-1 p-1 sm:grid-cols-5">
              <TabsTrigger value="subscription" className="text-xs whitespace-normal px-2 py-1.5 sm:text-sm">Subscription</TabsTrigger>
              <TabsTrigger value="purchases" className="text-xs whitespace-normal px-2 py-1.5 sm:text-sm">Purchases</TabsTrigger>
              <TabsTrigger value="workouts" className="text-xs whitespace-normal px-2 py-1.5 sm:text-sm">Workouts</TabsTrigger>
              <TabsTrigger value="parq" className="text-xs whitespace-normal px-2 py-1.5 sm:text-sm">PAR-Q</TabsTrigger>
              <TabsTrigger value="actions" className="text-xs whitespace-normal px-2 py-1.5 sm:text-sm">Actions</TabsTrigger>
            </TabsList>

            {/* Subscription Tab */}
            <TabsContent value="subscription" className="space-y-4 mt-4">
              {/* Personal Subscription */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Personal Subscription
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-muted-foreground">Plan</p>
                      <p className="font-medium">
                        {normalizePlanLabel(user as any)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Status</p>
                      <Badge variant={user.status === 'active' ? 'default' : 'destructive'}>
                        {user.status}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Source</p>
                      <p className="font-medium">{user.subscription_source || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Billing State</p>
                      <p className="font-medium">{hasEndedStripePlan ? 'Ended in Stripe period' : user.cancel_at_period_end ? 'Cancels at period end' : 'Current'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Joined Platform</p>
                      <p>{format(new Date(user.created_at), 'MMM d, yyyy')}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">First Subscribed</p>
                      <p>{stripeFirstSubscribedAt
                        ? format(new Date(stripeFirstSubscribedAt), 'MMM d, yyyy')
                        : user.subscription_created_at
                          ? format(new Date(user.subscription_created_at), 'MMM d, yyyy')
                          : 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Current Plan Since</p>
                      <p>{user.current_period_start 
                        ? format(new Date(user.current_period_start), 'MMM d, yyyy')
                        : 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Plan Expires</p>
                      <p>{user.current_period_end 
                        ? format(new Date(user.current_period_end), 'MMM d, yyyy')
                        : (!user.stripe_subscription_id && user.plan_type !== 'free' 
                          ? 'Manual access' 
                          : 'N/A')}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Last Modified</p>
                      <p>{user.subscription_updated_at 
                        ? format(new Date(user.subscription_updated_at), 'MMM d, yyyy')
                        : 'N/A'}</p>
                    </div>
                    {user.stripe_customer_id && (
                      <div className="col-span-2">
                        <p className="text-muted-foreground">Stripe Customer</p>
                        <code className="text-xs bg-muted px-1 rounded">{user.stripe_customer_id}</code>
                      </div>
                    )}
                    {user.stripe_subscription_id && (
                      <div className="col-span-2 flex flex-wrap items-center gap-2 pt-2">
                        <Button variant="outline" size="sm" onClick={syncStripeSubscription} disabled={syncLoading}>
                          <RefreshCw className={`h-4 w-4 mr-2 ${syncLoading ? 'animate-spin' : ''}`} />
                          Sync from Stripe
                        </Button>
                        <code className="text-xs bg-muted px-1 rounded">{user.stripe_subscription_id}</code>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Corporate Subscription */}
              {(isCorporateAdmin || isCorporateMember) && (
                <Card className="border-blue-200 bg-blue-50/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-blue-600" />
                      Corporate Subscription
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-muted-foreground">Role</p>
                        <p className="font-medium">{isCorporateAdmin ? 'Administrator' : 'Member'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Organization</p>
                        <p className="font-medium">{corporateInfo?.organizationName || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Plan Tier</p>
                        <Badge variant="secondary">
                          {(corporateInfo?.adminPlanType || corporateInfo?.memberPlanType)?.toUpperCase()}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Corp. Period Ends</p>
                        <p>{corporateDetails?.periodEnd 
                          ? format(new Date(corporateDetails.periodEnd), 'MMM d, yyyy')
                          : 'N/A'}</p>
                      </div>
                      {isCorporateMember && corporateDetails?.adminEmail && (
                        <div className="col-span-2">
                          <p className="text-muted-foreground">Added By</p>
                          <p>{corporateDetails.adminEmail}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Purchases Tab */}
            <TabsContent value="purchases" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4" />
                    Payment History ({stripeInvoices.length + purchases.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(loadingPurchases || loadingStripe) ? (
                    <p className="text-muted-foreground text-sm">Loading…</p>
                  ) : stripeInvoices.length === 0 && purchases.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No payments found</p>
                  ) : (
                    <div className="space-y-2">
                      {stripeInvoices.map((inv) => (
                        <div
                          key={inv.id}
                          className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-sm"
                        >
                          <div>
                            <p className="font-medium">
                              {inv.hosted_invoice_url ? (
                                <a href={inv.hosted_invoice_url} target="_blank" rel="noreferrer" className="underline">
                                  {inv.description}
                                </a>
                              ) : inv.description}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Stripe invoice{inv.number ? ` #${inv.number}` : ''} • {format(new Date(inv.created * 1000), 'MMM d, yyyy')}
                            </p>
                          </div>
                          <Badge variant="default">{inv.currency === 'EUR' ? '€' : inv.currency + ' '}{inv.amount_paid.toFixed(2)}</Badge>
                        </div>
                      ))}
                      {purchases.map((purchase) => (
                        <div
                          key={purchase.id}
                          className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-sm"
                        >
                          <div>
                            <p className="font-medium">{purchase.content_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {purchase.content_type} • {format(new Date(purchase.purchased_at), 'MMM d, yyyy')}
                            </p>
                          </div>
                          <Badge variant="outline">€{purchase.price.toFixed(2)}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Workouts Tab */}
            <TabsContent value="workouts" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Workouts created by this member</CardTitle>
                </CardHeader>
                <CardContent>
                  <UserWorkoutsTab userId={user.user_id} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* PAR-Q Tab */}
            <TabsContent value="parq" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">PAR-Q Assessment History</CardTitle>
                </CardHeader>
                <CardContent>
                  <UserParQHistoryTab userId={user.user_id} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Actions Tab */}
            <TabsContent value="actions" className="mt-4 space-y-4">
              {/* Communication Actions */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Communication</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => user.email && (window.location.href = `mailto:${user.email}`)}
                    disabled={!user.email}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Send Email
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={sendNotification}
                  >
                    <Bell className="h-4 w-4 mr-2" />
                    Send Notification
                  </Button>
                </CardContent>
              </Card>

              {/* Subscription Actions */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Subscription Management</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {!isPremium ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => manageSubscription('grant', 'lifetime')}
                      disabled={actionLoading}
                      className="text-primary border-primary hover:bg-primary/10"
                    >
                      <Crown className="h-4 w-4 mr-2" />
                      Grant Premium
                    </Button>
                  ) : (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => manageSubscription('revoke', 'free')}
                      disabled={actionLoading}
                    >
                      Revoke Premium
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Corporate Actions */}
              {(isCorporateAdmin || isCorporateMember) && (
                <Card className="border-destructive/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-destructive">Corporate Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {isCorporateAdmin && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={revokeCorporateAdmin}
                        disabled={actionLoading}
                      >
                        <Building2 className="h-4 w-4 mr-2" />
                        Revoke Corporate Admin
                      </Button>
                    )}
                    {isCorporateMember && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={revokeCorporateMember}
                        disabled={actionLoading}
                      >
                        <UserMinus className="h-4 w-4 mr-2" />
                        Revoke Member Access
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Admin Role Actions */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Platform Role</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button
                    variant={isAdmin ? "destructive" : "outline"}
                    size="sm"
                    onClick={toggleAdminRole}
                    disabled={actionLoading}
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    {isAdmin ? 'Remove Admin' : 'Make Admin'}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
