import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getEmailHeaders, getEmailFooter } from "../_shared/email-utils.ts";
import { MESSAGE_TYPES } from "../_shared/notification-types.ts";
import { logEmailDelivery } from "../_shared/email-log.ts";
import { requireServiceRole } from "../_shared/cron-auth.ts";
import { freezeGuard } from "../_shared/system-freeze.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authFail = requireServiceRole(req, corsHeaders);
  if (authFail) return authFail;

  const frozen = await freezeGuard(corsHeaders, "send-subscription-expired-notifications");
  if (frozen) return frozen;

  try {
    console.log("Starting subscription expired notifications check...");
    
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Find subscriptions that expired in the last 24 hours (to avoid sending multiple times)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const { data: expiredSubscriptions, error: subError } = await supabaseAdmin
      .from("user_subscriptions")
      .select("user_id, plan_type, current_period_end, stripe_subscription_id")
      .eq("status", "canceled")
      .not("current_period_end", "is", null)
      .lt("current_period_end", new Date().toISOString())
      .gt("current_period_end", yesterday.toISOString());

    if (subError) {
      console.error("Error fetching expired subscriptions:", subError);
      throw subError;
    }

    console.log(`Found ${expiredSubscriptions?.length || 0} newly expired subscriptions`);

    if (!expiredSubscriptions || expiredSubscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No newly expired subscriptions found" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    let dashboardCount = 0;
    let emailCount = 0;

    for (const subscription of expiredSubscriptions) {
      const { user_id, plan_type, current_period_end } = subscription;

      // Check if we already sent an expired notification for this subscription
      const { data: existingMessage } = await supabaseAdmin
        .from("user_system_messages")
        .select("id")
        .eq("user_id", user_id)
        .eq("message_type", MESSAGE_TYPES.SUBSCRIPTION_EXPIRED)
        .gte("created_at", yesterday.toISOString())
        .limit(1);

      if (existingMessage && existingMessage.length > 0) {
        console.log(`Already sent expired notification to user ${user_id}, skipping`);
        continue;
      }

      // Get user email
      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(user_id);
      
      if (userError || !userData?.user?.email) {
        console.error(`Could not find email for user ${user_id}`);
        continue;
      }

      const userEmail = userData.user.email;
      const userName = userData.user.user_metadata?.full_name || "Smarty";
      const getPlanName = (pt: string) => "Premium";
      const planName = getPlanName(plan_type);
      const expiredDate = new Date(current_period_end).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric"
      });

      // 1. Send dashboard notification
      const dashboardSubject = "Your Subscription Has Ended";
      const dashboardContent = `
        <p>Hi ${userName},</p>
        <p>Your <strong>${planName}</strong> subscription ended on <strong>${expiredDate}</strong>.</p>
        <p>We hope you enjoyed your time with SmartyGym! You now have free tier access, which means you can still browse our content but won't have access to premium workouts, training programs, Smarty Rituals, and other subscriber benefits.</p>
        <p>If you'd like to continue your fitness journey with us, you can resubscribe anytime to regain full access to all premium content.</p>
        <p>We'd love to have you back!</p>
        <p>Best regards,<br/>The SmartyGym Team</p>
      `;

      const { error: msgError } = await supabaseAdmin
        .from("user_system_messages")
        .insert({
          user_id,
          message_type: MESSAGE_TYPES.SUBSCRIPTION_EXPIRED,
          subject: dashboardSubject,
          content: dashboardContent,
          is_read: false
        });

      if (!msgError) {
        dashboardCount++;
        console.log(`Dashboard notification sent to user ${user_id}`);
      } else {
        console.error(`Failed to send dashboard notification to user ${user_id}:`, msgError);
      }

      // 2. Send email notification
      try {
        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <img src="https://cvccrvyimyzrxcwzmxwk.supabase.co/storage/v1/object/public/blog-images/smartygym-logo.png" alt="SmartyGym" style="max-width: 150px; height: auto;">
              <p style="color: #666; font-size: 14px; margin-top: 10px;">Your Gym Re-imagined. Anywhere, Anytime.</p>
            </div>
            
            <h1 style="color: #18181b; font-size: 24px; margin-bottom: 20px;">Your Subscription Has Ended</h1>
            
            <p style="color: #333; margin-bottom: 15px;">Hi ${userName},</p>
            
            <p style="color: #333; margin-bottom: 15px;">Your <strong>${planName}</strong> subscription ended on <strong>${expiredDate}</strong>.</p>
            
            <p style="color: #333; margin-bottom: 15px;">We hope you enjoyed your time with SmartyGym! You now have free tier access, which means you can still browse our content but won't have access to premium workouts, training programs, Smarty Rituals, and other subscriber benefits.</p>
            
            <p style="color: #333; margin-bottom: 25px;">If you'd like to continue your fitness journey with us, you can resubscribe anytime to regain full access to all premium content.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://smartygym.com/pricing" style="display: inline-block; background-color: #29B6D2; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">Resubscribe Now</a>
            </div>
            
            <p style="color: #333; margin-bottom: 15px;">We'd love to have you back!</p>
            
            <p style="color: #333; margin-top: 30px;">Best regards,<br/><strong>The SmartyGym Team</strong></p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            
            <p style="color: #666; font-size: 12px; text-align: center;">
              SmartyGym - Expert Fitness<br/>
              <a href="https://smartygym.com/unsubscribe-help" style="color: #666;">Unsubscribe</a> from notifications
            </p>
          </body>
          </html>
        `;

        const sendResult = await resend.emails.send({
          from: "SmartyGym <notifications@smartygym.com>",
          to: [userEmail],
          subject: "Your SmartyGym Subscription Has Ended",
          html: emailHtml,
          headers: {
            "List-Unsubscribe": "<https://smartygym.com/unsubscribe-help>",
            "Reply-To": "smartygym@outlook.com"
          }
        });

        emailCount++;
        console.log(`Email sent to ${userEmail}`);
        await logEmailDelivery({
          userId: subscription.user_id,
          toEmail: userEmail,
          messageType: "subscription-expired",
          status: "sent",
          resendId: (sendResult as any)?.data?.id ?? null,
        });

        // Rate limiting for Resend (600ms delay)
        await new Promise(resolve => setTimeout(resolve, 600));
      } catch (emailError) {
        console.error(`Failed to send email to ${userEmail}:`, emailError);
        await logEmailDelivery({
          userId: subscription.user_id,
          toEmail: userEmail,
          messageType: "subscription-expired",
          status: "failed",
          errorMessage: emailError instanceof Error ? emailError.message : String(emailError),
        });
      }
    }

    // Update automation rule
    await supabaseAdmin
      .from("automation_rules")
      .update({
        last_triggered_at: new Date().toISOString(),
        total_executions: supabaseAdmin.rpc("increment_automation_executions", { key: "subscription_expired" })
      })
      .eq("automation_key", "subscription_expired");

    console.log(`Subscription expired notifications complete: ${dashboardCount} dashboard, ${emailCount} emails`);

    return new Response(
      JSON.stringify({
        success: true,
        dashboard_notifications: dashboardCount,
        emails_sent: emailCount
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-subscription-expired-notifications:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
