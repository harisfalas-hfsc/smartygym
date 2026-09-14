import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireServiceRole } from "../_shared/cron-auth.ts";
import { freezeGuard } from "../_shared/system-freeze.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authError = requireServiceRole(req, corsHeaders);
  if (authError) return authError;

  const frozen = await freezeGuard(corsHeaders, "send-scheduled-emails");
  if (frozen) return frozen;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Checking for scheduled emails...");

    // Get all pending emails that are due
    const { data: dueEmails, error: fetchError } = await supabase
      .from("scheduled_emails")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_time", new Date().toISOString());

    if (fetchError) {
      throw new Error(`Error fetching emails: ${fetchError.message}`);
    }

    if (!dueEmails || dueEmails.length === 0) {
      console.log("No emails due at this time");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No emails to send",
          processed: 0 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    console.log(`Found ${dueEmails.length} emails to send`);

    // Process each email
    const results = await Promise.allSettled(
      dueEmails.map(async (email) => {
        try {
          // Determine target user IDs based on audience
          let recipientEmails: string[] = [];

          // Handle individual user targeting (format: "user:USER_ID")
          if (email.target_audience?.startsWith("user:")) {
            const userId = email.target_audience.split(":")[1];
            
            // Use provided email if available, otherwise fetch from auth
            if (email.recipient_emails && email.recipient_emails.length > 0) {
              recipientEmails = email.recipient_emails;
            } else {
              const { data: userData } = await supabase.auth.admin.getUserById(userId);
              if (userData?.user?.email) {
                recipientEmails = [userData.user.email];
              }
            }
          } else if (email.target_audience === "all") {
            // Get all registered users
            const { data: usersData } = await supabase.functions.invoke('get-users-with-emails');
            recipientEmails = usersData?.users?.map((u: any) => u.email) || [];
          } else if (email.target_audience === "free") {
            const { data: usersData } = await supabase.functions.invoke('get-users-with-emails');
            const allUsers = usersData?.users || [];
            recipientEmails = allUsers
              .filter((u: any) => u.plan_type === 'free')
              .map((u: any) => u.email);
          } else if (email.target_audience === "subscribers") {
            const { data: usersData } = await supabase.functions.invoke('get-users-with-emails');
            const allUsers = usersData?.users || [];
            recipientEmails = allUsers
              .filter((u: any) => ['lifetime','premium','legacy_premium'].includes(u.plan_type))
              .map((u: any) => u.email);
          } else if (email.target_audience === "premium") {
            const { data: usersData } = await supabase.functions.invoke('get-users-with-emails');
            const allUsers = usersData?.users || [];
            recipientEmails = allUsers
              .filter((u: any) => ['lifetime','premium','legacy_premium'].includes(u.plan_type))
              .map((u: any) => u.email);
          } else if (email.target_audience === "purchasers") {
            // Get users with purchases
            const { data: purchases } = await supabase
              .from("user_purchases")
              .select("user_id");
            
            const purchaserIds = [...new Set(purchases?.map((p) => p.user_id) || [])];
            
            // Get their emails
            const { data: usersData } = await supabase.functions.invoke('get-users-with-emails');
            const allUsers = usersData?.users || [];
            recipientEmails = allUsers
              .filter((u: any) => purchaserIds.includes(u.user_id))
              .map((u: any) => u.email);
          }

          if (recipientEmails.length === 0) {
            throw new Error("No recipients found for this email");
          }

          // Send the email via bulk email function
          const { data: emailResult, error: emailError } = await supabase.functions.invoke(
            "send-bulk-email",
            {
              body: {
                userIds: [],
                recipient_emails: recipientEmails,
                subject: email.subject,
                message: email.body,
              },
            }
          );

          if (emailError) {
            throw emailError;
          }

          // Update email status and handle recurrence
          const now = new Date();
          const updateData: any = {
            status: email.recurrence_pattern === "once" ? "sent" : "pending",
            sent_at: now.toISOString(),
            recipient_count: recipientEmails.length,
            last_sent_at: now.toISOString(),
          };

          // Calculate next scheduled time for recurring emails
          if (email.recurrence_pattern !== "once") {
            let nextTime = new Date(now);
            
            switch (email.recurrence_pattern) {
              case "daily":
                nextTime.setDate(nextTime.getDate() + 1);
                break;
              case "weekly":
                nextTime.setDate(nextTime.getDate() + 7);
                break;
              case "twice_weekly":
                nextTime.setDate(nextTime.getDate() + 3);
                break;
              case "three_times_weekly":
                nextTime.setDate(nextTime.getDate() + 2);
                break;
              case "custom":
                if (email.recurrence_interval) {
                  nextTime.setDate(nextTime.getDate() + parseInt(email.recurrence_interval));
                }
                break;
            }
            
            updateData.next_scheduled_time = nextTime.toISOString();
            updateData.scheduled_time = nextTime.toISOString();
          }

          await supabase
            .from("scheduled_emails")
            .update(updateData)
            .eq("id", email.id);

          // Log to notification audit
          try {
            await supabase
              .from('notification_audit_log')
              .insert({
                notification_type: 'email',
                message_type: 'scheduled_email',
                sent_by: email.created_by,
                recipient_filter: email.target_audience,
                recipient_count: recipientEmails.length,
                success_count: recipientEmails.length,
                failed_count: 0,
                subject: email.subject,
                content: email.body,
                metadata: { email_id: email.id, scheduled_time: email.scheduled_time }
              });
          } catch (auditError) {
            console.error('Failed to log audit:', auditError);
          }

          console.log(`Successfully sent email ${email.id} to ${recipientEmails.length} recipients`);

          return {
            id: email.id,
            success: true,
            recipients: recipientEmails.length,
          };
        } catch (error: any) {
          console.error(`Failed to send email ${email.id}:`, error);

          // Mark email as failed
          await supabase
            .from("scheduled_emails")
            .update({
              status: "failed",
              error_message: error.message,
            })
            .eq("id", email.id);

          throw error;
        }
      })
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    console.log(`Processed ${successful} emails successfully, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: dueEmails.length,
        successful,
        failed,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error processing scheduled emails:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});