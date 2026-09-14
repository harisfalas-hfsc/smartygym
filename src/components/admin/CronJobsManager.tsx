import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, Play, Pencil, Trash2, Plus, RefreshCw, AlertCircle, CheckCircle, Zap, Info, Power, PowerOff, AlertTriangle, Link2Off, Link2, Snowflake } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CronTimeInput } from "./CronTimeInput";
import { CronIntervalInput } from "./CronIntervalInput";
import { BuildVersionIndicator } from "./BuildVersionIndicator";
import { getCyprusOffset, cyprusToUtc, utcToCyprus } from "@/lib/cyprusDate";

interface CronJobMetadata {
  id: string;
  job_name: string;
  display_name: string;
  description: string | null;
  category: string | null;
  edge_function_name: string | null;
  request_body: unknown;
  is_critical: boolean | null;
  is_active: boolean | null;
  schedule: string | null;
  schedule_human_readable: string | null;
  timezone: string | null;
  next_run_estimate: string | null;
  created_at: string;
  updated_at: string;
  // Enriched fields from scheduler
  scheduler_schedule?: string | null;
  scheduler_active?: boolean | null;
  in_scheduler?: boolean;
  schedule_mismatch?: boolean;
  is_orphan?: boolean;
}

const CATEGORIES = [
  { value: 'content_generation', label: 'Content Generation', color: 'bg-purple-500' },
  { value: 'notifications', label: 'Notifications', color: 'bg-blue-500' },
  { value: 'maintenance', label: 'Maintenance', color: 'bg-orange-500' },
  { value: 'general', label: 'General', color: 'bg-gray-500' }
];

const AVAILABLE_FUNCTIONS = [
  'select-wod-from-library',
  'assign-daily-ritual',
  'generate-weekly-blog-articles',
  'send-scheduled-notifications',
  'send-scheduled-emails',
  'send-automated-messages',
  'send-workout-reminders',
  'send-checkin-reminders',
  'run-system-health-audit',
  'archive-old-wods',
  'verify-wod-rollover',
  'watchdog-wod-check',
  'refresh-seo-metadata',
  'process-pending-notifications'
];

// Schedule builder options - Cyprus time (UTC+2 in winter, UTC+3 in summer)
const FREQUENCY_OPTIONS = [
  { value: 'every_x_minutes', label: 'Every X minutes' },
  { value: 'hourly', label: 'Every hour' },
  { value: 'daily', label: 'Daily at specific time' },
  { value: 'weekly', label: 'Weekly on specific day' },
  { value: 'monthly', label: 'Monthly on specific day' }
];

const MINUTE_OPTIONS = [0, 5, 10, 15, 20, 30, 45];
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i);
const DAY_OF_WEEK_OPTIONS = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' }
];
const DAY_OF_MONTH_OPTIONS = Array.from({ length: 28 }, (_, i) => i + 1);
const INTERVAL_MINUTES = [1, 5, 10, 15, 30];

// Build cron expression from visual picker
const buildCronExpression = (
  frequency: string,
  minute: number,
  cyprusHour: number,
  dayOfWeek: string,
  dayOfMonth: number,
  intervalMinutes: number
): string => {
  const utcHour = cyprusToUtc(cyprusHour);
  
  switch (frequency) {
    case 'every_x_minutes':
      return `*/${intervalMinutes} * * * *`;
    case 'hourly':
      return `${minute} * * * *`;
    case 'daily':
      return `${minute} ${utcHour} * * *`;
    case 'weekly':
      return `${minute} ${utcHour} * * ${dayOfWeek}`;
    case 'monthly':
      return `${minute} ${utcHour} ${dayOfMonth} * *`;
    default:
      return '0 9 * * *';
  }
};

// Parse cron expression to visual picker values
const parseCronExpression = (cron: string): {
  frequency: string;
  minute: number;
  cyprusHour: number;
  dayOfWeek: string;
  dayOfMonth: number;
  intervalMinutes: number;
} => {
  const parts = cron.split(' ');
  if (parts.length !== 5) {
    return { frequency: 'daily', minute: 0, cyprusHour: 9, dayOfWeek: '1', dayOfMonth: 1, intervalMinutes: 10 };
  }
  
  const [min, hour, dom, , dow] = parts;
  
  // Every X minutes
  if (min.startsWith('*/') && hour === '*') {
    return {
      frequency: 'every_x_minutes',
      minute: 0,
      cyprusHour: 9,
      dayOfWeek: '1',
      dayOfMonth: 1,
      intervalMinutes: parseInt(min.replace('*/', '')) || 10
    };
  }
  
  // Hourly
  if (hour === '*' && !min.includes('*')) {
    return {
      frequency: 'hourly',
      minute: parseInt(min) || 0,
      cyprusHour: 9,
      dayOfWeek: '1',
      dayOfMonth: 1,
      intervalMinutes: 10
    };
  }
  
  const utcHour = parseInt(hour) || 0;
  const cyprusHour = utcToCyprus(utcHour);
  const minuteVal = parseInt(min) || 0;
  
  // Weekly
  if (dom === '*' && dow !== '*') {
    return {
      frequency: 'weekly',
      minute: minuteVal,
      cyprusHour,
      dayOfWeek: dow,
      dayOfMonth: 1,
      intervalMinutes: 10
    };
  }
  
  // Monthly
  if (dom !== '*' && dow === '*') {
    return {
      frequency: 'monthly',
      minute: minuteVal,
      cyprusHour,
      dayOfWeek: '1',
      dayOfMonth: parseInt(dom) || 1,
      intervalMinutes: 10
    };
  }
  
  // Daily
  return {
    frequency: 'daily',
    minute: minuteVal,
    cyprusHour,
    dayOfWeek: '1',
    dayOfMonth: 1,
    intervalMinutes: 10
  };
};

// Generate human-readable schedule description
const getSchedulePreview = (
  frequency: string,
  minute: number,
  cyprusHour: number,
  dayOfWeek: string,
  dayOfMonth: number,
  intervalMinutes: number
): string => {
  const cyprusOffset = getCyprusOffset();
  const offsetLabel = `UTC+${cyprusOffset}`;
  const timeStr = `${cyprusHour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  const utcHour = cyprusToUtc(cyprusHour);
  const utcTimeStr = `${utcHour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  
  switch (frequency) {
    case 'every_x_minutes':
      return `Every ${intervalMinutes} minutes`;
    case 'hourly':
      return `Every hour at :${minute.toString().padStart(2, '0')}`;
    case 'daily':
      return `Daily at ${timeStr} Cyprus time (${utcTimeStr} UTC, ${offsetLabel})`;
    case 'weekly':
      const dayName = DAY_OF_WEEK_OPTIONS.find(d => d.value === dayOfWeek)?.label || dayOfWeek;
      return `Every ${dayName} at ${timeStr} Cyprus time (${utcTimeStr} UTC, ${offsetLabel})`;
    case 'monthly':
      return `Monthly on day ${dayOfMonth} at ${timeStr} Cyprus time (${utcTimeStr} UTC, ${offsetLabel})`;
    default:
      return 'Unknown schedule';
  }
};

export function CronJobsManager() {
  const [jobs, setJobs] = useState<CronJobMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<CronJobMetadata | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [cronEnabled, setCronEnabled] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [orphanJobs, setOrphanJobs] = useState<CronJobMetadata[]>([]);
  // Global freeze state
  const [frozen, setFrozen] = useState(false);
  const [frozenAt, setFrozenAt] = useState<string | null>(null);
  const [frozenCount, setFrozenCount] = useState(0);
  const [freezing, setFreezing] = useState(false);
  const [showFreezeConfirm, setShowFreezeConfirm] = useState(false);
  // Edit form state
  const [editForm, setEditForm] = useState({
    display_name: '',
    description: '',
    category: 'general',
    is_critical: false,
    is_active: true,
    frequency: 'daily',
    minute: 0,
    cyprusHour: 9,
    dayOfWeek: '1',
    dayOfMonth: 1,
    intervalMinutes: 10
  });

  // Add form state
  const [addForm, setAddForm] = useState({
    job_name: '',
    display_name: '',
    description: '',
    category: 'general',
    edge_function_name: '',
    is_critical: false,
    frequency: 'daily',
    minute: 0,
    cyprusHour: 9,
    dayOfWeek: '1',
    dayOfMonth: 1,
    intervalMinutes: 10
  });

  useEffect(() => {
    fetchJobs();
    checkCronEnabled();
    fetchFreezeStatus();
  }, []);

  const fetchFreezeStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-cron-jobs', {
        body: { action: 'freeze_status' }
      });
      if (error) throw error;
      setFrozen(!!data?.frozen);
      setFrozenAt(data?.frozen_at || null);
      setFrozenCount(Array.isArray(data?.snapshot_jobs) ? data.snapshot_jobs.length : 0);
    } catch (e) {
      console.log("freeze status check failed:", e);
    }
  };

  const toggleFreeze = async () => {
    const next = frozen ? 'unfreeze' : 'freeze';
    setFreezing(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-cron-jobs', {
        body: { action: next }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setFrozen(!!data?.frozen);
      setFrozenAt(data?.frozen_at || null);
      setFrozenCount(Array.isArray(data?.jobs) ? data.jobs.length : 0);
      toast.success(data?.message || (next === 'freeze' ? 'System frozen' : 'System unfrozen'));
      await fetchFreezeStatus();
      await fetchJobs();
    } catch (e) {
      toast.error(`Failed to ${next}: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setFreezing(false);
      setShowFreezeConfirm(false);
    }
  };

  const checkCronEnabled = async () => {
    try {
      const { data, error } = await supabase.rpc('pg_cron_enabled');
      if (!error && data) {
        setCronEnabled(true);
      }
    } catch (e) {
      console.log("pg_cron check failed:", e);
    }
  };


  const fetchJobs = async () => {
    setLoading(true);
    try {
      // Use edge function to get enriched job data including scheduler info
      const { data, error } = await supabase.functions.invoke('manage-cron-jobs', {
        body: { action: 'list' }
      });

      if (error) throw error;
      
      if (data?.jobs) {
        setJobs(data.jobs as CronJobMetadata[]);
      }
      if (data?.orphan_scheduler_jobs) {
        setOrphanJobs(data.orphan_scheduler_jobs as CronJobMetadata[]);
      }
    } catch (error: any) {
      console.error("Failed to fetch cron jobs:", error);
      // Fallback to direct table query
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('cron_job_metadata')
        .select('*')
        .order('category', { ascending: true })
        .order('display_name', { ascending: true });

      if (!fallbackError && fallbackData) {
        setJobs(fallbackData as CronJobMetadata[]);
      } else {
        toast.error("Failed to load cron jobs");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSyncJob = async (job: CronJobMetadata) => {
    setSyncing(true);
    try {
      // Re-create the scheduler job from metadata
      const { data, error } = await supabase.functions.invoke('manage-cron-jobs', {
        body: {
          action: 'add',
          job_name: job.job_name,
          display_name: job.display_name,
          description: job.description,
          category: job.category,
          schedule: job.schedule,
          schedule_human_readable: job.schedule_human_readable,
          edge_function_name: job.edge_function_name,
          request_body: job.request_body,
          is_critical: job.is_critical,
        }
      });

      if (error) throw error;
      
      toast.success(`✅ ${job.display_name} synced to scheduler`);
      fetchJobs();
    } catch (error: any) {
      toast.error(`Sync failed: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleTest = async (job: CronJobMetadata) => {
    if (!job.edge_function_name) {
      toast.error("No edge function configured for this job");
      return;
    }
    
    setTesting(job.job_name);
    try {
      const { error } = await supabase.functions.invoke(job.edge_function_name, {
        body: job.request_body || {}
      });

      if (error) throw error;
      toast.success(`✅ ${job.display_name} executed successfully - this was a one-time test, schedule unchanged`);
    } catch (error: any) {
      toast.error(`Test failed: ${error.message}`);
    } finally {
      setTesting(null);
    }
  };

  const handleDelete = async () => {
    if (!selectedJob) return;
    
    setSaving(true);
    try {
      // Call edge function to unschedule AND delete
      const { data, error } = await supabase.functions.invoke('manage-cron-jobs', {
        body: {
          action: 'delete',
          job_name: selectedJob.job_name
        }
      });

      if (error) throw error;
      
      toast.success("✅ Cron job stopped and removed from the system");
      setShowDeleteConfirm(false);
      setSelectedJob(null);
      fetchJobs();
    } catch (error: any) {
      toast.error(`Delete failed: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    if (!addForm.job_name || !addForm.edge_function_name) {
      toast.error("Please fill in required fields (Job Name and Edge Function)");
      return;
    }

    setSaving(true);
    try {
      const schedule = buildCronExpression(
        addForm.frequency,
        addForm.minute,
        addForm.cyprusHour,
        addForm.dayOfWeek,
        addForm.dayOfMonth,
        addForm.intervalMinutes
      );
      
      const humanReadable = getSchedulePreview(
        addForm.frequency,
        addForm.minute,
        addForm.cyprusHour,
        addForm.dayOfWeek,
        addForm.dayOfMonth,
        addForm.intervalMinutes
      );

      const { data, error } = await supabase.functions.invoke('manage-cron-jobs', {
        body: {
          action: 'add',
          job_name: addForm.job_name.toLowerCase().replace(/\s+/g, '-'),
          display_name: addForm.display_name || addForm.job_name,
          description: addForm.description,
          category: addForm.category,
          edge_function_name: addForm.edge_function_name,
          schedule,
          schedule_human_readable: humanReadable,
          is_critical: addForm.is_critical,
          is_active: true
        }
      });

      if (error) throw error;

      toast.success("✅ Cron job created and scheduled!");
      
      setShowAddDialog(false);
      setAddForm({
        job_name: '',
        display_name: '',
        description: '',
        category: 'general',
        edge_function_name: '',
        is_critical: false,
        frequency: 'daily',
        minute: 0,
        cyprusHour: 9,
        dayOfWeek: '1',
        dayOfMonth: 1,
        intervalMinutes: 10
      });
      fetchJobs();
    } catch (error: any) {
      toast.error(`Add failed: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleEditSave = async () => {
    if (!selectedJob) return;

    setSaving(true);
    try {
      const schedule = buildCronExpression(
        editForm.frequency,
        editForm.minute,
        editForm.cyprusHour,
        editForm.dayOfWeek,
        editForm.dayOfMonth,
        editForm.intervalMinutes
      );
      
      const humanReadable = getSchedulePreview(
        editForm.frequency,
        editForm.minute,
        editForm.cyprusHour,
        editForm.dayOfWeek,
        editForm.dayOfMonth,
        editForm.intervalMinutes
      );

      const { data, error } = await supabase.functions.invoke('manage-cron-jobs', {
        body: {
          action: 'edit',
          job_name: selectedJob.job_name,
          display_name: editForm.display_name,
          description: editForm.description,
          category: editForm.category,
          schedule,
          schedule_human_readable: humanReadable,
          is_critical: editForm.is_critical,
          is_active: editForm.is_active
        }
      });

      if (error) throw error;
      
      toast.success("✅ Cron job updated and rescheduled!");
      setShowEditDialog(false);
      fetchJobs();
    } catch (error: any) {
      toast.error(`Update failed: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const openEditDialog = (job: CronJobMetadata) => {
    setSelectedJob(job);
    
    // Parse existing schedule or use defaults
    const parsed = job.schedule 
      ? parseCronExpression(job.schedule)
      : { frequency: 'daily', minute: 0, cyprusHour: 9, dayOfWeek: '1', dayOfMonth: 1, intervalMinutes: 10 };
    
    setEditForm({
      display_name: job.display_name,
      description: job.description || '',
      category: job.category || 'general',
      is_critical: job.is_critical || false,
      is_active: job.is_active !== false,
      ...parsed
    });
    
    setShowEditDialog(true);
  };

  const getCategoryBadge = (category: string | null) => {
    const cat = CATEGORIES.find(c => c.value === category) || CATEGORIES[3];
    return <Badge className={`${cat.color} text-white`}>{cat.label}</Badge>;
  };

  const groupedJobs = jobs.reduce((acc, job) => {
    const cat = job.category || 'general';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(job);
    return acc;
  }, {} as Record<string, CronJobMetadata[]>);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="h-6 w-6" />
            Cron Jobs Manager
          </h2>
          <p className="text-muted-foreground">
            Manage scheduled tasks and automated functions
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <BuildVersionIndicator />
          <Button
            variant={frozen ? "default" : "destructive"}
            onClick={() => setShowFreezeConfirm(true)}
            disabled={freezing}
            aria-label={frozen ? "Unfreeze System" : "Freeze System"}
          >
            {freezing
              ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              : frozen ? <Power className="h-4 w-4 mr-2" /> : <Snowflake className="h-4 w-4 mr-2" />}
            {frozen ? "Unfreeze System" : "Freeze System"}
          </Button>
          <Button variant="outline" onClick={fetchJobs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Cron Job
          </Button>
        </div>
      </div>

      {/* Frozen banner */}
      {frozen && (
        <Alert variant="destructive">
          <Snowflake className="h-4 w-4" />
          <AlertTitle>System Frozen — nothing is running in the background</AlertTitle>
          <AlertDescription>
            {frozenCount} scheduled job{frozenCount === 1 ? '' : 's'} paused
            {frozenAt ? ` since ${new Date(frozenAt).toLocaleString()}` : ''}. Automated emails and
            notifications are blocked too. Press <strong>Unfreeze System</strong> to restore exactly
            the same jobs that were running before.
          </AlertDescription>
        </Alert>
      )}

      {/* Freeze / Unfreeze confirmation */}
      <Dialog open={showFreezeConfirm} onOpenChange={setShowFreezeConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{frozen ? "Unfreeze the system?" : "Freeze the system?"}</DialogTitle>
            <DialogDescription>
              {frozen
                ? `This restores the ${frozenCount} scheduled job${frozenCount === 1 ? '' : 's'} that were running when you froze the system. Jobs that were already off stay off.`
                : "This saves a snapshot of every job that is running right now, pauses all of them, and blocks automated emails and notifications. Nothing is deleted — unfreeze restores the exact same setup."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFreezeConfirm(false)} disabled={freezing}>
              Cancel
            </Button>
            <Button
              variant={frozen ? "default" : "destructive"}
              onClick={toggleFreeze}
              disabled={freezing}
            >
              {freezing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
              {frozen ? "Unfreeze" : "Freeze everything"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Status Alert */}
      <Alert variant={cronEnabled ? "default" : "destructive"}>
        {cronEnabled ? (
          <CheckCircle className="h-4 w-4" />
        ) : (
          <AlertCircle className="h-4 w-4" />
        )}
        <AlertTitle>
          {cronEnabled ? "Cron Engine Active" : "Cron Engine Status Unknown"}
        </AlertTitle>
        <AlertDescription>
          {cronEnabled 
            ? "Scheduled jobs run automatically. Times shown in Cyprus timezone (UTC+3)."
            : "Could not verify cron status. Jobs may need manual SQL scheduling."}
        </AlertDescription>
      </Alert>

      {/* Jobs by Category */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">All Jobs ({jobs.length})</TabsTrigger>
          {CATEGORIES.map(cat => {
            const count = groupedJobs[cat.value]?.length || 0;
            if (count === 0) return null;
            return (
              <TabsTrigger key={cat.value} value={cat.value}>
                {cat.label} ({count})
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <div className="grid gap-4">
            {jobs.map(job => (
              <JobCard 
                key={job.job_name}
                job={job}
                testing={testing}
                syncing={syncing}
                onView={() => { setSelectedJob(job); setShowDetailsDialog(true); }}
                onEdit={() => openEditDialog(job)}
                onDelete={() => { setSelectedJob(job); setShowDeleteConfirm(true); }}
                onTest={() => handleTest(job)}
                onSync={() => handleSyncJob(job)}
                getCategoryBadge={getCategoryBadge}
              />
            ))}
          </div>
        </TabsContent>

        {CATEGORIES.map(cat => (
          <TabsContent key={cat.value} value={cat.value} className="mt-4">
            <div className="grid gap-4">
              {(groupedJobs[cat.value] || []).map(job => (
                <JobCard 
                  key={job.job_name}
                  job={job}
                  testing={testing}
                  syncing={syncing}
                  onView={() => { setSelectedJob(job); setShowDetailsDialog(true); }}
                  onEdit={() => openEditDialog(job)}
                  onDelete={() => { setSelectedJob(job); setShowDeleteConfirm(true); }}
                  onTest={() => handleTest(job)}
                  onSync={() => handleSyncJob(job)}
                  getCategoryBadge={getCategoryBadge}
                />
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* View Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              {selectedJob?.display_name}
            </DialogTitle>
            <DialogDescription>
              Complete job details and schedule information
            </DialogDescription>
          </DialogHeader>
          {selectedJob && (
            <div className="space-y-6">
              {/* Schedule - Most Important Info */}
              <div className="bg-primary/10 p-4 rounded-lg border border-primary/20">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-lg">Schedule</span>
                </div>
                <p className="text-xl font-medium">
                  {selectedJob.schedule_human_readable || 'Not scheduled'}
                </p>
                {selectedJob.schedule && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Cron: <code className="bg-muted px-1 rounded">{selectedJob.schedule}</code>
                  </p>
                )}
              </div>

              {/* Status */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {selectedJob.is_active !== false ? (
                    <>
                      <Power className="h-5 w-5 text-green-500" />
                      <span className="font-medium text-green-600">Active</span>
                    </>
                  ) : (
                    <>
                      <PowerOff className="h-5 w-5 text-red-500" />
                      <span className="font-medium text-red-600">Paused</span>
                    </>
                  )}
                </div>
                {selectedJob.is_critical && (
                  <Badge variant="outline" className="border-red-500 text-red-500">
                    <Zap className="h-3 w-3 mr-1" />
                    Critical - Alerts on failure
                  </Badge>
                )}
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-sm">Category</Label>
                  <div className="mt-1">{getCategoryBadge(selectedJob.category)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm">Edge Function</Label>
                  <p className="font-mono text-sm mt-1">{selectedJob.edge_function_name || 'Not configured'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm">Job ID</Label>
                  <p className="font-mono text-sm mt-1">{selectedJob.job_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm">Last Updated</Label>
                  <p className="text-sm mt-1">
                    {new Date(selectedJob.updated_at).toLocaleString('en-CY', { 
                      timeZone: 'Europe/Nicosia',
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })} Cyprus
                  </p>
                </div>
              </div>

              {/* Description */}
              <div>
                <Label className="text-muted-foreground text-sm">What this job does</Label>
                <p className="mt-1">{selectedJob.description || 'No description provided'}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
              Close
            </Button>
            <Button onClick={() => { setShowDetailsDialog(false); selectedJob && openEditDialog(selectedJob); }}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog with Visual Schedule Builder */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Cron Job</DialogTitle>
            <DialogDescription>
              Update schedule and job settings for "{selectedJob?.display_name}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
            {/* Active Toggle */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                {editForm.is_active ? (
                  <Power className="h-5 w-5 text-green-500" />
                ) : (
                  <PowerOff className="h-5 w-5 text-red-500" />
                )}
                <span className="font-medium">Job Status</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {editForm.is_active ? 'Active' : 'Paused'}
                </span>
                <Switch 
                  checked={editForm.is_active}
                  onCheckedChange={(v) => setEditForm({...editForm, is_active: v})}
                />
              </div>
            </div>

            {/* Schedule Builder */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">Schedule</Label>
              
              {/* Frequency */}
              <div>
                <Label className="text-sm">Frequency</Label>
                <Select 
                  value={editForm.frequency}
                  onValueChange={(v) => setEditForm({...editForm, frequency: v})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent side="bottom" align="start">
                    {FREQUENCY_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Interval (for every_x_minutes) */}
              {editForm.frequency === 'every_x_minutes' && (
                <CronIntervalInput
                  value={editForm.intervalMinutes}
                  onChange={(v) => setEditForm({...editForm, intervalMinutes: v})}
                  min={1}
                  max={60}
                  step={5}
                  label="Run every"
                  suffix="minutes"
                />
              )}

              {/* Time Picker (for hourly - just minute) */}
              {editForm.frequency === 'hourly' && (
                <CronIntervalInput
                  value={editForm.minute}
                  onChange={(v) => setEditForm({...editForm, minute: v})}
                  min={0}
                  max={59}
                  step={5}
                  label="At minute"
                  suffix=""
                />
              )}

              {/* Time Picker (for daily/weekly/monthly) */}
              {['daily', 'weekly', 'monthly'].includes(editForm.frequency) && (
                <CronTimeInput
                  hour={editForm.cyprusHour}
                  minute={editForm.minute}
                  onHourChange={(h) => setEditForm({...editForm, cyprusHour: h})}
                  onMinuteChange={(m) => setEditForm({...editForm, minute: m})}
                  label="Time (Cyprus timezone)"
                  showTimezonePreview={true}
                />
              )}

              {/* Day of Week (for weekly) */}
              {editForm.frequency === 'weekly' && (
                <div>
                  <Label className="text-sm">Day of week</Label>
                  <Select 
                    value={editForm.dayOfWeek}
                    onValueChange={(v) => setEditForm({...editForm, dayOfWeek: v})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent side="bottom" align="start">
                      {DAY_OF_WEEK_OPTIONS.map(d => (
                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Day of Month (for monthly) */}
              {editForm.frequency === 'monthly' && (
                <div>
                  <Label className="text-sm">Day of month</Label>
                  <Select 
                    value={editForm.dayOfMonth.toString()}
                    onValueChange={(v) => setEditForm({...editForm, dayOfMonth: parseInt(v)})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent side="bottom" align="start">
                      {DAY_OF_MONTH_OPTIONS.map(d => (
                        <SelectItem key={d} value={d.toString()}>Day {d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Live Preview */}
              <Alert className="bg-primary/10 border-primary/20">
                <Clock className="h-4 w-4" />
                <AlertTitle>Schedule Preview</AlertTitle>
                <AlertDescription className="font-medium">
                  {getSchedulePreview(
                    editForm.frequency,
                    editForm.minute,
                    editForm.cyprusHour,
                    editForm.dayOfWeek,
                    editForm.dayOfMonth,
                    editForm.intervalMinutes
                  )}
                </AlertDescription>
              </Alert>
            </div>

            {/* Other Fields */}
            <div className="space-y-4 pt-4 border-t">
              <div>
                <Label>Display Name</Label>
                <Input 
                  value={editForm.display_name}
                  onChange={(e) => setEditForm({...editForm, display_name: e.target.value})}
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea 
                  value={editForm.description}
                  onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                  rows={2}
                  placeholder="What does this job do?"
                />
              </div>
              <div>
                <Label>Category</Label>
                <Select 
                  value={editForm.category}
                  onValueChange={(v) => setEditForm({...editForm, category: v})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch 
                  checked={editForm.is_critical}
                  onCheckedChange={(v) => setEditForm({...editForm, is_critical: v})}
                />
                <Label>Critical job (alerts admin on failure)</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={saving}>
              {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save & Reschedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Dialog with Visual Schedule Builder */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Cron Job</DialogTitle>
            <DialogDescription>
              Create a new scheduled task
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <Label>Job Name *</Label>
                <Input 
                  value={addForm.job_name}
                  onChange={(e) => setAddForm({...addForm, job_name: e.target.value})}
                  placeholder="e.g., my-custom-job"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Will be converted to lowercase with hyphens
                </p>
              </div>
              <div>
                <Label>Display Name</Label>
                <Input 
                  value={addForm.display_name}
                  onChange={(e) => setAddForm({...addForm, display_name: e.target.value})}
                  placeholder="e.g., My Custom Job"
                />
              </div>
              <div>
                <Label>Edge Function *</Label>
                <Select 
                  value={addForm.edge_function_name}
                  onValueChange={(v) => setAddForm({...addForm, edge_function_name: v})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select function..." />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_FUNCTIONS.map(fn => (
                      <SelectItem key={fn} value={fn}>{fn}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Schedule Builder */}
            <div className="space-y-4 pt-4 border-t">
              <Label className="text-base font-semibold">Schedule</Label>
              
              <div>
                <Label className="text-sm">Frequency</Label>
                <Select 
                  value={addForm.frequency}
                  onValueChange={(v) => setAddForm({...addForm, frequency: v})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent side="bottom" align="start">
                    {FREQUENCY_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {addForm.frequency === 'every_x_minutes' && (
                <CronIntervalInput
                  value={addForm.intervalMinutes}
                  onChange={(v) => setAddForm({...addForm, intervalMinutes: v})}
                  min={1}
                  max={60}
                  step={5}
                  label="Run every"
                  suffix="minutes"
                />
              )}

              {addForm.frequency === 'hourly' && (
                <CronIntervalInput
                  value={addForm.minute}
                  onChange={(v) => setAddForm({...addForm, minute: v})}
                  min={0}
                  max={59}
                  step={5}
                  label="At minute"
                  suffix=""
                />
              )}

              {['daily', 'weekly', 'monthly'].includes(addForm.frequency) && (
                <CronTimeInput
                  hour={addForm.cyprusHour}
                  minute={addForm.minute}
                  onHourChange={(h) => setAddForm({...addForm, cyprusHour: h})}
                  onMinuteChange={(m) => setAddForm({...addForm, minute: m})}
                  label="Time (Cyprus timezone)"
                  showTimezonePreview={true}
                />
              )}

              {addForm.frequency === 'weekly' && (
                <div>
                  <Label className="text-sm">Day of week</Label>
                  <Select 
                    value={addForm.dayOfWeek}
                    onValueChange={(v) => setAddForm({...addForm, dayOfWeek: v})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent side="bottom" align="start">
                      {DAY_OF_WEEK_OPTIONS.map(d => (
                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {addForm.frequency === 'monthly' && (
                <div>
                  <Label className="text-sm">Day of month</Label>
                  <Select 
                    value={addForm.dayOfMonth.toString()}
                    onValueChange={(v) => setAddForm({...addForm, dayOfMonth: parseInt(v)})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent side="bottom" align="start">
                      {DAY_OF_MONTH_OPTIONS.map(d => (
                        <SelectItem key={d} value={d.toString()}>Day {d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Alert className="bg-primary/10 border-primary/20">
                <Clock className="h-4 w-4" />
                <AlertTitle>Schedule Preview</AlertTitle>
                <AlertDescription className="font-medium">
                  {getSchedulePreview(
                    addForm.frequency,
                    addForm.minute,
                    addForm.cyprusHour,
                    addForm.dayOfWeek,
                    addForm.dayOfMonth,
                    addForm.intervalMinutes
                  )}
                </AlertDescription>
              </Alert>
            </div>

            {/* Additional Fields */}
            <div className="space-y-4 pt-4 border-t">
              <div>
                <Label>Category</Label>
                <Select 
                  value={addForm.category}
                  onValueChange={(v) => setAddForm({...addForm, category: v})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent side="bottom" align="start">
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea 
                  value={addForm.description}
                  onChange={(e) => setAddForm({...addForm, description: e.target.value})}
                  placeholder="What does this job do?"
                  rows={2}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch 
                  checked={addForm.is_critical}
                  onCheckedChange={(v) => setAddForm({...addForm, is_critical: v})}
                />
                <Label>Critical job</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={saving}>
              {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Create Job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Stop and Delete Cron Job?
            </DialogTitle>
            <DialogDescription className="pt-2">
              This will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li><strong>Stop</strong> the scheduled job from running</li>
                <li><strong>Remove</strong> "{selectedJob?.display_name}" completely from the system</li>
              </ul>
              <p className="mt-3 text-destructive font-medium">This action cannot be undone.</p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Stop & Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Job Card Component
function JobCard({ 
  job, 
  testing, 
  syncing,
  onView, 
  onEdit, 
  onDelete, 
  onTest,
  onSync,
  getCategoryBadge 
}: {
  job: CronJobMetadata;
  testing: string | null;
  syncing?: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => void;
  onSync?: () => void;
  getCategoryBadge: (cat: string | null) => JSX.Element;
}) {
  const showSyncButton = job.in_scheduler === false && onSync;
  const hasMismatch = job.schedule_mismatch === true;

  return (
    <Card className={`hover:shadow-md transition-shadow ${job.is_active === false ? 'opacity-60' : ''}`}>
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold truncate">{job.display_name}</h3>
              {getCategoryBadge(job.category)}
              {job.is_critical && (
                <Badge variant="outline" className="border-red-500 text-red-500">
                  <Zap className="h-3 w-3 mr-1" />
                  Critical
                </Badge>
              )}
              {job.is_active === false && (
                <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                  <PowerOff className="h-3 w-3 mr-1" />
                  Paused
                </Badge>
              )}
              {/* Scheduler status badges */}
              {job.in_scheduler === false && (
                <Badge variant="outline" className="border-orange-500 text-orange-600">
                  <Link2Off className="h-3 w-3 mr-1" />
                  Not in scheduler
                </Badge>
              )}
              {job.in_scheduler === true && !hasMismatch && (
                <Badge variant="outline" className="border-green-500 text-green-600">
                  <Link2 className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              )}
              {hasMismatch && (
                <Badge variant="outline" className="border-red-500 text-red-600">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Schedule mismatch
                </Badge>
              )}
            </div>
            
            {/* Schedule Display - THE MOST IMPORTANT INFO */}
            <div className="flex items-center gap-2 mt-2 text-sm">
              <Clock className="h-4 w-4 text-primary" />
              <span className="font-medium text-primary">
                {job.schedule_human_readable || 'Not scheduled'}
              </span>
            </div>

            {/* Show mismatch details */}
            {hasMismatch && job.scheduler_schedule && (
              <div className="text-xs text-orange-600 mt-1">
                Scheduler has: <code className="bg-muted px-1 rounded">{job.scheduler_schedule}</code> 
                {' '}vs metadata: <code className="bg-muted px-1 rounded">{job.schedule}</code>
              </div>
            )}
            
            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
              {job.description || 'No description'}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {showSyncButton && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onSync}
                disabled={syncing}
                className="text-orange-600 border-orange-500 hover:bg-orange-50"
                title="Sync to scheduler"
              >
                {syncing ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onView} title="View Details">
              <Info className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onEdit} title="Edit Schedule">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onTest}
              disabled={testing === job.job_name}
              title="Test Now (runs once, schedule unchanged)"
            >
              {testing === job.job_name ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive hover:text-destructive" title="Stop & Delete">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
