/**
 * Subscription Module Constants
 * Centralized configuration for subscription-related enums and types
 *
 * @version 1.0.0 (NestJS Migration)
 * @author Senior Engineering Team
 * @migration-date 26-03-29
 */

/**
 * Subscription Type Enum
 * Represents different subscription tiers available
 *
 * @example
 * // Individual subscription for personal use
 * const type = SubscriptionType.individual;
 *
 * // Business subscriptions for teams
 * const type = SubscriptionType.business_starter;
 */
export enum SubscriptionType {
  /** Individual subscription for personal use */
  individual = 'individual',

  /** Business Starter tier (small teams) */
  business_starter = 'business_starter',

  /** Business Level 1 (medium teams) */
  business_level1 = 'business_level1',

  /** Business Level 2 (large teams) */
  business_level2 = 'business_level2',
}

/**
 * Initial Duration Enum
 * Defines the initial subscription period
 */
export enum InitialDuration {
  /** Monthly subscription */
  month = 'month',

  /** Yearly subscription */
  year = 'year',
}

/**
 * Renewal Frequency Enum
 * How often the subscription renews
 */
export enum RenewalFrequency {
  /** Monthly renewal */
  monthly = 'monthly',

  /** Yearly renewal */
  yearly = 'yearly',
}

/**
 * User Subscription Status Enum
 * Tracks the lifecycle state of a user's subscription
 */
export enum UserSubscriptionStatus {
  /** Subscription is being processed */
  processing = 'processing',

  /** Subscription is active and usable */
  active = 'active',

  /** Payment is past due, grace period */
  past_due = 'past_due',

  /** Subscription was cancelled by user */
  cancelled = 'cancelled',

  /** Payment failed, subscription unpaid */
  unpaid = 'unpaid',

  /** Subscription is incomplete (payment pending) */
  incomplete = 'incomplete',

  /** Subscription expired (incomplete_expired) */
  incomplete_expired = 'incomplete_expired',

  /** Currently in trial period */
  trialing = 'trialing',

  /** Payment failed (explicit status) */
  payment_failed = 'payment_failed',
}

/**
 * Payment Gateway Enum for Subscriptions
 * Which payment processor handles the subscription
 */
export enum SubscriptionPaymentGateway {
  /** Stripe for web payments */
  stripe = 'stripe',

  /** RevenueCat for mobile subscriptions */
  revenuecat = 'revenuecat',
}

/**
 * Purchase Channel Enum
 * Where the subscription was purchased
 */
export enum PurchaseChannel {
  /** Purchased via Stripe (web) */
  stripe = 'stripe',

  /** Purchased via RevenueCat (mobile) */
  revenuecat = 'revenuecat',

  /** Available on both platforms */
  both = 'both',
}

/**
 * Platform Enum
 * Which platform the subscription is available on
 */
export enum Platform {
  /** iOS App Store */
  ios = 'ios',

  /** Google Play Store */
  android = 'android',

  /** Web browser */
  web = 'web',
}

/**
 * Default values for subscriptions
 */
export const SUBSCRIPTION_DEFAULTS = {
  /** Default free trial enabled */
  FREE_TRIAL_ENABLED: true,

  /** Default free trial duration (7 days) */
  FREE_TRIAL_DURATION_DAYS: 7,

  /** Default initial duration */
  INITIAL_DURATION: InitialDuration.month,

  /** Default renewal frequency */
  RENEWAL_FREQUENCY: RenewalFrequency.monthly,

  /** Default currency */
  CURRENCY: 'usd',

  /** Default purchase channel */
  PURCHASE_CHANNEL: PurchaseChannel.stripe,

  /** Default subscription status */
  SUBSCRIPTION_STATUS: UserSubscriptionStatus.processing,

  /** Default auto-renew */
  IS_AUTO_RENEWED: false,

  /** Default cancelled at period end */
  CANCELLED_AT_PERIOD_END: false,

  /** Default is active */
  IS_ACTIVE: true,

  /** Default is deleted */
  IS_DELETED: false,

  /** Default billing cycle */
  BILLING_CYCLE: 0,
} as const;

/**
 * Cache configuration for subscription operations
 */
export const SUBSCRIPTION_CACHE_CONFIG = {
  /** Redis key prefix */
  PREFIX: 'subscription',

  /** Plan detail cache TTL (10 minutes) */
  PLAN_DETAIL_TTL: 600,

  /** User subscription cache TTL (5 minutes) */
  USER_SUBSCRIPTION_TTL: 300,

  /** Active plans cache TTL (15 minutes) */
  ACTIVE_PLANS_TTL: 900,
} as const;

/**
 * Rate limits for subscription operations
 */
export const SUBSCRIPTION_RATE_LIMITS = {
  /** Purchase subscription (prevents abuse) */
  PURCHASE: {
    windowMs: 300000, // 5 minutes
    max: 3, // 3 attempts per 5 minutes
    message: 'Too many subscription purchase attempts, please try again later',
  },

  /** Start free trial (prevents trial abuse) */
  FREE_TRIAL: {
    windowMs: 3600000, // 1 hour
    max: 1, // 1 trial per hour
    message: 'Free trial can only be started once',
  },

  /** General subscription queries */
  GENERAL: {
    windowMs: 60000, // 1 minute
    max: 100, // 100 requests per minute
    message: 'Too many requests, please try again later',
  },
} as const;

/**
 * Stripe configuration for subscriptions
 */
export const STRIPE_SUBSCRIPTION_CONFIG = {
  /** Subscription modes */
  MODE: {
    /** Subscription with trial */
    SUBSCRIPTION: 'subscription',

    /** One-time payment */
    PAYMENT: 'payment',
  },

  /** Metadata keys */
  METADATA_KEYS: {
    USER_ID: 'userId',
    SUBSCRIPTION_TYPE: 'subscriptionType',
    SUBSCRIPTION_PLAN_ID: 'subscriptionPlanId',
    REFERENCE_ID: 'referenceId',
    REFERENCE_FOR: 'referenceFor',
    CURRENCY: 'currency',
    AMOUNT: 'amount',
    PLAN_NICKNAME: 'planNickname',
  },

  /** Trial period (days) */
  TRIAL_PERIOD_DAYS: 7,
} as const;

/**
 * RevenueCat configuration for subscriptions
 */
export const REVENUECAT_SUBSCRIPTION_CONFIG = {
  /** Product identifier pattern */
  PRODUCT_IDENTIFIER_PATTERN: '{subscriptionType}_monthly',

  /** Package identifier pattern */
  PACKAGE_IDENTIFIER_PATTERN: 'monthly',

  /** Supported platforms */
  SUPPORTED_PLATFORMS: [Platform.ios, Platform.android],

  /** Environment */
  ENVIRONMENT: {
    PRODUCTION: 'production',
    SANDBOX: 'sandbox',
  },
} as const;

/**
 * Export legacy constants for backward compatibility
 */
export const TSubscription = SubscriptionType;
export const TInitialDuration = InitialDuration;
export const TRenewalFrequency = RenewalFrequency;
export const UserSubscriptionStatusType = UserSubscriptionStatus;
export const TSubscriptionPaymentGateway = SubscriptionPaymentGateway;
export const TPurchaseChannel = PurchaseChannel;
export const TPlatform = Platform;
