// ============================================================
// SmartyGym pricing — single source of truth.
// Active membership: Premium Monthly (€9.99/month, recurring).
// Plus standalone purchases and Corporate plans.
//
// Lifetime (€89.99 one-time), Gold (€9.99/mo) and Platinum (€89.89/yr) are
// LEGACY products retained in Stripe for historical / refund / grandfather
// handling only. Never offer them for new purchases.
// ============================================================

export const SUBSCRIPTION_PRICES = {
  premium_monthly: 9.99, // €9.99/month recurring
  lifetime: 89.99,       // [LEGACY] historical grandfathered price — kept for analytics/revenue calcs
} as const;

// Stripe price IDs — single source of truth.
// Edge functions have their own copy (Deno cannot import from src/).
export const STRIPE_PRICE_IDS = {
  premium_monthly: 'price_1Tr93GIxQYg9inGKhIZLvoB2', // Premium Monthly €9.99/mo

  // Corporate plans
  corporate_dynamic:    'price_1TzXU6IxQYg9inGKSvUkoVxG',
  corporate_power:      'price_1TzXUfIxQYg9inGKr4DRiEg7',
  corporate_elite:      'price_1TzXVDIxQYg9inGKGBr5prVs',
  corporate_enterprise: 'price_1TzXVUIxQYg9inGKOvbKdfr4',
} as const;

export type StripePlanKey = keyof typeof STRIPE_PRICE_IDS;

export const SUBSCRIPTION_BILLING_PERIODS = {
  premium_monthly: 'monthly',
} as const;

// Legacy Stripe price IDs — kept for webhook/refund/grandfather recognition only.
// Do NOT use these to initiate new checkouts.
export const LEGACY_STRIPE_PRICE_IDS = {
  lifetime: 'price_1ThP4MIxQYg9inGKAUQEJ0tD', // [LEGACY] Lifetime €89.99 one-time
  gold:     'price_1SJ9q1IxQYg9inGKZzxxqPbD',
  platinum: 'price_1SJ9qGIxQYg9inGKFbgqVRjj',
} as const;

export const CORPORATE_PRICES = {
  dynamic: 699,      // €699/year
  power: 799,        // €799/year
  elite: 899,        // €899/year
  enterprise: 999,   // €999/year
} as const;

// Stripe Product IDs for SmartyGym products only
// Used to filter Stripe revenue to only SmartyGym sales
export const OUR_STRIPE_PRODUCT_IDS = [
  // Active subscription product
  'prod_UqU78UzgA2ckcP', // SmartyGym Premium Monthly (€9.99/mo)
  // Legacy products (no longer offered; kept for revenue/refund analytics)
  'prod_TFfAcybp438BH6', // [LEGACY] Smarty Gym Gold Plan
  'prod_TFfAPp1tq7RdUk', // [LEGACY] Smarty Gym Platinum Plan
  'prod_UgmdX60UPJxWeS', // [LEGACY] Smarty Gym Lifetime Membership
  // Corporate products
  'prod_TZATAcAlqgc1P7', // Smarty Dynamic
  'prod_TZATDsKcDvMtHc', // Smarty Power
  'prod_TZATGTAsKalmCn', // Smarty Elite
  'prod_TZATUtaS2jhgtK', // Smarty Enterprise
  // Standalone Training Programs
  'prod_TiX1jpVVZtLG9C', // Run Your First 5K
  'prod_TiX1ILxJNwxNyv', // 90-Day Shred Challenge
  'prod_TiX1Bj3U8PC1Po', // 90-Day Mass Protocol
  // Micro-Workouts (5-min premium workouts)
  'prod_TjopnTQosm7AUQ', // Desk Breaker
  'prod_TjopExBHYK3UhQ', // Stairway Sprint
  'prod_Tjopvzgs8icm3z', // Burpee Blitz
  'prod_TjopTldP5F5Xwf', // Squat Storm
  'prod_TjopWbmTI878ef', // Climber Chaos
  'prod_TjopAbpxfOd6sE', // Jump Starter
  'prod_Tjopn2AbGW0NfY', // Push-Up Power
  'prod_TjoppqilBxhY6O', // Sofa Surge
  'prod_Tjop4dLWFq3KND', // Core Crusher
  'prod_TjopcVZXEkguxn', // Wall Warrior
] as const;
