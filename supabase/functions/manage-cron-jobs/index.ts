import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FREEZE_SETTING_KEY = 'background_frozen';
const FREEZE_SNAPSHOT_KEY = 'background_freeze_snapshot';
const RETIRED_WOD_FUNCTIONS = new Set([
  'generate-workout-of-day',
  'wod-generation-orchestrator',
  'backup-wod-generation',
]);
const RETIRED_WOD_JOBS = new Set([
  'generate-workout-of-day',
  'generate-workout-of-day-daily',
  'generate-workout-of-day-midnight',
  'generate-wod-daily',
  'generate-wod-bodyweight-daily',
  'generate-wod-equipment-daily',
  'wod-retry-pass-1',
  'wod-retry-pass-2',
  'wod-retry-pass-3',
  'wod-retry-pass-4',
  'watchdog-wod-check',
  'wod-post-generation-audit',
]);

interface CronJobRequest {
  action: 'list' | 'add' | 'edit' | 'delete' | 'test' | 'sync' | 'freeze' | 'unfreeze' | 'freeze_status';
  job_name?: string;
  display_name?: string;
  description?: string;
  category?: string;
  schedule?: string;
  schedule_human_readable?: string;
  edge_function_name?: string;
  request_body?: Record<string, unknown>;
  is_critical?: boolean;
  is_active?: boolean;
}

// ============================================
// SECURITY: Input Validation & Sanitization
// ============================================

/**
 * Validates job_name format to prevent SQL injection
 * Only allows alphanumeric characters, dashes, and underscores
 */
function validateJobName(jobName: string): { valid: boolean; error?: string } {
  if (!jobName || typeof jobName !== 'string') {
    return { valid: false, error: 'job_name is required and must be a string' };
  }
  if (jobName.length > 100) {
    return { valid: false, error: 'job_name must be 100 characters or less' };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(jobName)) {
    return { valid: false, error: 'job_name can only contain letters, numbers, dashes, and underscores' };
  }
  return { valid: true };
}

/**
 * Validates cron schedule format to prevent SQL injection
 * Only allows standard cron characters: digits, *, /, -, ,, and spaces
 */
function validateCronSchedule(schedule: string): { valid: boolean; error?: string } {
  if (!schedule || typeof schedule !== 'string') {
    return { valid: false, error: 'schedule is required and must be a string' };
  }
  if (schedule.length > 50) {
    return { valid: false, error: 'schedule must be 50 characters or less' };
  }
  // Standard cron format: minute hour day month weekday
  // Allowed chars: digits 0-9, *, /, -, ,, and spaces
  if (!/^[\d\*\/\-,\s]+$/.test(schedule)) {
    return { valid: false, error: 'schedule contains invalid characters. Only digits, *, /, -, , and spaces allowed' };
  }
  // Must have exactly 5 parts (standard cron format)
  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) {
    return { valid: false, error: 'schedule must be in standard cron format with 5 parts (minute hour day month weekday)' };
  }
  return { valid: true };
}

/**
 * Validates edge function name to prevent SQL injection
 * Only allows alphanumeric characters, dashes, and underscores
 */
function validateEdgeFunctionName(funcName: string): { valid: boolean; error?: string } {
  if (!funcName || typeof funcName !== 'string') {
    return { valid: false, error: 'edge_function_name is required and must be a string' };
  }
  if (funcName.length > 100) {
    return { valid: false, error: 'edge_function_name must be 100 characters or less' };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(funcName)) {
    return { valid: false, error: 'edge_function_name can only contain letters, numbers, dashes, and underscores' };
  }
  if (RETIRED_WOD_FUNCTIONS.has(funcName)) {
    return { valid: false, error: 'This retired Workout of the Day generator cannot be scheduled or invoked' };
  }
  return { valid: true };
}

function isRetiredWodJob(jobName: string): boolean {
  return RETIRED_WOD_JOBS.has(jobName);
}

/**
 * Escapes a string for safe use in SQL by doubling single quotes
 * This is a last-resort sanitization for values that must be interpolated
 */
function escapeSqlString(str: string): string {
  if (typeof str !== 'string') return '';
  return str.replace(/'/g, "''");
}

// Get Cyprus timezone offset (UTC+2 in winter, UTC+3 in summer)
function getCyprusOffset(): number {
  const now = new Date();
  const month = now.getUTCMonth() + 1; // 1-12
  const day = now.getUTCDate();
  
  // DST in Cyprus: Last Sunday of March to Last Sunday of October
  // Simplified: April-October = summer (UTC+3), November-March = winter (UTC+2)
  if (month >= 4 && month <= 10) {
    return 3; // Summer time (EEST)
  }
  return 2; // Winter time (EET)
}

// Convert cron expression to human-readable format with Cyprus time
function cronToHumanReadable(cron: string): string {
  const parts = cron.split(' ');
  if (parts.length !== 5) return cron;
  
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  const cyprusOffset = getCyprusOffset();
  const offsetLabel = cyprusOffset === 3 ? 'UTC+3' : 'UTC+2';
  
  // Every X minutes
  if (minute.startsWith('*/') && hour === '*') {
    const mins = minute.replace('*/', '');
    return `Every ${mins} minutes`;
  }
  
  // Every X hours
  if (minute !== '*' && hour.startsWith('*/')) {
    const hrs = hour.replace('*/', '');
    return `Every ${hrs} hours at :${minute.padStart(2, '0')}`;
  }
  
  // Daily at specific time
  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    const utcHour = parseInt(hour);
    const cyprusHour = (utcHour + cyprusOffset) % 24;
    const minStr = minute.padStart(2, '0');
    return `Daily at ${cyprusHour.toString().padStart(2, '0')}:${minStr} Cyprus (${hour}:${minStr} UTC, ${offsetLabel})`;
  }
  
  // Weekly
  if (dayOfMonth === '*' && month === '*' && dayOfWeek !== '*') {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayNum = parseInt(dayOfWeek);
    const utcHour = parseInt(hour);
    const cyprusHour = (utcHour + cyprusOffset) % 24;
    const minStr = minute.padStart(2, '0');
    return `Every ${days[dayNum]} at ${cyprusHour.toString().padStart(2, '0')}:${minStr} Cyprus (${hour}:${minStr} UTC)`;
  }
  
  // Monthly
  if (dayOfMonth !== '*' && month === '*' && dayOfWeek === '*') {
    const utcHour = parseInt(hour);
    const cyprusHour = (utcHour + cyprusOffset) % 24;
    const minStr = minute.padStart(2, '0');
    return `Monthly on day ${dayOfMonth} at ${cyprusHour.toString().padStart(2, '0')}:${minStr} Cyprus`;
  }
  
  return cron;
}

// Helper to execute SQL with proper error handling
async function executeCronSql(serviceClient: any, sql: string, operation: string): Promise<{ success: boolean; error?: string }> {
  console.log(`🔧 [${operation}] Executing SQL:`, sql.substring(0, 200) + '...');
  
  try {
    const { data, error } = await serviceClient.rpc('exec_sql', { sql });
    
    if (error) {
      console.error(`❌ [${operation}] exec_sql RPC error:`, error);
      return { success: false, error: `Database error: ${error.message}` };
    }
    
    console.log(`✅ [${operation}] SQL executed successfully`);
    return { success: true };
  } catch (e: any) {
    console.error(`❌ [${operation}] Exception:`, e);
    return { success: false, error: `Exception: ${e.message || 'Unknown error'}` };
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const cronAuthKey = supabaseServiceKey;
    
    // Create client with user's auth token
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader || "" } }
    });
    
    // Create service client for cron operations
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin role
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: roleData } = await serviceClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: CronJobRequest = await req.json();
    const { action } = body;

    console.log(`🔧 Cron job management: ${action}`, JSON.stringify(body, null, 2));

    // LIST - Get all cron jobs with metadata AND real scheduler jobs
    if (action === 'list') {
      // Pull the real last-run times / schedules from the live scheduler first,
      // so the panel never shows stale information.
      try {
        await serviceClient.rpc('sync_cron_metadata_from_live_scheduler');
      } catch (e) {
        console.log('Could not sync metadata from live scheduler:', e);
      }

      // Get metadata from our table
      const { data: metadata, error: metaError } = await serviceClient
        .from('cron_job_metadata')
        .select('*')
        .order('category', { ascending: true })
        .order('display_name', { ascending: true });

      if (metaError) {
        throw new Error(`Failed to fetch jobs: ${metaError.message}`);
      }

      // Try to get real scheduler jobs from cron.job table
      let schedulerJobs: Array<{ jobname: string; schedule: string; active: boolean }> = [];
      try {
        const { data: cronJobs, error: cronError } = await serviceClient
          .rpc('get_cron_jobs');
        
        if (!cronError && cronJobs) {
          schedulerJobs = cronJobs;
        }
      } catch (e) {
        console.log("Could not fetch cron.job table (function may not exist):", e);
      }

      // Create a map of scheduler jobs by name
      const schedulerMap = new Map(schedulerJobs.map(j => [j.jobname, j]));

      // Enrich metadata with scheduler info
      const enrichedJobs = (metadata || []).map((job: any) => {
        const schedulerJob = schedulerMap.get(job.job_name);
        return {
          ...job,
          schedule_human_readable: job.schedule_human_readable || cronToHumanReadable(job.schedule || ''),
          scheduler_schedule: schedulerJob?.schedule || null,
          scheduler_active: schedulerJob?.active ?? null,
          in_scheduler: !!schedulerJob,
          schedule_mismatch: schedulerJob ? (schedulerJob.schedule !== job.schedule) : false,
        };
      });

      // Also report scheduler jobs that aren't in metadata
      const metadataNames = new Set((metadata || []).map((j: any) => j.job_name));
      const orphanSchedulerJobs = schedulerJobs
        .filter(j => !metadataNames.has(j.jobname))
        .map(j => ({
          job_name: j.jobname,
          display_name: j.jobname,
          schedule: j.schedule,
          scheduler_schedule: j.schedule,
          scheduler_active: j.active,
          in_scheduler: true,
          in_metadata: false,
          schedule_mismatch: false,
          is_orphan: true,
        }));

      return new Response(
        JSON.stringify({ 
          success: true, 
          jobs: enrichedJobs,
          orphan_scheduler_jobs: orphanSchedulerJobs,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SYNC - Sync all metadata jobs to pg_cron scheduler
    if (action === 'sync') {
      const { job_name } = body;
      
      // Validate job_name if provided
      if (job_name) {
        const validation = validateJobName(job_name);
        if (!validation.valid) {
          return new Response(
            JSON.stringify({ error: validation.error }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      
      console.log('🔄 Starting sync operation', job_name ? `for job: ${job_name}` : 'for all jobs');
      
      // Get metadata for jobs to sync
      let query = serviceClient.from('cron_job_metadata').select('*');
      if (job_name) {
        query = query.eq('job_name', job_name);
      }
      
      const { data: jobsToSync, error: fetchError } = await query;
      
      if (fetchError) {
        throw new Error(`Failed to fetch jobs for sync: ${fetchError.message}`);
      }
      
      if (!jobsToSync || jobsToSync.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: 'No jobs to sync', synced: 0, failed: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const results: Array<{ job_name: string; success: boolean; error?: string }> = [];
      
      for (const job of jobsToSync) {
        const funcName = job.edge_function_name;
        const schedule = job.schedule;
        
        if (!funcName || !schedule) {
          results.push({ job_name: job.job_name, success: false, error: 'Missing edge_function_name or schedule' });
          continue;
        }
        
        // Validate stored values before using in SQL
        const jobNameValidation = validateJobName(job.job_name);
        const scheduleValidation = validateCronSchedule(schedule);
        const funcNameValidation = validateEdgeFunctionName(funcName);
        
        if (!jobNameValidation.valid || !scheduleValidation.valid || !funcNameValidation.valid) {
          results.push({ 
            job_name: job.job_name, 
            success: false, 
            error: jobNameValidation.error || scheduleValidation.error || funcNameValidation.error 
          });
          continue;
        }
        
        const functionUrl = `${supabaseUrl}/functions/v1/${funcName}`;
        const bodyJson = JSON.stringify(job.request_body || {});
        const escapedBodyJson = escapeSqlString(bodyJson);
        
        // First unschedule (ignore errors - job might not exist)
        await executeCronSql(serviceClient, `SELECT cron.unschedule('${job.job_name}');`, `unschedule-${job.job_name}`);
        
        // Then schedule with current metadata
        const scheduleSql = `
          SELECT cron.schedule(
            '${job.job_name}',
            '${schedule}',
            $$
            SELECT net.http_post(
              url:='${functionUrl}',
              headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${cronAuthKey}"}'::jsonb,
              body:='${escapedBodyJson}'::jsonb
            ) as request_id;
            $$
          );
        `;
        
        const result = await executeCronSql(serviceClient, scheduleSql, `schedule-${job.job_name}`);
        results.push({ job_name: job.job_name, success: result.success, error: result.error });
      }
      
      const synced = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      console.log(`🔄 Sync complete: ${synced} synced, ${failed} failed`);
      
      return new Response(
        JSON.stringify({ 
          success: failed === 0, 
          message: `Synced ${synced}/${results.length} jobs`,
          synced,
          failed,
          results
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ADD - Create new cron job
    if (action === 'add') {
      const { job_name, display_name, description, category, schedule, edge_function_name, request_body, is_critical } = body;
      
      if (!job_name || !schedule || !edge_function_name) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: job_name, schedule, edge_function_name" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (isRetiredWodJob(job_name)) {
        return new Response(
          JSON.stringify({ error: 'This retired Workout of the Day job cannot be recreated' }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // SECURITY: Validate all inputs before using in SQL
      const jobNameValidation = validateJobName(job_name);
      if (!jobNameValidation.valid) {
        return new Response(
          JSON.stringify({ error: jobNameValidation.error }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const scheduleValidation = validateCronSchedule(schedule);
      if (!scheduleValidation.valid) {
        return new Response(
          JSON.stringify({ error: scheduleValidation.error }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const funcNameValidation = validateEdgeFunctionName(edge_function_name);
      if (!funcNameValidation.valid) {
        return new Response(
          JSON.stringify({ error: funcNameValidation.error }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Build the HTTP post command for the cron job
      const functionUrl = `${supabaseUrl}/functions/v1/${edge_function_name}`;
      const requestBodyJson = JSON.stringify(request_body || {});
      const escapedRequestBodyJson = escapeSqlString(requestBodyJson);
      const humanReadable = cronToHumanReadable(schedule);
      
      // Create cron job using cron.schedule
      const cronSql = `
        SELECT cron.schedule(
          '${job_name}',
          '${schedule}',
          $$
          SELECT net.http_post(
            url:='${functionUrl}',
            headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${cronAuthKey}"}'::jsonb,
            body:='${escapedRequestBodyJson}'::jsonb
          ) as request_id;
          $$
        );
      `;
      
      console.log("📝 Creating cron job:", job_name);
      
      const cronResult = await executeCronSql(serviceClient, cronSql, `add-${job_name}`);

      // Save metadata
      const { error: metaError } = await serviceClient
        .from('cron_job_metadata')
        .upsert({
          job_name,
          display_name: display_name || job_name,
          description: description || '',
          category: category || 'general',
          schedule,
          schedule_human_readable: humanReadable,
          edge_function_name,
          request_body: request_body || {},
          is_critical: is_critical || false,
          is_active: true
        }, { onConflict: 'job_name' });

      if (metaError) {
        throw new Error(`Failed to save metadata: ${metaError.message}`);
      }

      if (!cronResult.success) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Metadata saved but scheduler failed: ${cronResult.error}`,
            metadata_saved: true,
            scheduler_updated: false
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Cron job created and scheduled successfully",
          metadata_saved: true,
          scheduler_updated: true
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // EDIT - Update cron job schedule and metadata
    if (action === 'edit') {
      const { job_name, display_name, description, category, schedule, edge_function_name, request_body, is_critical, is_active } = body;
      
      if (!job_name) {
        return new Response(
          JSON.stringify({ error: "Missing job_name" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (isRetiredWodJob(job_name)) {
        return new Response(
          JSON.stringify({ error: 'This retired Workout of the Day job cannot be reactivated' }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // SECURITY: Validate job_name
      const jobNameValidation = validateJobName(job_name);
      if (!jobNameValidation.valid) {
        return new Response(
          JSON.stringify({ error: jobNameValidation.error }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // SECURITY: Validate schedule if provided
      if (schedule) {
        const scheduleValidation = validateCronSchedule(schedule);
        if (!scheduleValidation.valid) {
          return new Response(
            JSON.stringify({ error: scheduleValidation.error }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      
      // SECURITY: Validate edge_function_name if provided
      if (edge_function_name) {
        const funcNameValidation = validateEdgeFunctionName(edge_function_name);
        if (!funcNameValidation.valid) {
          return new Response(
            JSON.stringify({ error: funcNameValidation.error }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      console.log(`📝 Editing cron job: ${job_name}`);

      // Get current job data to merge with updates
      const { data: currentJob } = await serviceClient
        .from('cron_job_metadata')
        .select('*')
        .eq('job_name', job_name)
        .single();

      // Build update object
      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (display_name !== undefined) updateData.display_name = display_name;
      if (description !== undefined) updateData.description = description;
      if (category !== undefined) updateData.category = category;
      if (edge_function_name !== undefined) updateData.edge_function_name = edge_function_name;
      if (request_body !== undefined) updateData.request_body = request_body;
      if (is_critical !== undefined) updateData.is_critical = is_critical;
      if (is_active !== undefined) updateData.is_active = is_active;
      
      let schedulerUpdated = true;
      let schedulerError: string | undefined;
      
      // If schedule is changing, update the cron scheduler
      if (schedule) {
        updateData.schedule = schedule;
        updateData.schedule_human_readable = cronToHumanReadable(schedule);
        
        // Get the edge function name to use (new or existing)
        const funcName = edge_function_name || currentJob?.edge_function_name;
        
        // Validate existing funcName from database
        if (funcName) {
          const existingFuncValidation = validateEdgeFunctionName(funcName);
          if (!existingFuncValidation.valid) {
            return new Response(
              JSON.stringify({ error: `Stored edge_function_name is invalid: ${existingFuncValidation.error}` }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
        
        const bodyJson = JSON.stringify(request_body ?? currentJob?.request_body ?? {});
        const escapedBodyJson = escapeSqlString(bodyJson);
        
        if (funcName) {
          const functionUrl = `${supabaseUrl}/functions/v1/${funcName}`;
          
          // Unschedule existing job first
          const unscheduleResult = await executeCronSql(
            serviceClient, 
            `SELECT cron.unschedule('${job_name}');`, 
            `edit-unschedule-${job_name}`
          );
          
          if (!unscheduleResult.success) {
            console.log(`⚠️ Unschedule warning (may not exist): ${unscheduleResult.error}`);
          }
          
          // Schedule with new configuration
          const scheduleSql = `
            SELECT cron.schedule(
              '${job_name}',
              '${schedule}',
              $$
              SELECT net.http_post(
                url:='${functionUrl}',
                headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${cronAuthKey}"}'::jsonb,
                body:='${escapedBodyJson}'::jsonb
              ) as request_id;
              $$
            );
          `;
          
          const scheduleResult = await executeCronSql(serviceClient, scheduleSql, `edit-schedule-${job_name}`);
          
          if (!scheduleResult.success) {
            schedulerUpdated = false;
            schedulerError = scheduleResult.error;
          }
        }
      }

      // Update metadata
      const { error: updateError } = await serviceClient
        .from('cron_job_metadata')
        .update(updateData)
        .eq('job_name', job_name);

      if (updateError) {
        throw new Error(`Failed to update metadata: ${updateError.message}`);
      }

      if (!schedulerUpdated) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Metadata updated but scheduler failed: ${schedulerError}`,
            metadata_saved: true,
            scheduler_updated: false
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Cron job updated successfully",
          metadata_saved: true,
          scheduler_updated: schedulerUpdated
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // DELETE - Remove cron job
    if (action === 'delete') {
      const { job_name } = body;
      
      if (!job_name) {
        return new Response(
          JSON.stringify({ error: "Missing job_name" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // SECURITY: Validate job_name
      const jobNameValidation = validateJobName(job_name);
      if (!jobNameValidation.valid) {
        return new Response(
          JSON.stringify({ error: jobNameValidation.error }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`🗑️ Deleting cron job: ${job_name}`);

      // Unschedule the cron job
      const unscheduleResult = await executeCronSql(
        serviceClient, 
        `SELECT cron.unschedule('${job_name}');`, 
        `delete-${job_name}`
      );

      // Delete metadata
      const { error: deleteError } = await serviceClient
        .from('cron_job_metadata')
        .delete()
        .eq('job_name', job_name);

      if (deleteError) {
        throw new Error(`Failed to delete metadata: ${deleteError.message}`);
      }

      if (!unscheduleResult.success) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Metadata deleted. Scheduler warning: ${unscheduleResult.error}`,
            metadata_deleted: true,
            scheduler_updated: false
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Cron job stopped and removed successfully",
          metadata_deleted: true,
          scheduler_updated: true
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // TEST - Manually trigger a cron job's function
    if (action === 'test') {
      const { edge_function_name, request_body } = body;
      
      if (!edge_function_name) {
        return new Response(
          JSON.stringify({ error: "Missing edge_function_name" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // SECURITY: Validate edge_function_name
      const funcNameValidation = validateEdgeFunctionName(edge_function_name);
      if (!funcNameValidation.valid) {
        return new Response(
          JSON.stringify({ error: funcNameValidation.error }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`🧪 Testing edge function: ${edge_function_name}`);

      // Call the edge function
      const { data, error } = await supabase.functions.invoke(edge_function_name, {
        body: request_body || {}
      });

      if (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Function executed successfully (one-time test)", result: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============================================
    // FREEZE / UNFREEZE — global background switch
    // ============================================

    // FREEZE STATUS
    if (action === 'freeze_status') {
      const { data } = await serviceClient
        .from('system_settings')
        .select('setting_key, setting_value')
        .in('setting_key', [FREEZE_SETTING_KEY, FREEZE_SNAPSHOT_KEY]);

      const map = new Map((data || []).map((r: any) => [r.setting_key, r.setting_value]));
      const rawFlag = map.get(FREEZE_SETTING_KEY);
      const snapshot = (map.get(FREEZE_SNAPSHOT_KEY) || {}) as any;

      return new Response(
        JSON.stringify({
          success: true,
          frozen: rawFlag === true || rawFlag === 'true' || rawFlag?.enabled === true,
          frozen_at: snapshot?.frozen_at || null,
          snapshot_jobs: Array.isArray(snapshot?.jobs) ? snapshot.jobs : [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // FREEZE - snapshot currently active jobs, then pause them all
    if (action === 'freeze') {
      const { data: cronJobs, error: cronError } = await serviceClient.rpc('get_cron_jobs');
      if (cronError) {
        throw new Error(`Could not read scheduler jobs: ${cronError.message}`);
      }

      const activeNames = (cronJobs || [])
        .filter((j: any) => j.active)
        .map((j: any) => String(j.jobname))
        .filter((n: string) => validateJobName(n).valid);

      console.log(`🧊 Freezing ${activeNames.length} active scheduler jobs`);

      if (activeNames.length > 0) {
        const inList = activeNames.map((n: string) => `'${escapeSqlString(n)}'`).join(', ');
        const pauseResult = await executeCronSql(
          serviceClient,
          `SELECT cron.alter_job(jobid, active := false) FROM cron.job WHERE jobname IN (${inList});`,
          'freeze-pause-jobs'
        );
        if (!pauseResult.success) {
          throw new Error(`Failed to pause scheduler jobs: ${pauseResult.error}`);
        }

        await serviceClient
          .from('cron_job_metadata')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .in('job_name', activeNames);
      }

      const frozenAt = new Date().toISOString();

      await serviceClient.from('system_settings').upsert({
        setting_key: FREEZE_SNAPSHOT_KEY,
        setting_value: { jobs: activeNames, frozen_at: frozenAt },
        description: 'Snapshot of scheduler jobs that were active when the system was frozen',
      }, { onConflict: 'setting_key' });

      await serviceClient.from('system_settings').upsert({
        setting_key: FREEZE_SETTING_KEY,
        setting_value: true,
        description: 'When true, all background automation (crons + event-driven senders) is paused',
      }, { onConflict: 'setting_key' });

      return new Response(
        JSON.stringify({
          success: true,
          frozen: true,
          frozen_at: frozenAt,
          paused: activeNames.length,
          jobs: activeNames,
          message: `Frozen. ${activeNames.length} scheduled jobs paused and background senders disabled.`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // UNFREEZE - restore exactly the jobs that were active before the freeze
    if (action === 'unfreeze') {
      const { data: snapRow } = await serviceClient
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', FREEZE_SNAPSHOT_KEY)
        .maybeSingle();

      const snapshot = (snapRow?.setting_value || {}) as any;
      const names: string[] = (Array.isArray(snapshot?.jobs) ? snapshot.jobs : [])
        .map((n: any) => String(n))
        .filter((n: string) => validateJobName(n).valid && !isRetiredWodJob(n));

      console.log(`🔥 Unfreezing ${names.length} snapshotted jobs`);

      if (names.length > 0) {
        const inList = names.map((n) => `'${escapeSqlString(n)}'`).join(', ');
        const resumeResult = await executeCronSql(
          serviceClient,
          `SELECT cron.alter_job(jobid, active := true) FROM cron.job WHERE jobname IN (${inList});`,
          'unfreeze-resume-jobs'
        );
        if (!resumeResult.success) {
          throw new Error(`Failed to resume scheduler jobs: ${resumeResult.error}`);
        }

        await serviceClient
          .from('cron_job_metadata')
          .update({ is_active: true, updated_at: new Date().toISOString() })
          .in('job_name', names);
      }

      await serviceClient.from('system_settings').upsert({
        setting_key: FREEZE_SETTING_KEY,
        setting_value: false,
        description: 'When true, all background automation (crons + event-driven senders) is paused',
      }, { onConflict: 'setting_key' });

      await serviceClient.from('system_settings').upsert({
        setting_key: FREEZE_SNAPSHOT_KEY,
        setting_value: { jobs: [], frozen_at: null, restored_at: new Date().toISOString() },
        description: 'Snapshot of scheduler jobs that were active when the system was frozen',
      }, { onConflict: 'setting_key' });

      return new Response(
        JSON.stringify({
          success: true,
          frozen: false,
          resumed: names.length,
          jobs: names,
          message: `Unfrozen. ${names.length} scheduled jobs restored to their previous state.`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }


    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("❌ Error in manage-cron-jobs:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
