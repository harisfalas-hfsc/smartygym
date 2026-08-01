import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getAdminNotificationEmail } from "../_shared/admin-settings.ts";
import { logEmailDelivery } from "../_shared/email-log.ts";
import { requireAdminOrServiceRole } from "../_shared/admin-or-service-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Send Test Admin Email - Verify email deliverability to admin address
 */
serve(async (req: Request): Promise<Response> => {
  console.log("📧 Sending test admin email...");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authError = await requireAdminOrServiceRole(req, corsHeaders);
  if (authError) return authError;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    
    if (!resendKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendKey);

    // Get admin email from settings
    const adminEmail = await getAdminNotificationEmail(supabase);
    console.log(`📧 Sending test email to: ${adminEmail}`);

    const now = new Date();
    const cyprusTime = now.toLocaleString('en-GB', { 
      timeZone: 'Europe/Nicosia',
      dateStyle: 'full',
      timeStyle: 'long'
    });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>SmartyGym Test Email</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb;">
        <div style="background: white; border-radius: 12px; padding: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #16a34a; margin: 0;">✅ Test Email Successful</h1>
            <p style="color: #6b7280; margin-top: 8px;">SmartyGym Admin Email Test</p>
          </div>

          <div style="background: #f0fdf4; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <p style="margin: 0 0 10px 0; font-weight: 600; color: #15803d;">Email Delivery Verified</p>
            <p style="margin: 0; color: #166534;">
              This test email confirms that admin notifications are being delivered correctly to this address.
            </p>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Sent To:</td>
              <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${adminEmail}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Sent At:</td>
              <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${cyprusTime}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Source:</td>
              <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Admin Panel → Email Monitor</td>
            </tr>
          </table>

          <div style="background: #eff6ff; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
            <p style="margin: 0; font-size: 14px; color: #1e40af;">
              <strong>What this means:</strong><br>
              • Health Audit emails will arrive here<br>
              • SEO Weekly reports will arrive here<br>
              • Contact form notifications will arrive here<br>
              • WOD failure alerts will arrive here
            </p>
          </div>

          <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280;">
            <p style="margin: 0; font-size: 12px;">
              SmartyGym - Your Gym Re-imagined. Anywhere, Anytime.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: "SmartyGym System <notifications@smartygym.com>",
      to: [adminEmail],
      subject: "✅ SmartyGym Admin Email Test - Delivery Confirmed",
      html,
    });

    if (emailError) {
      console.error("Resend error:", emailError);
      await logEmailDelivery({
        toEmail: adminEmail,
        messageType: "admin_test_email",
        status: "failed",
        errorMessage: emailError.message,
        metadata: { source: "admin_email_monitor" },
      });
      throw new Error(`Email failed: ${emailError.message}`);
    }

    console.log(`✅ Test email sent successfully to ${adminEmail}`);

    // Log the email
    await logEmailDelivery({
      toEmail: adminEmail,
      messageType: "admin_test_email",
      status: "sent",
      resendId: emailResult?.id ?? null,
      metadata: { source: "admin_email_monitor" },
    });

    return new Response(JSON.stringify({
      success: true,
      adminEmail,
      sentAt: now.toISOString(),
      resendId: emailResult?.id
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("❌ Test email failed:", error);
    return new Response(JSON.stringify({ 
      success: false,
      error: String(error) 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
