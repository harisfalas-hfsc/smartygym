import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  Building2, 
  Users, 
  Crown,
  Plus,
  Trash2,
  Calendar,
  RefreshCw,
  Copy,
  Eye,
  EyeOff,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface CorporateSubscription {
  id: string;
  organization_name: string;
  plan_type: string;
  max_users: number;
  current_users_count: number;
  current_period_start: string;
  current_period_end: string;
  status: string;
}

interface CorporateMember {
  id: string;
  user_id: string;
  email: string;
  created_at: string;
  profile?: {
    full_name: string | null;
  };
}

export default function CorporateAdmin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<CorporateSubscription | null>(null);
  const [members, setMembers] = useState<CorporateMember[]>([]);
  const [addingMember, setAddingMember] = useState(false);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  
  // Form state
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberName, setNewMemberName] = useState("");

  useEffect(() => {
    // Check for success parameter
    if (searchParams.get('success') === 'true') {
      toast({
        title: "Welcome to Smarty Corporate!",
        description: "Your corporate subscription is now active. Start adding team members below.",
      });
    }
  }, [searchParams, toast]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchCorporateData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchCorporateData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => authSub.unsubscribe();
  }, []);

  const fetchCorporateData = async (userId: string) => {
    setLoading(true);
    try {
      // Fetch corporate subscription
      const { data: corpSub, error: subError } = await supabase
        .from('corporate_subscriptions')
        .select('*')
        .eq('admin_user_id', userId)
        .maybeSingle();

      if (subError) {
        console.error('Error fetching corporate subscription:', subError);
      }

      if (corpSub) {
        setSubscription(corpSub);
        
        // Fetch members
        const { data: membersData, error: membersError } = await supabase
          .from('corporate_members')
          .select(`
            id,
            user_id,
            email,
            created_at
          `)
          .eq('corporate_subscription_id', corpSub.id)
          .order('created_at', { ascending: true });

        if (membersError) {
          console.error('Error fetching members:', membersError);
        } else if (membersData) {
          // Fetch profiles for members
          const memberIds = membersData.map(m => m.user_id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, full_name')
            .in('user_id', memberIds);

          const membersWithProfiles = membersData.map(member => ({
            ...member,
            profile: profiles?.find(p => p.user_id === member.user_id) || null,
          }));

          setMembers(membersWithProfiles);
        }
      }
    } catch (error) {
      console.error('Error fetching corporate data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!newMemberEmail || !newMemberName) {
      toast({
        title: "Missing Information",
        description: "Please provide both email and name for the new member.",
        variant: "destructive",
      });
      return;
    }

    setAddingMember(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-corporate-member', {
        body: {
          email: newMemberEmail,
          fullName: newMemberName,
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Member Added Successfully!",
        description: `${newMemberName} has been added to your team and will receive a secure email to set their own password.`,
      });

      // Refresh data
      if (user) {
        fetchCorporateData(user.id);
      }

      // Reset form
      resetForm();

    } catch (error) {
      console.error('Error adding member:', error);
      toast({
        title: "Failed to Add Member",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (memberId: string, memberEmail: string) => {
    try {
      // Delete from corporate_members
      const { error } = await supabase
        .from('corporate_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      // Update count
      if (subscription) {
        await supabase
          .from('corporate_subscriptions')
          .update({
            current_users_count: Math.max(0, subscription.current_users_count - 1),
            updated_at: new Date().toISOString(),
          })
          .eq('id', subscription.id);
      }

      toast({
        title: "Member Removed",
        description: `${memberEmail} has been removed from your team.`,
      });

      // Refresh data
      if (user) {
        fetchCorporateData(user.id);
      }
    } catch (error) {
      console.error('Error removing member:', error);
      toast({
        title: "Failed to Remove Member",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setNewMemberEmail("");
    setNewMemberName("");
    setActiveSlotIndex(null);
  };

  const getPlanDisplayName = (planType: string) => {
    const names: Record<string, string> = {
      dynamic: 'Smarty Dynamic',
      power: 'Smarty Power',
      elite: 'Smarty Elite',
      enterprise: 'Smarty Enterprise',
    };
    return names[planType] || planType;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto max-w-6xl md:max-w-[1500px] px-4 pb-8">
          <Card className="text-center p-8">
            <CardContent>
              <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">Sign In Required</h2>
              <p className="text-muted-foreground mb-4">
                Please sign in to access the Corporate Admin Dashboard.
              </p>
              <Button onClick={() => navigate('/auth')}>Sign In</Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto max-w-6xl md:max-w-[1500px] px-4 pb-8">
          <Card className="text-center p-8">
            <CardContent>
              <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">No Corporate Subscription</h2>
              <p className="text-muted-foreground mb-4">
                You don't have an active corporate subscription. Get started with a corporate plan to manage team members.
              </p>
              <Button onClick={() => navigate('/corporate')}>View Corporate Plans</Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const isActive = subscription.status === 'active';
  const displayMaxUsers = subscription.max_users === 9999 ? 50 : subscription.max_users; // Cap display at 50 for enterprise
  const usagePercentage = (subscription.current_users_count / subscription.max_users) * 100;
  const canAddMore = subscription.current_users_count < subscription.max_users;

  // Create slots array for visual display
  const slots = Array.from({ length: displayMaxUsers }, (_, index) => {
    return members[index] || null;
  });

  // Find the first empty slot index
  const firstEmptySlotIndex = slots.findIndex(slot => slot === null);

  return (
    <>
      <Helmet>
        <title>Corporate Admin Dashboard | SmartyGym</title>
        <meta name="description" content="Private SmartyGym corporate dashboard for managing team membership, seats, billing status, and access." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <main className="container mx-auto max-w-6xl md:max-w-[1500px] px-4 pb-8">

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Building2 className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Corporate Admin Dashboard</h1>
              <p className="text-muted-foreground">{subscription.organization_name}</p>
            </div>
          </div>

          {/* Subscription Info Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Plan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-primary" />
                  <span className="text-xl font-bold">{getPlanDisplayName(subscription.plan_type)}</span>
                </div>
                <Badge className={isActive ? "bg-green-100 text-green-800 mt-2" : "bg-red-100 text-red-800 mt-2"}>
                  {isActive ? 'Active' : 'Inactive'}
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Team Members</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  <span className="text-xl font-bold">
                    {subscription.current_users_count} / {subscription.max_users === 9999 ? '∞' : subscription.max_users}
                  </span>
                </div>
                {subscription.max_users !== 9999 && (
                  <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Subscription Period</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  <div className="text-sm">
                    <p>Ends: <span className="font-semibold">{format(new Date(subscription.current_period_end), 'MMM dd, yyyy')}</span></p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  All team members have access until this date
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Team Member Slots */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Team Member Slots ({subscription.current_users_count}/{subscription.max_users === 9999 ? '∞' : subscription.max_users} used)
              </CardTitle>
              <CardDescription>
                Manage your team members. Each slot represents one Premium access account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {slots.map((member, index) => (
                  <div
                    key={index}
                    className={`border rounded-lg p-4 transition-all ${
                      member 
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                        : activeSlotIndex === index 
                          ? 'bg-primary/5 border-primary' 
                          : 'bg-muted/30 border-dashed border-muted-foreground/30'
                    }`}
                  >
                    {/* Slot Header */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        SLOT {index + 1}
                      </span>
                      {member && (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">
                          <UserCheck className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      )}
                    </div>

                    {member ? (
                      // Filled Slot - Show member info
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                            <span className="text-sm font-bold text-primary">
                              {member.profile?.full_name?.charAt(0) || member.email.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {member.profile?.full_name || 'No Name'}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {member.email}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Crown className="h-3 w-3 text-primary" />
                            <span className="text-xs text-muted-foreground">Premium Access</span>
                          </div>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive h-7 px-2">
                                <Trash2 className="h-3 w-3 mr-1" />
                                Remove
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove Team Member?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will remove {member.email} from your team. Their account will remain but they will lose Premium access.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => handleRemoveMember(member.id, member.email)}
                                >
                                  Remove Member
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ) : activeSlotIndex === index ? (
                      // Active empty slot - Show form
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor={`name-${index}`} className="text-xs">Full Name</Label>
                          <Input
                            id={`name-${index}`}
                            placeholder="John Smith"
                            value={newMemberName}
                            onChange={(e) => setNewMemberName(e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`email-${index}`} className="text-xs">Email Address</Label>
                          <Input
                            id={`email-${index}`}
                            type="email"
                            placeholder="member@company.com"
                            value={newMemberEmail}
                            onChange={(e) => setNewMemberEmail(e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm"
                            onClick={handleAddMember}
                            disabled={addingMember || !newMemberEmail || !newMemberName}
                            className="flex-1 h-8"
                          >
                            {addingMember ? "Adding..." : "Add Member"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={resetForm}
                            className="h-8"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // Empty slot - Show add button
                      <div className="flex flex-col items-center justify-center py-4">
                        <div className="h-10 w-10 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center mb-2">
                          <UserPlus className="h-5 w-5 text-muted-foreground/50" />
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">Empty Slot</p>
                        {isActive && canAddMore && index === firstEmptySlotIndex && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setActiveSlotIndex(index)}
                            className="h-7 text-xs"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add Member
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Enterprise plan note */}
              {subscription.max_users === 9999 && (
                <p className="text-sm text-muted-foreground mt-4 text-center">
                  Showing first 50 slots. Your Enterprise plan supports unlimited team members.
                </p>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </>
  );
}
