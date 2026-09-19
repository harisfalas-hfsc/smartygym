/**
 * Central Notification Types Registry
 * =====================================
 * 
 * CRITICAL: All edge functions MUST import message types from this file.
 * This prevents message type collisions and ensures consistency across the system.
 * 
 * Each message_type MUST be unique and descriptive of its source.
 * 
 * IMPORTANT: The daily WOD and Smarty Ritual are sent TOGETHER in one notification
 * via `send-morning-notifications` at 07:00 Cyprus time. Use MORNING_NOTIFICATION type.
 * 
 * Last updated: 2025-12-31
 */

/**
 * All notification message types used across the platform.
 * Each type is unique and maps to a specific notification source.
 */
export const MESSAGE_TYPES = {
  // ============================================
  // DAILY AUTOMATED NOTIFICATIONS
  // ============================================
  
  /** Combined Morning Notification - WOD + Ritual (Daily 07:00 Cyprus / 05:00 UTC) */
  MORNING_NOTIFICATION: 'morning_notification',
  
  /** Daily Workout of the Day notification (Legacy - use MORNING_NOTIFICATION) */
  WOD_NOTIFICATION: 'wod_notification',
  
  /** Daily Smarty Ritual notification (Legacy - use MORNING_NOTIFICATION) */
  DAILY_RITUAL: 'daily_ritual',
  
  /** Check-in reminder notifications (Daily 06:00 & 18:00 UTC) */
  CHECKIN_REMINDER: 'checkin_reminder',
  
  // ============================================
  // WEEKLY AUTOMATED NOTIFICATIONS
  // ============================================
  
  /** Monday Motivation (Mondays 08:00 UTC) */
  MONDAY_MOTIVATION: 'motivational_weekly',
  
  /** Weekly Activity Report (Mondays 07:00 UTC) */
  WEEKLY_ACTIVITY_REPORT: 'weekly_activity_report',
  
  // ============================================
  // SUBSCRIPTION & BILLING NOTIFICATIONS
  // ============================================
  
  /** Subscription renewal reminder (Daily 09:00 UTC) */
  RENEWAL_REMINDER: 'renewal_reminder',
  
  /** Subscription cancellation notification */
  CANCELLATION: 'cancellation',
  
  /** Subscription expired notification */
  SUBSCRIPTION_EXPIRED: 'subscription_expired',
  
  /** Payment failed notification */
  PAYMENT_FAILED: 'payment_failed',
  
  /** Re-engagement for expired users */
  REACTIVATION: 'reactivation',
  
  /** Renewal thank you after successful payment */
  RENEWAL_THANK_YOU: 'renewal_thank_you',
  
  
  // ============================================
  // USER LIFECYCLE NOTIFICATIONS
  // ============================================
  
  /** Welcome email for new signups */
  WELCOME: 'welcome',
  
  /** Welcome Onboarding Guide (5 days after premium signup) */
  WELCOME_ONBOARDING: 'welcome_onboarding',
  
  /** First purchase thank you */
  FIRST_PURCHASE: 'first_purchase',
  
  // ============================================
  // PURCHASE NOTIFICATIONS
  // ============================================
  
  /** Subscription purchase confirmation */
  PURCHASE_SUBSCRIPTION: 'purchase_subscription',
  
  /** Workout purchase confirmation */
  PURCHASE_WORKOUT: 'purchase_workout',
  
  /** Program purchase confirmation */
  PURCHASE_PROGRAM: 'purchase_program',
  
  /** Ritual purchase confirmation */
  PURCHASE_RITUAL: 'purchase_ritual',
  
  /** Shop product purchase confirmation */
  PURCHASE_SHOP_PRODUCT: 'purchase_shop_product',
  
  // ============================================
  // CONTENT NOTIFICATIONS (Bulk/New Content)
  // ============================================
  
  /** New workout(s) added notification */
  NEW_WORKOUT: 'announcement_new_workout',
  
  /** New program(s) added notification */
  NEW_PROGRAM: 'announcement_new_program',
  
  /** New blog article notification */
  NEW_ARTICLE: 'announcement_new_article',
  
  /** Mixed content update notification */
  CONTENT_UPDATE: 'announcement_update',
  
  // ============================================
  // LEGACY PURCHASE NOTIFICATIONS (for templates)
  // ============================================
  
  /** Legacy workout purchase confirmation template */
  PURCHASE_CONFIRMATION_WORKOUT: 'purchase_confirmation_workout',
  
  /** Legacy program purchase confirmation template */
  PURCHASE_CONFIRMATION_PROGRAM: 'purchase_confirmation_program',
  
  /** Legacy ritual purchase confirmation template */
  PURCHASE_CONFIRMATION_RITUAL: 'purchase_confirmation_ritual',
  
  /** Legacy shop product purchase confirmation template */
  PURCHASE_CONFIRMATION_PRODUCT: 'purchase_confirmation_product',
  
  // ============================================
  // PROGRAM/DELIVERY NOTIFICATIONS
  // ============================================
  
  /** Program delivery confirmation */
  PROGRAM_DELIVERED: 'program_delivered',
  
  /** Program status update */
  PROGRAM_STATUS: 'status_update',

  /** A member-created workout has finished building */
  CUSTOM_WORKOUT_READY: 'custom_workout_ready',
  
  // ============================================
  // SUPPORT & ADMIN NOTIFICATIONS
  // ============================================
  
  /** Contact form response notification */
  SUPPORT: 'support',
  
  /** Admin mass notification */
  MASS_NOTIFICATION: 'mass_notification',
  
  /** Unified announcement from admin */
  UNIFIED_ANNOUNCEMENT: 'unified_announcement',
  
  // ============================================
  // CORPORATE NOTIFICATIONS
  // ============================================
  
  /** Corporate member added notification */
  CORPORATE_MEMBER_ADDED: 'corporate_member_added',
  
  /** Corporate subscription created */
  CORPORATE_SUBSCRIPTION: 'corporate_subscription',

  // ============================================
  // GOAL ACHIEVEMENT NOTIFICATIONS
  // ============================================
  
  /** Goal achievement celebration */
  GOAL_ACHIEVEMENT: 'goal_achievement',

} as const;

/**
 * Type for message type values
 */
export type MessageType = typeof MESSAGE_TYPES[keyof typeof MESSAGE_TYPES];

/**
 * Mapping of message types to their sources for audit verification
 */
export const MESSAGE_TYPE_SOURCES: Record<string, { source: string; schedule: string }> = {
  [MESSAGE_TYPES.MORNING_NOTIFICATION]: { source: 'send-morning-notifications', schedule: 'Daily 05:00 UTC (07:00 Cyprus)' },
  [MESSAGE_TYPES.WOD_NOTIFICATION]: { source: 'send-morning-notifications', schedule: 'Daily 05:00 UTC (07:00 Cyprus) — combined morning message' },
  [MESSAGE_TYPES.DAILY_RITUAL]: { source: 'send-morning-notifications', schedule: 'Daily 05:00 UTC (07:00 Cyprus) — combined morning message' },
  [MESSAGE_TYPES.CHECKIN_REMINDER]: { source: 'send-checkin-reminders', schedule: 'Daily 06:00 & 18:00 UTC' },
  [MESSAGE_TYPES.MONDAY_MOTIVATION]: { source: 'send-weekly-motivation', schedule: 'Mondays 08:00 UTC' },
  [MESSAGE_TYPES.WEEKLY_ACTIVITY_REPORT]: { source: 'send-weekly-activity-report', schedule: 'Mondays 07:00 UTC' },
  [MESSAGE_TYPES.RENEWAL_REMINDER]: { source: 'send-renewal-reminders', schedule: 'Daily 09:00 UTC' },
  [MESSAGE_TYPES.CANCELLATION]: { source: 'stripe-webhook', schedule: 'On cancellation' },
  [MESSAGE_TYPES.SUBSCRIPTION_EXPIRED]: { source: 'send-subscription-expired-notifications', schedule: 'Daily 10:00 UTC' },
  [MESSAGE_TYPES.WELCOME]: { source: 'send-welcome-email', schedule: 'On signup' },
  [MESSAGE_TYPES.WELCOME_ONBOARDING]: { source: 'send-welcome-onboarding', schedule: 'Daily 10:00 UTC (5 days after premium signup)' },
  [MESSAGE_TYPES.NEW_WORKOUT]: { source: 'send-new-content-notifications', schedule: 'On new content' },
  [MESSAGE_TYPES.NEW_PROGRAM]: { source: 'send-new-content-notifications', schedule: 'On new content' },
  [MESSAGE_TYPES.NEW_ARTICLE]: { source: 'send-new-content-notifications', schedule: 'On new content' },
  [MESSAGE_TYPES.CONTENT_UPDATE]: { source: 'send-new-content-notifications', schedule: 'On new content' },
  [MESSAGE_TYPES.REACTIVATION]: { source: 'send-reengagement-emails', schedule: 'Wednesdays 08:00 UTC' },
  [MESSAGE_TYPES.SUPPORT]: { source: 'send-contact-response-notification', schedule: 'On response' },
  [MESSAGE_TYPES.PROGRAM_DELIVERED]: { source: 'send-new-content-notifications', schedule: 'On delivery' },
  [MESSAGE_TYPES.CUSTOM_WORKOUT_READY]: { source: 'create-custom-workout', schedule: 'On completion' },
};

/**
 * Helper to get the correct message type for a notification
 * This centralizes all message type logic in one place
 */
export function getMessageType(notificationType: string): string {
  const typeMap: Record<string, string> = {
    // Map notification type names to correct message types
    'ritual': MESSAGE_TYPES.DAILY_RITUAL,
    'daily_ritual': MESSAGE_TYPES.DAILY_RITUAL,
    'checkin': MESSAGE_TYPES.CHECKIN_REMINDER,
    'checkin_reminder': MESSAGE_TYPES.CHECKIN_REMINDER,
    'motivation': MESSAGE_TYPES.MONDAY_MOTIVATION,
    'monday_motivation': MESSAGE_TYPES.MONDAY_MOTIVATION,
    'activity_report': MESSAGE_TYPES.WEEKLY_ACTIVITY_REPORT,
    'weekly_report': MESSAGE_TYPES.WEEKLY_ACTIVITY_REPORT,
    'renewal': MESSAGE_TYPES.RENEWAL_REMINDER,
    'welcome': MESSAGE_TYPES.WELCOME,
    'cancellation': MESSAGE_TYPES.CANCELLATION,
  };
  
  return typeMap[notificationType] || notificationType;
}
