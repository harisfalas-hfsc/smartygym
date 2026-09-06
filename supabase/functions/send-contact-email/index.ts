import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getAdminNotificationEmail } from "../_shared/admin-settings.ts";
import { logEmailDelivery } from "../_shared/email-log.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ContactEmailRequest {
  name: string;
  email: string;
  subject: string;
  message: string;
  recipientEmail: string;
  userStatus?: string;
  messageId?: string;
}

// Simple HTML sanitizer to prevent XSS
function sanitizeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// Rate limiting: 3 requests per hour per IP
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 3;

async function checkRateLimit(identifier: string): Promise<boolean> {
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  
  const { data } = await supabaseClient
    .from('rate_limits')
    .select('request_count')
    .eq('identifier', identifier)
    .eq('endpoint', 'contact-email')
    .gte('window_start', windowStart.toISOString())
    .maybeSingle();

  if (!data) {
    await supabaseClient.from('rate_limits').insert({
      identifier,
      endpoint: 'contact-email',
      request_count: 1,
      window_start: new Date().toISOString()
    });
    return true;
  }

  if (data.request_count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  await supabaseClient
    .from('rate_limits')
    .update({ request_count: data.request_count + 1 })
    .eq('identifier', identifier)
    .eq('endpoint', 'contact-email')
    .gte('window_start', windowStart.toISOString());

  return true;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Note: recipientEmail from frontend is ignored - we always use database setting
    const { name, email, subject, message, userStatus, messageId }: ContactEmailRequest = await req.json();

    // Input validation
    if (!name || !email || !subject || !message) {
      return new Response(
        JSON.stringify({ error: 'All fields are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate lengths
    if (name.length > 100 || email.length > 255 || subject.length > 200 || message.length > 2000) {
      return new Response(
        JSON.stringify({ error: 'Input exceeds maximum length' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const canProceed = await checkRateLimit(ipAddress);
    
    if (!canProceed) {
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize all inputs
    const safeName = sanitizeHtml(name.trim());
    const safeEmail = sanitizeHtml(email.trim());
    const safeSubject = sanitizeHtml(subject.trim());
    const safeMessage = sanitizeHtml(message.trim()).replace(/\n/g, '<br>');
    const safeUserStatus = userStatus ? sanitizeHtml(userStatus) : '';

    // Create Supabase client for logging history
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get admin notification email from database - ALWAYS use this, never trust frontend
    const adminEmail = await getAdminNotificationEmail(supabaseAdmin);
    console.log(`Sending email from ${email} to ${adminEmail} (resolved from database)`);

    // Send initial email to admin
    let emailResponse: any;
    try {
      emailResponse = await resend.emails.send({
      from: "SmartyGym Contact <notifications@smartygym.com>",
      to: [adminEmail],
      replyTo: email,
      subject: `[Smarty Gym Contact] ${safeSubject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; border-bottom: 2px solid #000; padding-bottom: 10px;">New Contact Message</h2>
          
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>From:</strong> ${safeName}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${safeEmail}</p>
            <p style="margin: 5px 0;"><strong>Subject:</strong> ${safeSubject}</p>
            ${safeUserStatus ? `<p style="margin: 5px 0;"><strong>User Status:</strong> <span style="color: #d4af37; font-weight: bold;">${safeUserStatus}</span></p>` : ''}
          </div>
          
          <div style="margin: 20px 0;">
            <p style="margin-bottom: 10px;"><strong>Message:</strong></p>
            <div style="background-color: #fff; padding: 15px; border-left: 3px solid #000;">
              ${safeMessage}
            </div>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
            <p>This message was sent via the Smarty Gym contact form at smartygym.com</p>
          </div>
        </div>
      `,
      });
      console.log("Email sent successfully to admin:", emailResponse);
      await logEmailDelivery({
        toEmail: adminEmail,
        messageType: "contact-form-admin",
        status: "sent",
        resendId: emailResponse?.data?.id ?? null,
        metadata: { from_email: email, subject: safeSubject },
      });
    } catch (sendErr: any) {
      await logEmailDelivery({
        toEmail: adminEmail,
        messageType: "contact-form-admin",
        status: "failed",
        errorMessage: sendErr?.message || String(sendErr),
        metadata: { from_email: email, subject: safeSubject },
      });
      throw sendErr;
    }

    // Auto-reply content that will be logged to history
    const autoReplyContent = `Thank you for contacting SmartyGym! We have received your inquiry regarding "${subject}" and will review it promptly. Our team typically responds within 24-48 hours.`;

    // Send auto-reply confirmation to the sender
    try {
      const autoReplyResult = await resend.emails.send({
        from: "SmartyGym <notifications@smartygym.com>",
        to: [email],
        subject: "Thank you for contacting SmartyGym!",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #29B6D2; border-bottom: 2px solid #29B6D2; padding-bottom: 10px;">Thank You for Your Message!</h2>
            
            <p style="font-size: 16px; color: #333;">Hi ${safeName},</p>
            
            <p style="color: #333;">We have received your inquiry regarding "<strong>${safeSubject}</strong>" and will review it promptly.</p>
            
            <p style="color: #333;">Our team typically responds within 24-48 hours.</p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
              <p>Best regards,<br><strong>The SmartyGym Team</strong></p>
              <p style="margin-top: 15px;">This is an automated confirmation. Please do not reply to this email.</p>
            </div>
          </div>
        `,
      });
      console.log("Auto-reply sent to:", email);
      await logEmailDelivery({
        toEmail: email,
        messageType: "contact-form-auto-reply",
        status: "sent",
        resendId: autoReplyResult?.data?.id ?? null,
      });

      // Log auto-reply to message history if messageId is provided
      if (messageId) {
        try {
          const { error: historyError } = await supabaseAdmin
            .from('contact_message_history')
            .insert({
              contact_message_id: messageId,
              message_type: 'auto_reply',
              content: autoReplyContent,
              sender: 'system'
            });

          if (historyError) {
            console.error("Failed to log auto-reply to history:", historyError);
          } else {
            console.log("Auto-reply logged to message history for messageId:", messageId);
          }
        } catch (historyErr) {
          console.error("Error logging auto-reply to history:", historyErr);
        }
      }

      // ── Self-service actions: DO the job before writing about it ──────────
      // If the customer asks to be removed from emails, actually remove them now.
      const performedActions: string[] = [];
      if (detectsUnsubscribeRequest(`${subject}\n${message}`)) {
        const result = await unsubscribeEmailEverywhere(supabaseAdmin, email);
        if (result.performed) {
          performedActions.push(
            "You have now been unsubscribed. Every optional email (daily digest, reminders, new content, weekly report, announcements) has been switched off for this address. Only essential account emails such as purchase or renewal confirmations will still be sent. This has already been done — no further action is needed."
          );
          await supabaseAdmin.from("contact_message_history").insert({
            contact_message_id: messageId ?? null,
            message_type: "system_action",
            content: "Automatic action: all optional emails switched off for this address at the customer's request.",
            sender: "system",
          }).then(({ error }: any) => {
            if (error) console.error("Failed to log unsubscribe action:", error);
          });
        } else if (result.alreadyUnsubscribed) {
          performedActions.push(
            "This address was already unsubscribed — every optional email is off. Confirm this is the case; do not promise any further action."
          );
        } else {
          performedActions.push(
            "The automatic unsubscribe could not be completed. Do NOT claim it was done; say a team member is handling it right now."
          );
        }
        console.log(`[contact] unsubscribe intent handled for ${email}:`, JSON.stringify(result));
      }

      // Call AI to generate intelligent response
      let aiResponseContent = '';
      try {
        console.log("Calling AI for intelligent response...");
        
        // Determine user type
        const userType = safeUserStatus?.toLowerCase().includes('premium') 
          ? 'premium' 
          : safeUserStatus?.toLowerCase().includes('free') 
            ? 'free' 
            : 'guest';

        const aiResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-contact-response`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({
            contactMessage: {
              name: name,
              email: email,
              subject: subject,
              message: message,
              category: 'contact',
              userType: userType
            },
            performedActions,
          })
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          
          if (aiData.success && aiData.response) {
            console.log("AI response generated successfully");
            aiResponseContent = aiData.response;
            
            // Send AI response email to customer (no AI disclosure)
            const aiSendResult = await resend.emails.send({
              from: "SmartyGym <notifications@smartygym.com>",
              to: [email],
              replyTo: "smartygym@outlook.com",
              subject: `Re: ${subject}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background-color: #29B6D2; color: white; padding: 15px; border-radius: 5px 5px 0 0;">
                    <h2 style="margin: 0;">SmartyGym Support</h2>
                  </div>
                  
                  <div style="padding: 20px; background-color: #f9f9f9;">
                    <p style="font-size: 16px; color: #333; white-space: pre-line; line-height: 1.6;">${aiData.response.replace(/\n/g, '<br>')}</p>
                  </div>
                  
                  <div style="padding: 15px; background-color: #f0f0f0; border-radius: 0 0 5px 5px; font-size: 12px; color: #666;">
                    <p style="margin: 0;">If you have any follow-up questions, simply reply to this email and our team will be happy to help!</p>
                  </div>
                </div>
              `,
            });
            console.log("AI response email sent to customer:", email);
            await logEmailDelivery({
              toEmail: email,
              messageType: "contact-ai-response",
              status: "sent",
              resendId: aiSendResult?.data?.id ?? null,
            });

            // Log AI response to history if messageId provided
            if (messageId) {
              const { error: contactUpdateError } = await supabaseAdmin
                .from('contact_messages')
                .update({
                  response: aiData.response,
                  responded_at: new Date().toISOString(),
                  status: 'responded',
                  response_read_at: null,
                })
                .eq('id', messageId);

              if (contactUpdateError) {
                console.error("Failed to save AI response to contact message:", contactUpdateError);
              }

              const { error: aiHistoryError } = await supabaseAdmin
                .from('contact_message_history')
                .insert({
                  contact_message_id: messageId,
                  message_type: 'ai_response',
                  content: aiData.response,
                  sender: 'system'
                });

              if (aiHistoryError) {
                console.error("Failed to log AI response to history:", aiHistoryError);
              } else {
                console.log("AI response logged to message history");
              }
            }
          }
        } else {
          console.error("AI response call failed:", await aiResponse.text());
        }
      } catch (aiError) {
        console.error("Error calling AI response:", aiError);
        // Don't fail the whole request if AI fails
      }

      // Forward to admin's personal email with categorization AND AI response
      try {
        const categoryLabel = safeUserStatus || 'Guest';
        
        // Build AI response section for admin email
        const aiResponseSection = aiResponseContent 
          ? `
            <div style="margin: 20px 0;">
              <p style="font-weight: bold; color: #333; margin-bottom: 10px;">📤 Response Sent to Customer:</p>
              <div style="background-color: #e8f5e9; padding: 15px; border-left: 4px solid #4caf50; border-radius: 0 5px 5px 0;">
                <p style="color: #333; white-space: pre-line; line-height: 1.6; margin: 0;">${aiResponseContent.replace(/\n/g, '<br>')}</p>
              </div>
            </div>
          `
          : `
            <div style="margin: 20px 0; padding: 15px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 0 5px 5px 0;">
              <p style="margin: 0; color: #856404;"><strong>⚠️ Note:</strong> AI response could not be generated. Customer only received the auto-reply.</p>
            </div>
          `;

        const adminFwdResult = await resend.emails.send({
          from: "SmartyGym Contact <notifications@smartygym.com>",
          to: [adminEmail],
          replyTo: email,
          subject: `[SmartyGym ${categoryLabel}] ${safeSubject}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background-color: #29B6D2; color: white; padding: 15px; border-radius: 5px 5px 0 0;">
                <h2 style="margin: 0;">New Contact Form Submission</h2>
                <p style="margin: 5px 0 0 0; opacity: 0.9;">User Type: <strong>${categoryLabel}</strong></p>
              </div>
              
              <div style="background-color: #f5f5f5; padding: 20px; border-radius: 0 0 5px 5px;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #333; width: 100px;">From:</td>
                    <td style="padding: 8px 0; color: #333;">${safeName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #333;">Email:</td>
                    <td style="padding: 8px 0;"><a href="mailto:${safeEmail}" style="color: #29B6D2;">${safeEmail}</a></td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #333;">Subject:</td>
                    <td style="padding: 8px 0; color: #333;">${safeSubject}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #333;">Status:</td>
                    <td style="padding: 8px 0;"><span style="background-color: #d4af37; color: white; padding: 2px 8px; border-radius: 3px; font-size: 12px;">${categoryLabel}</span></td>
                  </tr>
                </table>
              </div>
              
              <div style="margin: 20px 0;">
                <p style="font-weight: bold; color: #333; margin-bottom: 10px;">📥 Original Message:</p>
                <div style="background-color: #fff; padding: 15px; border-left: 4px solid #29B6D2; border-radius: 0 5px 5px 0;">
                  ${safeMessage}
                </div>
              </div>
              
              ${aiResponseSection}
              
              <div style="margin-top: 20px; padding: 15px; background-color: #f0f0f0; border-radius: 5px;">
                <p style="margin: 0; font-size: 14px; color: #666;">
                  <strong>Quick Actions:</strong> Reply directly to this email to respond to the user.
                </p>
              </div>
              
              <div style="margin-top: 20px; color: #999; font-size: 11px;">
                <p>Forwarded from SmartyGym Contact Form • ${new Date().toLocaleString('en-CY', { timeZone: 'Europe/Nicosia' })} Cyprus Time</p>
              </div>
            </div>
          `,
        });
        console.log(`Forward email sent to ${adminEmail} with AI response included`);
        await logEmailDelivery({
          toEmail: adminEmail,
          messageType: "contact-admin-forward",
          status: "sent",
          resendId: adminFwdResult?.data?.id ?? null,
          metadata: { from_email: email, subject: safeSubject, category: categoryLabel },
        });
      } catch (forwardError) {
        console.error("Failed to forward email:", forwardError);
        await logEmailDelivery({
          toEmail: adminEmail,
          messageType: "contact-admin-forward",
          status: "failed",
          errorMessage: forwardError instanceof Error ? forwardError.message : String(forwardError),
        });
        // Don't fail the whole request if forward fails
      }
    } catch (autoReplyError) {
      console.error("Failed to send auto-reply:", autoReplyError);
      // Don't fail the whole request if auto-reply fails
    }

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-contact-email function:", error);
    return new Response(
      JSON.stringify({ error: 'Failed to send message. Please try again.' }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
