import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getEmailHeaders, getEmailFooter } from "../_shared/email-utils.ts";
import { MESSAGE_TYPES } from "../_shared/notification-types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CORPORATE-MEMBER] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Use service role for admin operations
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !userData.user) {
      throw new Error("User not authenticated");
    }

    const adminUser = userData.user;
    logStep("Admin user authenticated", { userId: adminUser.id });

    // Verify user is a corporate admin
    const { data: corpSub, error: corpError } = await supabase
      .from('corporate_subscriptions')
      .select('*')
      .eq('admin_user_id', adminUser.id)
      .eq('status', 'active')
      .single();

    if (corpError || !corpSub) {
      throw new Error("You are not a corporate admin or your subscription is not active");
    }

    logStep("Corporate subscription verified", { 
      orgName: corpSub.organization_name, 
      maxUsers: corpSub.max_users,
      currentUsers: corpSub.current_users_count 
    });

    // Check user limit
    if (corpSub.current_users_count >= corpSub.max_users) {
      throw new Error(`User limit reached. Your plan allows up to ${corpSub.max_users} users.`);
    }

    // Parse request body
    const { email, fullName } = await req.json();
    
    if (!email || !email.includes('@')) {
      throw new Error("Valid email is required");
    }

    if (!fullName || fullName.trim().length < 2) {
      throw new Error("Full name is required");
    }

    // Never accept or email a plaintext password. Create the account with a
    // strong throwaway secret and send a one-time password-setup link instead.
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const memberPassword = Array.from(randomBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("") + "Aa1!";

    logStep("Creating member account", { email, fullName });

    // Create user in Supabase Auth
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: memberPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName.trim(),
        corporate_member: true,
        organization_name: corpSub.organization_name,
      },
    });

    if (createError) {
      if (createError.message.includes('already registered')) {
        throw new Error("A user with this email already exists");
      }
      throw new Error(`Failed to create user: ${createError.message}`);
    }

    if (!newUser.user) {
      throw new Error("Failed to create user account");
    }

    logStep("User created in Auth", { newUserId: newUser.user.id });

    // Create profile
    await supabase
      .from('profiles')
      .upsert({
        user_id: newUser.user.id,
        full_name: fullName.trim(),
      }, {
        onConflict: 'user_id'
      });

    logStep("Profile created");

    // Create user subscription with premium access
    await supabase
      .from('user_subscriptions')
      .upsert({
        user_id: newUser.user.id,
        plan_type: 'premium',
        status: 'active',
        current_period_start: corpSub.current_period_start,
        current_period_end: corpSub.current_period_end,
      }, {
        onConflict: 'user_id'
      });

    logStep("Premium subscription created for member");

    // Add to corporate members table
    const { error: memberError } = await supabase
      .from('corporate_members')
      .insert({
        corporate_subscription_id: corpSub.id,
        user_id: newUser.user.id,
        email: email.trim().toLowerCase(),
        created_by: adminUser.id,
      });

    if (memberError) {
      logStep("ERROR inserting corporate member", { error: memberError });
      throw new Error("Failed to add member to corporate subscription");
    }

    // Increment user count
    const { error: updateError } = await supabase
      .from('corporate_subscriptions')
      .update({
        current_users_count: corpSub.current_users_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', corpSub.id);

    if (updateError) {
      logStep("ERROR updating user count", { error: updateError });
    }

    logStep("Corporate member added", { newCount: corpSub.current_users_count + 1 });

    // Insert dashboard welcome message for the corporate member (using centralized MESSAGE_TYPES)
    try {
      await supabase
        .from('user_system_messages')
        .insert({
          user_id: newUser.user.id,
          message_type: MESSAGE_TYPES.CORPORATE_MEMBER_ADDED,
          subject: `🎉 Welcome to SmartyGym - ${corpSub.organization_name}!`,
          content: `<p class="tiptap-paragraph">Welcome to the team, <strong>${fullName.trim()}</strong>! 🎉</p>
<p class="tiptap-paragraph">You've been added to <strong>${corpSub.organization_name}</strong>'s SmartyGym corporate account with <strong>Premium-level access</strong>.</p>
<p class="tiptap-paragraph">You now have full access to all premium features:</p>
<ul>
<li>500+ expert-designed workouts by Haris Falas</li>
<li>Premium training programs</li>
<li>Daily Smarty Ritual</li>
<li>All fitness tools and calculators</li>
<li>Community features and leaderboards</li>
</ul>
<p class="tiptap-paragraph">Start exploring your dashboard and let's make every workout count!</p>
<p class="tiptap-paragraph"><a href="https://smartygym.com/userdashboard" style="color: #29B6D2;">Go to Your Dashboard →</a></p>`,
          is_read: false,
        });
      logStep("Dashboard welcome message inserted for member");
    } catch (msgError) {
      logStep("ERROR inserting dashboard message", { error: msgError });
    }

    // Send welcome email to new member
    try {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey) {
        const resend = new Resend(resendKey);
        
        const memberEmail = email.trim().toLowerCase();

        // Generate a one-time password-setup (recovery) link
        let setupLink = "https://smartygym.com/reset-password";
        const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
          type: "recovery",
          email: memberEmail,
          options: { redirectTo: "https://smartygym.com/reset-password" },
        });
        if (linkError) {
          logStep("ERROR generating setup link", { error: linkError.message });
        } else if (linkData?.properties?.action_link) {
          setupLink = linkData.properties.action_link;
        }
        await resend.emails.send({
          from: "SmartyGym <notifications@smartygym.com>",
          to: [memberEmail],
          subject: `🎉 Welcome to SmartyGym - ${corpSub.organization_name}`,
          headers: getEmailHeaders(memberEmail),
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #29B6D2; margin: 0;">SmartyGym</h1>
              </div>
              <div style="background: #f9f9f9; border-radius: 8px; padding: 30px;">
                <h2 style="margin-top: 0;">Welcome to the Team, ${fullName.trim()}! 🎉</h2>
                <p>You've been added to <strong>${corpSub.organization_name}</strong>'s SmartyGym corporate account!</p>
                <p>You now have <strong>Premium-level access</strong> to all SmartyGym features:</p>
                <ul style="padding-left: 20px;">
                  <li>500+ expert-designed workouts</li>
                  <li>Premium training programs</li>
                  <li>Daily Smarty Ritual</li>
                  <li>All fitness tools and calculators</li>
                  <li>Community features</li>
                </ul>
                <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 15px; margin: 20px 0;">
                  <strong>Your account email:</strong><br>
                  ${memberEmail}
                </div>
                <p style="color: #666; font-size: 14px;">For your security we never send passwords by email. Use the secure link below to set your own password. It can only be used once and expires shortly.</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${setupLink}" style="display: inline-block; background: #29B6D2; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold;">Set Your Password →</a>
                </div>
                <p>Let's make every workout count!</p>
                <p><em>The SmartyGym Team</em></p>
              </div>
              ${getEmailFooter(memberEmail)}
            </body>
            </html>
          `,
        });
        logStep("Welcome email sent to member", { email });
      }
    } catch (emailError) {
      logStep("ERROR sending welcome email", { error: emailError });
    }

    return new Response(JSON.stringify({ 
      success: true,
      member: {
        id: newUser.user.id,
        email: email.trim().toLowerCase(),
        fullName: fullName.trim(),
      },
      usersCount: corpSub.current_users_count + 1,
      maxUsers: corpSub.max_users,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});