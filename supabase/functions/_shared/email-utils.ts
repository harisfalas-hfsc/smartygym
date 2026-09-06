/**
 * Email utility functions for SmartyGym
 * Provides email deliverability improvements including proper headers, footers, and HTML conversion
 */
import { buildUnsubscribeUrl } from "./unsubscribe-token.ts";

// Email type mapping for specific unsubscribe links
export type EmailType = 
  | 'wod' 
  | 'ritual' 
  | 'monday_motivation' 
  | 'new_workout' 
  | 'new_program' 
  | 'new_article' 
  | 'weekly_activity' 
  | 'checkin_reminders';

/**
 * Generates email headers for improved deliverability
 * Includes List-Unsubscribe for one-click unsubscribe support (required by Gmail/Yahoo)
 */
export function getEmailHeaders(userEmail: string, emailType?: EmailType): Record<string, string> {
  const unsubscribeUrl = buildUnsubscribeUrl(
    "https://smartygym.com/unsubscribe",
    userEmail,
    emailType,
  );
  return {
    "List-Unsubscribe": `<${unsubscribeUrl}>, <mailto:unsubscribe@smartygym.com?subject=Unsubscribe>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    "X-Entity-Ref-ID": crypto.randomUUID(),
    "Reply-To": "admin@smartygym.com",
  };
}

/**
 * Generates a professional email footer with physical address and unsubscribe link
 * Required for CAN-SPAM and GDPR compliance
 */
export function getEmailFooter(userEmail: string, emailType?: EmailType): string {
  // One-click, signed unsubscribe link — same URL used in the List-Unsubscribe header.
  // (Previously this pointed at /unsubscribe-help, which only showed instructions.)
  const unsubscribeUrl = buildUnsubscribeUrl(
    "https://smartygym.com/unsubscribe",
    userEmail,
    emailType,
  );
  const manageUrl = `https://smartygym.com/userdashboard?tab=messages`;
  
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 32px;">
      <tr>
        <td style="border-top: 1px solid #eeeeee; padding-top: 24px;">
          <p style="font-size: 13px; color: #666666; line-height: 1.6; margin: 0 0 12px 0; text-align: center;">
            SmartyGym – Your Expert Fitness Partner<br>
            Designed by Haris Falas, Sports Scientist (CSCS Certified)
          </p>
          <p style="font-size: 12px; color: #999999; line-height: 1.5; margin: 0; text-align: center;">
            <a href="${unsubscribeUrl}" style="color: #999999; text-decoration: underline;">Unsubscribe from this email</a> · 
            <a href="${manageUrl}" style="color: #999999; text-decoration: underline;">Manage all preferences</a> · 
            <a href="https://smartygym.com/privacy-policy" style="color: #999999; text-decoration: underline;">Privacy Policy</a>
          </p>
        </td>
      </tr>
    </table>
  `;
}

        </td>
      </tr>
    </table>
  `;
}

/**
 * Converts tiptap HTML classes to inline-styled email HTML
 * Email clients don't understand CSS classes, so we need inline styles
 */
export function convertTiptapToEmailHtml(content: string): string {
  if (!content) return '';
  
  let html = content;
  
  // Convert tiptap paragraph classes to inline styles
  html = html.replace(/<p class="tiptap-paragraph">/g, '<p style="margin: 0 0 16px 0; line-height: 1.6;">');
  html = html.replace(/<p class='tiptap-paragraph'>/g, '<p style="margin: 0 0 16px 0; line-height: 1.6;">');
  
  // Handle any remaining p tags without classes
  html = html.replace(/<p>/g, '<p style="margin: 0 0 16px 0; line-height: 1.6;">');
  
  // Convert strong/bold tags
  html = html.replace(/<strong>/g, '<strong style="font-weight: bold;">');
  
  // Convert em/italic tags
  html = html.replace(/<em>/g, '<em style="font-style: italic;">');
  
  // Convert underline
  html = html.replace(/<u>/g, '<u style="text-decoration: underline;">');
  
  // Convert heading tags
  html = html.replace(/<h1[^>]*>/g, '<h1 style="font-size: 24px; font-weight: bold; margin: 0 0 16px 0; color: #29B6D2;">');
  html = html.replace(/<h2[^>]*>/g, '<h2 style="font-size: 20px; font-weight: bold; margin: 0 0 14px 0; color: #29B6D2;">');
  html = html.replace(/<h3[^>]*>/g, '<h3 style="font-size: 18px; font-weight: bold; margin: 0 0 12px 0;">');
  
  // Convert lists
  html = html.replace(/<ul[^>]*>/g, '<ul style="margin: 0 0 16px 0; padding-left: 24px;">');
  html = html.replace(/<ol[^>]*>/g, '<ol style="margin: 0 0 16px 0; padding-left: 24px;">');
  html = html.replace(/<li[^>]*>/g, '<li style="margin-bottom: 8px;">');
  
  // Convert links - make them light blue colored
  html = html.replace(/<a /g, '<a style="color: #29B6D2; text-decoration: underline;" ');

  // Handle button-like links (CTA buttons in templates)
  html = html.replace(
    /style="[^"]*background[^"]*#d4af37[^"]*"/gi,
    'style="display: inline-block; background: #29B6D2; color: white; padding: 14px 28px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 16px;"'
  );
  
  // Remove any remaining class attributes that email clients won't understand
  html = html.replace(/ class="[^"]*"/g, '');
  html = html.replace(/ class='[^']*'/g, '');
  
  return html;
}

/**
 * Wraps content in a professional email template with proper footer
 */
export function wrapInEmailTemplate(subject: string, content: string, ctaUrl?: string, ctaText?: string): string {
  const emailContent = convertTiptapToEmailHtml(content);
  
  let ctaButton = '';
  if (ctaUrl && ctaText) {
    ctaButton = `
      <p style="margin-top: 24px;">
        <a href="${ctaUrl}" style="display: inline-block; background: #29B6D2; color: white; padding: 14px 28px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 16px;">${ctaText}</a>
      </p>
    `;
  }
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #ffffff;">
      <h1 style="color: #29B6D2; margin-bottom: 20px; font-size: 24px;">${subject}</h1>
      <div style="font-size: 16px; line-height: 1.6; color: #333333;">
        ${emailContent}
      </div>
      ${ctaButton}
      <hr style="margin: 32px 0; border: none; border-top: 1px solid #eeeeee;">
      <p style="font-size: 12px; color: #999999;">This email was sent from SmartyGym.</p>
    </div>
  `;
}

/**
 * Wraps content in a professional email template with proper footer and unsubscribe link
 * Use this for all user-facing emails for deliverability
 */
export function wrapInEmailTemplateWithFooter(
  subject: string, 
  content: string, 
  userEmail: string,
  ctaUrl?: string, 
  ctaText?: string,
  emailType?: EmailType
): string {
  const emailContent = convertTiptapToEmailHtml(content);
  const footer = getEmailFooter(userEmail, emailType);
  
  let ctaButton = '';
  if (ctaUrl && ctaText) {
    ctaButton = `
      <p style="margin-top: 24px; margin-bottom: 24px;">
        <a href="${ctaUrl}" style="display: inline-block; background: #29B6D2; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 16px;">${ctaText}</a>
      </p>
    `;
  }
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="x-apple-disable-message-reformatting">
      <title>${subject}</title>
      <style>
        @media only screen and (max-width: 600px) {
          .email-container { width: 100% !important; }
          .email-content { padding: 20px !important; }
        }
      </style>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5;">
        <tr>
          <td style="padding: 20px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px;" class="email-container">
              <tr>
                <td style="padding: 32px;" class="email-content">
                  <h1 style="color: #29B6D2; margin: 0 0 24px 0; font-size: 24px; font-weight: bold;">${subject}</h1>
                  <div style="font-size: 16px; line-height: 1.6; color: #333333;">
                    ${emailContent}
                  </div>
                  ${ctaButton}
                  ${footer}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

/**
 * Builds a complete email HTML document with header, content, and footer
 * For use in content notification emails
 */
export function buildCompleteEmailHtml(
  title: string,
  bodyContent: string,
  userEmail: string,
  buttons?: { text: string; url: string }[],
  emailType?: EmailType
): string {
  const footer = getEmailFooter(userEmail, emailType);
  
  const buttonHtml = buttons?.map(btn => `
    <a href="${btn.url}" style="display: inline-block; background: linear-gradient(135deg, #29B6D2, #5CD3E8); color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; margin-right: 10px; margin-bottom: 10px;">${btn.text}</a>
  `).join("") || "";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="x-apple-disable-message-reformatting">
      <title>${title}</title>
      <style>
        @media only screen and (max-width: 600px) {
          .email-container { width: 100% !important; }
          .email-content { padding: 24px 16px !important; }
          .email-header { padding: 24px 16px !important; }
        }
        img { max-width: 100%; height: auto; }
      </style>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5;">
        <tr>
          <td style="padding: 40px 20px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);" class="email-container">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); padding: 30px; text-align: center;" class="email-header">
                  <h1 style="color: #29B6D2; margin: 0; font-size: 28px; font-weight: bold;">SmartyGym</h1>
                  <p style="color: #999; margin: 8px 0 0 0; font-size: 14px;">Expert Fitness by Haris Falas</p>
                </td>
              </tr>
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;" class="email-content">
                  <h2 style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 24px;">${title}</h2>
                  ${bodyContent}
                  ${buttonHtml ? `<div style="margin-top: 30px;">${buttonHtml}</div>` : ""}
                  ${footer}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

/**
 * Checks if user has opted out of a specific email type
 * Returns true if user should NOT receive this email type
 */
export function isOptedOut(
  prefs: Record<string, any> | null | undefined,
  emailType: EmailType
): boolean {
  if (!prefs) return false;
  
  // Check global opt-out first
  if (prefs.opt_out_all === true) return true;
  
  // Map email type to preference key
  const prefKey = `email_${emailType}`;
  
  // If preference is explicitly set to false, user is opted out
  if (prefs[prefKey] === false) return true;
  
  // Legacy support for checkin_reminders
  if (emailType === 'checkin_reminders' && prefs.checkin_reminders === false) return true;
  
  return false;
}
