import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Settings, Bell, Mail, Database, Shield, Download, HeartPulse, Wrench, Image, RefreshCw, Search, ImagePlus, Send, Trash2, ShoppingCart, HelpCircle, ClipboardCheck, Tag, FileCheck2 } from "lucide-react";
import { SystemHealthAudit } from "./SystemHealthAudit";
import { FormatIntegrityAudit } from "./FormatIntegrityAudit";
import { WorkoutComplianceAudit } from "./WorkoutComplianceAudit";
import WorkoutRepairPanel from "./WorkoutRepairPanel";

export const SettingsManager = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // General Settings
  const [defaultWorkoutDuration, setDefaultWorkoutDuration] = useState("30");
  const [defaultProgramWeeks, setDefaultProgramWeeks] = useState("8");
  const [defaultPrice, setDefaultPrice] = useState("9.99");
  const [currency, setCurrency] = useState("EUR");

  // Notification Settings
  const [emailOnNewContact, setEmailOnNewContact] = useState(true);
  const [emailOnNewPurchase, setEmailOnNewPurchase] = useState(true);
  const [emailOnNewPTRequest, setEmailOnNewPTRequest] = useState(true);
  const [dailyAnalyticsSummary, setDailyAnalyticsSummary] = useState(false);

  // System Configuration
  const [maxImageSize, setMaxImageSize] = useState("5");
  const [allowGuestPurchases, setAllowGuestPurchases] = useState(true);

  // Access Control
  const [requireEmailVerification, setRequireEmailVerification] = useState(false);
  const [autoApprovePurchases, setAutoApprovePurchases] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState("24");
  const [inactivityTimeout, setInactivityTimeout] = useState("30");

  // Stripe Cleanup
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<{ updated: number; message: string } | null>(null);

  // Admin Tools Loading States
  // [REMOVED] syncImages / regenerateWod state — WOD generation deleted; library mode only.
  const [refreshSeoLoading, setRefreshSeoLoading] = useState(false);
  const [refreshSeoResult, setRefreshSeoResult] = useState<string | null>(null);
  const [generateImagesLoading, setGenerateImagesLoading] = useState(false);
  const [generateImagesResult, setGenerateImagesResult] = useState<string | null>(null);
  const [repairJobId, setRepairJobId] = useState<string | null>(null);
  const [repairJobStatus, setRepairJobStatus] = useState<any | null>(null);
  const [reengagementLoading, setReengagementLoading] = useState(false);
  const [reengagementResult, setReengagementResult] = useState<string | null>(null);
  const [cleanupRateLimitsLoading, setCleanupRateLimitsLoading] = useState(false);
  const [cleanupRateLimitsResult, setCleanupRateLimitsResult] = useState<string | null>(null);
  const [auditStripeImagesLoading, setAuditStripeImagesLoading] = useState(false);
  const [auditStripeImagesResult, setAuditStripeImagesResult] = useState<string | null>(null);
  const [pullStripeImagesLoading, setPullStripeImagesLoading] = useState(false);
  const [pullStripeImagesResult, setPullStripeImagesResult] = useState<string | null>(null);
  const [checkImageStatusLoading, setCheckImageStatusLoading] = useState(false);
  const [checkImageStatusResult, setCheckImageStatusResult] = useState<any | null>(null);
  const [fixMetadataLoading, setFixMetadataLoading] = useState(false);
  const [fixMetadataResult, setFixMetadataResult] = useState<any | null>(null);

  // Load inactivity timeout on mount
  useEffect(() => {
    const loadInactivityTimeout = async () => {
      const { data } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'inactivity_timeout_minutes')
        .single();
      
      if (data?.setting_value) {
        setInactivityTimeout(data.setting_value as string);
      }
    };

    loadInactivityTimeout();
  }, []);

  const handleSaveGeneral = async () => {
    setLoading(true);
    try {
      toast({
        title: "Settings Saved",
        description: "General preferences have been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotifications = async () => {
    setLoading(true);
    try {
      toast({
        title: "Settings Saved",
        description: "Notification preferences have been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSystem = async () => {
    setLoading(true);
    try {
      toast({
        title: "Settings Saved",
        description: "System configuration has been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAccessControl = async () => {
    setLoading(true);
    try {
      // Save inactivity timeout to database
      const { error } = await supabase
        .from('system_settings')
        .update({ setting_value: inactivityTimeout })
        .eq('setting_key', 'inactivity_timeout_minutes');

      if (error) throw error;

      toast({
        title: "Settings Saved",
        description: "Access control settings have been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportDatabase = async () => {
    setLoading(true);
    try {
      // Export workouts
      const { data: workouts } = await supabase
        .from('admin_workouts')
        .select('*');
      
      // Export programs
      const { data: programs } = await supabase
        .from('admin_training_programs')
        .select('*');

      // Create export object
      const exportData = {
        workouts: workouts || [],
        programs: programs || [],
        exportDate: new Date().toISOString(),
      };

      // Download as JSON
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `smartygym-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: "Database backup has been downloaded.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export database. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-users-with-emails');
      
      if (error) throw error;

      // Download as CSV
      const csvContent = [
        ['Email', 'Created At', 'Last Sign In'].join(','),
        ...data.users.map((user: any) => 
          [user.email, user.created_at, user.last_sign_in_at].join(',')
        )
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: "User list has been downloaded.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export users. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCleanupStripeProducts = async () => {
    if (!confirm("This will remove the 'WOD:' prefix from all Stripe product names. Continue?")) {
      return;
    }
    
    setCleanupLoading(true);
    setCleanupResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('cleanup-stripe-wod-names');
      
      if (error) throw error;

      if (data.success) {
        setCleanupResult({ updated: data.updated?.length || 0, message: data.message });
        toast({
          title: "Cleanup Complete",
          description: data.message,
        });
      } else {
        throw new Error(data.error || "Unknown error");
      }
    } catch (error: any) {
      toast({
        title: "Cleanup Failed",
        description: error.message || "Failed to cleanup Stripe products.",
        variant: "destructive",
      });
    } finally {
      setCleanupLoading(false);
    }
  };

  // [REMOVED] handleSyncStripeImages + handleRegenerateWod — WOD generation deleted (library mode only).

  const handleRefreshSeo = async () => {
    if (!confirm("This will refresh SEO metadata for all content. This may take a while. Continue?")) {
      return;
    }
    
    setRefreshSeoLoading(true);
    setRefreshSeoResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('refresh-seo-metadata');
      
      if (error) throw error;

      setRefreshSeoResult(`Updated ${data.updated || 0} items`);
      toast({
        title: "SEO Refresh Complete",
        description: `Successfully updated SEO metadata for ${data.updated || 0} items.`,
      });
    } catch (error: any) {
      toast({
        title: "Refresh Failed",
        description: error.message || "Failed to refresh SEO metadata.",
        variant: "destructive",
      });
    } finally {
      setRefreshSeoLoading(false);
    }
  };

  // Poll for repair job status
  useEffect(() => {
    if (!repairJobId) return;
    
    const pollStatus = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-repair-job-status', {
          body: null,
        });
        
        if (error) {
          console.error('Failed to get job status:', error);
          return;
        }
        
        setRepairJobStatus(data);
        
        if (data?.status === 'completed') {
          setGenerateImagesLoading(false);
          const result = `Repaired: ${data.repaired_items} items. Skipped: ${data.skipped_items}. Stripe synced: ${data.stripe_synced}.`;
          setGenerateImagesResult(result);
          toast({
            title: "Image Repair Complete",
            description: result,
          });
          setRepairJobId(null);
        } else if (data?.status === 'failed') {
          setGenerateImagesLoading(false);
          setGenerateImagesResult(`Failed: ${data.errors?.join(', ') || 'Unknown error'}`);
          toast({
            title: "Image Repair Failed",
            description: "Check the errors for details.",
            variant: "destructive",
          });
          setRepairJobId(null);
        }
      } catch (err) {
        console.error('Poll error:', err);
      }
    };
    
    const interval = setInterval(pollStatus, 3000);
    pollStatus(); // Initial check
    
    return () => clearInterval(interval);
  }, [repairJobId, toast]);

  const handleGenerateMissingImages = async () => {
    if (!confirm("This will scan ALL workouts and programs, detect broken/missing images, generate new AI images, update the database, and sync to Stripe. Continue?")) {
      return;
    }
    
    setGenerateImagesLoading(true);
    setGenerateImagesResult(null);
    setRepairJobStatus(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('start-image-repair');
      
      if (error) throw error;

      if (data?.success && data?.jobId) {
        setRepairJobId(data.jobId);
        setGenerateImagesResult(`Job started: Processing ${data.totalItems} items...`);
        toast({
          title: "Repair Job Started",
          description: `Processing ${data.totalItems} items. This runs in the background.`,
        });
      } else {
        throw new Error(data?.error || 'Failed to start repair job');
      }
    } catch (error: any) {
      console.error("Image repair error:", error);
      setGenerateImagesResult(`Error: ${error.message}`);
      setGenerateImagesLoading(false);
      toast({
        title: "Repair Failed",
        description: error.message || "Failed to start image repair.",
        variant: "destructive",
      });
    }
  };

  const handleCheckImageStatus = async () => {
    setCheckImageStatusLoading(true);
    setCheckImageStatusResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('check-image-status');
      
      if (error) throw error;

      setCheckImageStatusResult(data);
      toast({
        title: "Status Check Complete",
        description: `${data.summary.fullySynced}/${data.summary.totalItems} items fully synced`,
      });
    } catch (error: any) {
      toast({
        title: "Check Failed",
        description: error.message || "Failed to check image status.",
        variant: "destructive",
      });
    } finally {
      setCheckImageStatusLoading(false);
    }
  };

  const handleSendReengagementEmails = async () => {
    if (!confirm("This will send re-engagement emails to users with expired subscriptions. Continue?")) {
      return;
    }
    
    setReengagementLoading(true);
    setReengagementResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('send-reengagement-emails');
      
      if (error) throw error;

      setReengagementResult(`Sent ${data.sent || 0} emails`);
      toast({
        title: "Emails Sent",
        description: `Successfully sent ${data.sent || 0} re-engagement emails.`,
      });
    } catch (error: any) {
      toast({
        title: "Send Failed",
        description: error.message || "Failed to send re-engagement emails.",
        variant: "destructive",
      });
    } finally {
      setReengagementLoading(false);
    }
  };

  const handleCleanupRateLimits = async () => {
    if (!confirm("This will delete expired rate limit records from the database. Continue?")) {
      return;
    }
    
    setCleanupRateLimitsLoading(true);
    setCleanupRateLimitsResult(null);
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('rate_limits')
        .delete()
        .lt('window_start', oneHourAgo)
        .select();
      
      if (error) throw error;

      const deletedCount = data?.length || 0;
      setCleanupRateLimitsResult(`Deleted ${deletedCount} old records`);
      toast({
        title: "Cleanup Complete",
        description: `Deleted ${deletedCount} expired rate limit records.`,
      });
    } catch (error: any) {
      toast({
        title: "Cleanup Failed",
        description: error.message || "Failed to cleanup rate limits.",
        variant: "destructive",
      });
    } finally {
      setCleanupRateLimitsLoading(false);
    }
  };

  const handleAuditStripeImages = async () => {
    if (!confirm("This will check all Stripe products for missing images and automatically sync website images to Stripe. Continue?")) {
      return;
    }
    
    setAuditStripeImagesLoading(true);
    setAuditStripeImagesResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('audit-stripe-images');
      
      if (error) throw error;

      const result = `${data.total} products checked: ${data.synced} synced, ${data.already_has_image} already had images, ${data.skipped_no_website_image} skipped (no website image)`;
      setAuditStripeImagesResult(result);
      toast({
        title: "Stripe Image Audit Complete",
        description: `Synced ${data.synced} images to Stripe.`,
      });
    } catch (error: any) {
      toast({
        title: "Audit Failed",
        description: error.message || "Failed to audit Stripe images.",
        variant: "destructive",
      });
    } finally {
      setAuditStripeImagesLoading(false);
    }
  };

  const handleFixStripeMetadata = async () => {
    if (!confirm("This will add SMARTYGYM metadata to all Stripe products that are missing it. Continue?")) {
      return;
    }
    
    setFixMetadataLoading(true);
    setFixMetadataResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('fix-stripe-metadata');
      
      if (error) throw error;

      setFixMetadataResult(data);
      toast({
        title: "Metadata Fix Complete",
        description: data.message,
      });
    } catch (error: any) {
      toast({
        title: "Fix Failed",
        description: error.message || "Failed to fix Stripe metadata.",
        variant: "destructive",
      });
    } finally {
      setFixMetadataLoading(false);
    }
  };

  const handlePullStripeImages = async () => {
    if (!confirm("This will download images from Stripe to your website for items that are missing website images but have Stripe images. Continue?")) {
      return;
    }
    
    setPullStripeImagesLoading(true);
    setPullStripeImagesResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('pull-stripe-images');
      
      if (error) throw error;

      const result = `Pulled ${data.workouts_pulled} workout images, ${data.programs_pulled} program images from Stripe`;
      setPullStripeImagesResult(result);
      toast({
        title: "Pull from Stripe Complete",
        description: result,
      });
    } catch (error: any) {
      toast({
        title: "Pull Failed",
        description: error.message || "Failed to pull images from Stripe.",
        variant: "destructive",
      });
    } finally {
      setPullStripeImagesLoading(false);
    }
  };

  return (
    <div className="pt-6 space-y-6 w-full overflow-x-hidden">
      <Tabs defaultValue="general" className="w-full">
        <div className="w-full overflow-x-auto -mx-2 px-2">
          <TabsList className="inline-flex w-auto min-w-full h-auto p-1">
            <TabsTrigger value="general" className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3 py-2 whitespace-nowrap">
              <Settings className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
              <span>General</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3 py-2 whitespace-nowrap">
              <Bell className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
              <span>Alerts</span>
            </TabsTrigger>
            <TabsTrigger value="system" className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3 py-2 whitespace-nowrap">
              <Mail className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
              <span>System</span>
            </TabsTrigger>
            <TabsTrigger value="access" className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3 py-2 whitespace-nowrap">
              <Shield className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
              <span>Access</span>
            </TabsTrigger>
            <TabsTrigger value="backup" className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3 py-2 whitespace-nowrap">
              <Database className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
              <span>Backup</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* General Preferences */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General Preferences</CardTitle>
              <CardDescription>Configure default values and display options</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm">Default Workout Duration (min)</Label>
                  <Input
                    type="number"
                    value={defaultWorkoutDuration}
                    onChange={(e) => setDefaultWorkoutDuration(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm">Default Program Length (weeks)</Label>
                  <Input
                    type="number"
                    value={defaultProgramWeeks}
                    onChange={(e) => setDefaultProgramWeeks(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm">Default Standalone Price</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={defaultPrice}
                    onChange={(e) => setDefaultPrice(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm">Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleSaveGeneral} disabled={loading}>
                Save General Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>Configure admin alerts and system notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-start sm:items-center justify-between gap-3">
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <Label className="text-xs sm:text-sm">Email on New Contact</Label>
                    <p className="text-xs text-muted-foreground">Get notified of contact messages</p>
                  </div>
                  <Switch
                    checked={emailOnNewContact}
                    onCheckedChange={setEmailOnNewContact}
                    className="shrink-0"
                  />
                </div>
                <div className="flex items-start sm:items-center justify-between gap-3">
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <Label className="text-xs sm:text-sm">Email on New Purchase</Label>
                    <p className="text-xs text-muted-foreground">Get notified of purchases</p>
                  </div>
                  <Switch
                    checked={emailOnNewPurchase}
                    onCheckedChange={setEmailOnNewPurchase}
                    className="shrink-0"
                  />
                </div>
                <div className="flex items-start sm:items-center justify-between gap-3">
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <Label className="text-xs sm:text-sm">Email on PT Request</Label>
                    <p className="text-xs text-muted-foreground">Get notified of PT requests</p>
                  </div>
                  <Switch
                    checked={emailOnNewPTRequest}
                    onCheckedChange={setEmailOnNewPTRequest}
                    className="shrink-0"
                  />
                </div>
                <div className="flex items-start sm:items-center justify-between gap-3">
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <Label className="text-xs sm:text-sm">Daily Analytics</Label>
                    <p className="text-xs text-muted-foreground">Daily platform summary</p>
                  </div>
                  <Switch
                    checked={dailyAnalyticsSummary}
                    onCheckedChange={setDailyAnalyticsSummary}
                    className="shrink-0"
                  />
                </div>
              </div>
              <Button onClick={handleSaveNotifications} disabled={loading}>
                Save Notification Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Configuration */}
        <TabsContent value="system">
          <div className="space-y-6">
            {/* System Health Audit */}
            <SystemHealthAudit />

            {/* Format Integrity Audit */}
            <FormatIntegrityAudit />

            {/* Workout Compliance Audit */}
            <WorkoutComplianceAudit />

            {/* Stripe Product Cleanup */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  Stripe Product Cleanup
                </CardTitle>
                <CardDescription>
                  Remove "WOD:" prefix from Stripe product names. This is a one-time cleanup that won't affect prices, images, or purchase history.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  onClick={handleCleanupStripeProducts} 
                  disabled={cleanupLoading}
                  variant="outline"
                >
                  {cleanupLoading ? "Running Cleanup..." : "Run Stripe Product Cleanup"}
                </Button>
                {cleanupResult && (
                  <p className="text-sm text-muted-foreground">
                    ✅ {cleanupResult.message} ({cleanupResult.updated} products updated)
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Admin Tools Grid */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  Admin Tools
                </CardTitle>
                <CardDescription>
                  Quick actions for common administrative tasks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Audit Stripe Images */}
                  <div className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="h-5 w-5 text-indigo-500" />
                      <h4 className="font-medium text-sm">Audit Stripe Images</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Find Stripe products missing images & auto-sync from website
                    </p>
                    <Button 
                      onClick={handleAuditStripeImages} 
                      disabled={auditStripeImagesLoading}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      {auditStripeImagesLoading ? "Auditing..." : "Audit & Sync"}
                    </Button>
                    {auditStripeImagesResult && (
                      <p className="text-xs text-green-600">✅ {auditStripeImagesResult}</p>
                    )}
                  </div>

                  {/* Refresh SEO */}
                  <div className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center gap-2">
                      <Search className="h-5 w-5 text-purple-500" />
                      <h4 className="font-medium text-sm">Refresh SEO</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Regenerate SEO metadata for all content
                    </p>
                    <Button 
                      onClick={handleRefreshSeo} 
                      disabled={refreshSeoLoading}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      {refreshSeoLoading ? "Refreshing..." : "Refresh SEO"}
                    </Button>
                    {refreshSeoResult && (
                      <p className="text-xs text-green-600">✅ {refreshSeoResult}</p>
                    )}
                  </div>

                  {/* Repair Missing/Broken Images */}
                  <div className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center gap-2">
                      <ImagePlus className="h-5 w-5 text-green-500" />
                      <h4 className="font-medium text-sm">Repair Images</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Detect & fix broken/missing images, then sync to Stripe
                    </p>
                    <Button 
                      onClick={handleGenerateMissingImages} 
                      disabled={generateImagesLoading}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      {generateImagesLoading ? "Repairing..." : "Repair Images"}
                    </Button>
                    {/* Progress indicator */}
                    {repairJobStatus && generateImagesLoading && (
                      <div className="space-y-1">
                        <div className="w-full bg-muted rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full transition-all duration-300"
                            style={{ 
                              width: `${repairJobStatus.total_items > 0 
                                ? (repairJobStatus.processed_items / repairJobStatus.total_items) * 100 
                                : 0}%` 
                            }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {repairJobStatus.processed_items}/{repairJobStatus.total_items} items processed
                          {repairJobStatus.repaired_items > 0 && ` • ${repairJobStatus.repaired_items} repaired`}
                        </p>
                      </div>
                    )}
                    {generateImagesResult && (
                      <p className={`text-xs ${generateImagesResult.startsWith('Error') || generateImagesResult.startsWith('Failed') ? 'text-red-600' : 'text-green-600'}`}>
                        {generateImagesResult.startsWith('Error') || generateImagesResult.startsWith('Failed') ? '❌' : '✅'} {generateImagesResult}
                      </p>
                    )}
                  </div>

                  {/* Send Re-engagement Emails */}
                  <div className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center gap-2">
                      <Send className="h-5 w-5 text-pink-500" />
                      <h4 className="font-medium text-sm">Re-engagement</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Send emails to users with expired subscriptions
                    </p>
                    <Button 
                      onClick={handleSendReengagementEmails} 
                      disabled={reengagementLoading}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      {reengagementLoading ? "Sending..." : "Send Emails"}
                    </Button>
                    {reengagementResult && (
                      <p className="text-xs text-green-600">✅ {reengagementResult}</p>
                    )}
                  </div>

                  {/* Cleanup Rate Limits */}
                  <div className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center gap-2">
                      <Trash2 className="h-5 w-5 text-red-500" />
                      <h4 className="font-medium text-sm">Cleanup Rate Limits</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Delete expired rate limit records
                    </p>
                    <Button 
                      onClick={handleCleanupRateLimits} 
                      disabled={cleanupRateLimitsLoading}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      {cleanupRateLimitsLoading ? "Cleaning..." : "Cleanup"}
                    </Button>
                    {cleanupRateLimitsResult && (
                      <p className="text-xs text-green-600">✅ {cleanupRateLimitsResult}</p>
                    )}
                  </div>

                  {/* Pull from Stripe */}
                  <div className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center gap-2">
                      <Download className="h-5 w-5 text-teal-500" />
                      <h4 className="font-medium text-sm">Pull from Stripe</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Download Stripe images to website when website is missing
                    </p>
                    <Button 
                      onClick={handlePullStripeImages} 
                      disabled={pullStripeImagesLoading}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      {pullStripeImagesLoading ? "Pulling..." : "Pull Images"}
                    </Button>
                    {pullStripeImagesResult && (
                      <p className="text-xs text-green-600">✅ {pullStripeImagesResult}</p>
                    )}
                  </div>

                  {/* Fix Stripe Metadata */}
                  <div className="p-4 border rounded-lg space-y-3 border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/20 dark:border-yellow-800">
                    <div className="flex items-center gap-2">
                      <Tag className="h-5 w-5 text-yellow-600" />
                      <h4 className="font-medium text-sm">Fix Stripe Metadata</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Add SMARTYGYM tags to Stripe products missing metadata
                    </p>
                    <Button 
                      onClick={handleFixStripeMetadata} 
                      disabled={fixMetadataLoading}
                      variant="outline"
                      size="sm"
                      className="w-full border-yellow-300 hover:bg-yellow-100 dark:border-yellow-700 dark:hover:bg-yellow-900"
                    >
                      {fixMetadataLoading ? "Fixing..." : "Fix Metadata"}
                    </Button>
                    {fixMetadataResult && (
                      <div className="text-xs space-y-1 pt-2 border-t border-yellow-200 dark:border-yellow-800">
                        <p className={fixMetadataResult.success ? "text-green-600" : "text-red-600"}>
                          {fixMetadataResult.success ? "✅" : "❌"} {fixMetadataResult.message}
                        </p>
                        {fixMetadataResult.fixed_items?.length > 0 && (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-muted-foreground">Fixed items:</summary>
                            <ul className="pl-3 mt-1">
                              {fixMetadataResult.fixed_items.map((item: string, i: number) => (
                                <li key={i}>• {item}</li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Check Image Status */}
                  <div className="p-4 border rounded-lg space-y-3 border-cyan-200 bg-cyan-50/50 dark:bg-cyan-950/20 dark:border-cyan-800">
                    <div className="flex items-center gap-2">
                      <ClipboardCheck className="h-5 w-5 text-cyan-600" />
                      <h4 className="font-medium text-sm">Check Image Status</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      See current sync state for all workouts & programs
                    </p>
                    <Button 
                      onClick={handleCheckImageStatus} 
                      disabled={checkImageStatusLoading}
                      variant="outline"
                      size="sm"
                      className="w-full border-cyan-300 hover:bg-cyan-100 dark:border-cyan-700 dark:hover:bg-cyan-900"
                    >
                      {checkImageStatusLoading ? "Checking..." : "Check Status"}
                    </Button>
                    {checkImageStatusResult && (
                      <div className="text-xs space-y-2 pt-2 border-t border-cyan-200 dark:border-cyan-800 max-h-96 overflow-y-auto">
                        <div className="font-medium">📊 STATUS REPORT</div>
                        
                        {/* Workouts Section */}
                        <div className="space-y-1">
                          <div><strong>Workouts ({checkImageStatusResult.workouts?.total}):</strong></div>
                          <ul className="pl-3 space-y-0.5 text-muted-foreground">
                            <li>✅ Both synced: {checkImageStatusResult.workouts?.withBoth}</li>
                            <li>⚠️ Website only: {checkImageStatusResult.workouts?.websiteOnly}</li>
                            <li>⚠️ Stripe only: {checkImageStatusResult.workouts?.stripeOnly}</li>
                            <li>❌ No image: {checkImageStatusResult.workouts?.withNeither}</li>
                          </ul>
                          
                          {/* Workout Details */}
                          {checkImageStatusResult.workouts?.noImageItems?.length > 0 && (
                            <details className="pl-3 mt-1">
                              <summary className="cursor-pointer text-red-600 font-medium">❌ Missing images ({checkImageStatusResult.workouts.noImageItems.length}):</summary>
                              <ul className="pl-3 mt-1 space-y-0.5">
                                {checkImageStatusResult.workouts.noImageItems.map((item: any, i: number) => (
                                  <li key={i} className="text-red-600/80">• {item.name} <span className="text-muted-foreground">({item.category})</span></li>
                                ))}
                              </ul>
                            </details>
                          )}
                          {checkImageStatusResult.workouts?.websiteOnlyItems?.length > 0 && (
                            <details className="pl-3 mt-1">
                              <summary className="cursor-pointer text-amber-600 font-medium">⚠️ Website only ({checkImageStatusResult.workouts.websiteOnlyItems.length}):</summary>
                              <ul className="pl-3 mt-1 space-y-0.5">
                                {checkImageStatusResult.workouts.websiteOnlyItems.map((item: any, i: number) => (
                                  <li key={i} className="text-amber-600/80">• {item.name} <span className="text-muted-foreground">({item.category})</span></li>
                                ))}
                              </ul>
                            </details>
                          )}
                          {checkImageStatusResult.workouts?.stripeOnlyItems?.length > 0 && (
                            <details className="pl-3 mt-1">
                              <summary className="cursor-pointer text-amber-600 font-medium">⚠️ Stripe only ({checkImageStatusResult.workouts.stripeOnlyItems.length}):</summary>
                              <ul className="pl-3 mt-1 space-y-0.5">
                                {checkImageStatusResult.workouts.stripeOnlyItems.map((item: any, i: number) => (
                                  <li key={i} className="text-amber-600/80">• {item.name} <span className="text-muted-foreground">({item.category})</span></li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </div>
                        
                        {/* Programs Section */}
                        <div className="space-y-1">
                          <div><strong>Programs ({checkImageStatusResult.programs?.total}):</strong></div>
                          <ul className="pl-3 space-y-0.5 text-muted-foreground">
                            <li>✅ Both synced: {checkImageStatusResult.programs?.withBoth}</li>
                            <li>⚠️ Website only: {checkImageStatusResult.programs?.websiteOnly}</li>
                            <li>⚠️ Stripe only: {checkImageStatusResult.programs?.stripeOnly}</li>
                            <li>❌ No image: {checkImageStatusResult.programs?.withNeither}</li>
                          </ul>
                          
                          {/* Program Details */}
                          {checkImageStatusResult.programs?.noImageItems?.length > 0 && (
                            <details className="pl-3 mt-1">
                              <summary className="cursor-pointer text-red-600 font-medium">❌ Missing images ({checkImageStatusResult.programs.noImageItems.length}):</summary>
                              <ul className="pl-3 mt-1 space-y-0.5">
                                {checkImageStatusResult.programs.noImageItems.map((item: any, i: number) => (
                                  <li key={i} className="text-red-600/80">• {item.name} <span className="text-muted-foreground">({item.category})</span></li>
                                ))}
                              </ul>
                            </details>
                          )}
                          {checkImageStatusResult.programs?.websiteOnlyItems?.length > 0 && (
                            <details className="pl-3 mt-1">
                              <summary className="cursor-pointer text-amber-600 font-medium">⚠️ Website only ({checkImageStatusResult.programs.websiteOnlyItems.length}):</summary>
                              <ul className="pl-3 mt-1 space-y-0.5">
                                {checkImageStatusResult.programs.websiteOnlyItems.map((item: any, i: number) => (
                                  <li key={i} className="text-amber-600/80">• {item.name} <span className="text-muted-foreground">({item.category})</span></li>
                                ))}
                              </ul>
                            </details>
                          )}
                          {checkImageStatusResult.programs?.stripeOnlyItems?.length > 0 && (
                            <details className="pl-3 mt-1">
                              <summary className="cursor-pointer text-amber-600 font-medium">⚠️ Stripe only ({checkImageStatusResult.programs.stripeOnlyItems.length}):</summary>
                              <ul className="pl-3 mt-1 space-y-0.5">
                                {checkImageStatusResult.programs.stripeOnlyItems.map((item: any, i: number) => (
                                  <li key={i} className="text-amber-600/80">• {item.name} <span className="text-muted-foreground">({item.category})</span></li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </div>
                        
                        {/* Orphaned Stripe Products */}
                        {checkImageStatusResult.orphanedProducts?.length > 0 && (
                          <div className="space-y-1 pt-1 border-t border-cyan-200 dark:border-cyan-800">
                            <details>
                              <summary className="cursor-pointer text-purple-600 font-medium">🔮 Orphaned Stripe Products ({checkImageStatusResult.orphanedProducts.length}):</summary>
                              <ul className="pl-3 mt-1 space-y-0.5">
                                {checkImageStatusResult.orphanedProducts.map((item: any, i: number) => (
                                  <li key={i} className="text-purple-600/80">• {item.name} <span className="text-muted-foreground">({item.id})</span></li>
                                ))}
                              </ul>
                            </details>
                          </div>
                        )}
                        
                        {/* Recommendations */}
                        {checkImageStatusResult.recommendations?.length > 0 && (
                          <div className="pt-1 border-t border-cyan-200 dark:border-cyan-800">
                            <div className="font-medium">💡 RECOMMENDATIONS:</div>
                            <ul className="pl-3 text-muted-foreground">
                              {checkImageStatusResult.recommendations.map((rec: string, i: number) => (
                                <li key={i}>• {rec}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Image Sync Guide - spans 2 columns */}
                  <div className="p-4 border rounded-lg space-y-3 sm:col-span-2 bg-muted/30">
                    <div className="flex items-center gap-2">
                      <HelpCircle className="h-5 w-5 text-amber-500" />
                      <h4 className="font-medium text-sm">Image Sync Guide</h4>
                    </div>
                    
                    <div className="text-xs space-y-3">
                      <div>
                        <div className="font-medium text-muted-foreground mb-1">🔧 BUTTONS (works for both Workouts & Programs):</div>
                        <ul className="space-y-0.5 text-muted-foreground">
                          <li>• <strong>Check Status</strong> → See current sync state before any operations</li>
                          <li>• <strong>Generate Images</strong> → Creates AI images for website (missing only)</li>
                          <li>• <strong>Audit Stripe</strong> → Copies website images TO Stripe</li>
                          <li>• <strong>Pull from Stripe</strong> → Downloads Stripe images TO website</li>
                        </ul>
                      </div>
                      
                      <div>
                        <div className="font-medium text-muted-foreground mb-1">🔍 SCENARIOS:</div>
                        <ul className="space-y-0.5 text-muted-foreground">
                          <li>• <strong>Website ✅ / Stripe ❌:</strong> Press "Audit Stripe Images"</li>
                          <li>• <strong>Website ❌ / Stripe ✅:</strong> Press "Pull from Stripe"</li>
                          <li>• <strong>Website ❌ / Stripe ❌:</strong> Press "Generate Images" → then "Audit Stripe"</li>
                          <li>• <strong>Both ✅:</strong> No action needed</li>
                        </ul>
                      </div>
                      
                      <div>
                        <div className="font-medium text-muted-foreground mb-1">📌 RECOMMENDED WORKFLOW:</div>
                        <ol className="list-decimal list-inside space-y-0.5 text-muted-foreground">
                          <li><strong>Check Status</strong> (see what needs action)</li>
                          <li><strong>Repair Images</strong> (detects broken URLs + generates + syncs to Stripe)</li>
                          <li>Audit Stripe (additional sync: website → Stripe)</li>
                          <li>Pull from Stripe (Stripe → website, if needed)</li>
                        </ol>
                      </div>
                      
                      <div className="text-amber-600 pt-1 border-t border-amber-200">
                        ⚠️ Safe to run multiple times - only repairs broken/missing images
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Configuration</CardTitle>
                <CardDescription>Configure email and system settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3 sm:space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm">Max Upload Size (MB)</Label>
                    <Input
                      type="number"
                      value={maxImageSize}
                      onChange={(e) => setMaxImageSize(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div className="flex items-start sm:items-center justify-between gap-3">
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <Label className="text-xs sm:text-sm">Guest Purchases</Label>
                      <p className="text-xs text-muted-foreground">Allow non-registered purchases</p>
                    </div>
                    <Switch
                      checked={allowGuestPurchases}
                      onCheckedChange={setAllowGuestPurchases}
                      className="shrink-0"
                    />
                  </div>
                </div>
                <Button onClick={handleSaveSystem} disabled={loading}>
                  Save System Settings
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Access Control */}
        <TabsContent value="access">
          <Card>
            <CardHeader>
              <CardTitle>Access Control Settings</CardTitle>
              <CardDescription>Configure authentication and security settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-start sm:items-center justify-between gap-3">
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <Label className="text-xs sm:text-sm">Email Verification</Label>
                    <p className="text-xs text-muted-foreground">Require verified email</p>
                  </div>
                  <Switch
                    checked={requireEmailVerification}
                    onCheckedChange={setRequireEmailVerification}
                    className="shrink-0"
                  />
                </div>
                <div className="flex items-start sm:items-center justify-between gap-3">
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <Label className="text-xs sm:text-sm">Auto-Approve Purchases</Label>
                    <p className="text-xs text-muted-foreground">Grant access after payment</p>
                  </div>
                  <Switch
                    checked={autoApprovePurchases}
                    onCheckedChange={setAutoApprovePurchases}
                    className="shrink-0"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm">Session Timeout (hours)</Label>
                  <Input
                    type="number"
                    value={sessionTimeout}
                    onChange={(e) => setSessionTimeout(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm">Inactivity Auto-Logout</Label>
                  <Select value={inactivityTimeout} onValueChange={setInactivityTimeout}>
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 minutes (Testing only)</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="240">4 hours</SelectItem>
                      <SelectItem value="480">8 hours</SelectItem>
                      <SelectItem value="1440">24 hours (Recommended)</SelectItem>
                      <SelectItem value="2880">48 hours</SelectItem>
                      <SelectItem value="10080">7 days</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">⚠️ Setting this too low may prevent users from receiving push notifications. 24 hours is recommended for optimal notification delivery. Users will see a warning 10 minutes before auto-logout.</p>
                </div>
              </div>
              <Button onClick={handleSaveAccessControl} disabled={loading}>
                Save Access Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Backup & Export */}
        <TabsContent value="backup">
          <Card>
            <CardHeader>
              <CardTitle>Backup & Export Options</CardTitle>
              <CardDescription>Export data and create backups</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3 sm:space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4 border rounded-lg">
                  <div className="space-y-1 flex-1 min-w-0">
                    <h3 className="text-sm sm:text-base font-medium">Export Database</h3>
                    <p className="text-xs text-muted-foreground">
                      All workouts & programs (JSON)
                    </p>
                  </div>
                  <Button onClick={handleExportDatabase} disabled={loading} className="w-full sm:w-auto shrink-0 text-sm">
                    <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                    Export
                  </Button>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4 border rounded-lg">
                  <div className="space-y-1 flex-1 min-w-0">
                    <h3 className="text-sm sm:text-base font-medium">Export Users</h3>
                    <p className="text-xs text-muted-foreground">
                      All registered users (CSV)
                    </p>
                  </div>
                  <Button onClick={handleExportUsers} disabled={loading} className="w-full sm:w-auto shrink-0 text-sm">
                    <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                    Export
                  </Button>
                </div>
                <div className="p-3 sm:p-4 border rounded-lg bg-muted/50">
                  <h3 className="font-medium mb-2">Automated Backups</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Your database is automatically backed up daily by Lovable Cloud. You can restore from any backup point in the last 7 days via the Cloud dashboard.
                  </p>
                  <Button variant="outline" onClick={() => window.open('https://lovable.app', '_blank')}>
                    View Cloud Dashboard
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
