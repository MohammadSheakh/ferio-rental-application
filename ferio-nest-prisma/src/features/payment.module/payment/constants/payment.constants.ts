/**
 * Payment Module Constants
 * Centralized configuration for payment-related enums and types
 *
 * @version 1.0.0 (NestJS Migration)
 * @author Senior Engineering Team
 * @migration-date 26-03-29
 */

/**
 * Payment Gateway Enum
 * Represents available payment processing providers
 *
 * @example
 * // Use in schema validation
 * @Prop({ enum: Object.values(PaymentGateway) })
 * gateway: PaymentGateway;
 */
export enum PaymentGateway {
  /** Stripe - Primary gateway for web payments */
  stripe = 'stripe',

  /** PayPal - Alternative web gateway (future) */
  paypal = 'paypal',

  /** SSLCommerz - Bangladesh local gateway */
  sslcommerz = 'sslcommerz',

  /** RevenueCat - Mobile subscription gateway (iOS/Android) */
  revenuecat = 'revenuecat',

  /** None - No gateway (internal/cash) */
  none = 'none',
}

/**
 * Payment Status Enum
 * Tracks the lifecycle of a payment transaction
 */
export enum PaymentStatus {
  /** Payment initiated, awaiting confirmation */
  pending = 'pending',

  /** Payment being processed by gateway */
  processing = 'processing',

  /** Payment completed successfully */
  completed = 'completed',

  /** Payment failed (insufficient funds, declined, etc.) */
  failed = 'failed',

  /** Payment refunded to customer */
  refunded = 'refunded',

  /** Payment cancelled by user or merchant */
  cancelled = 'cancelled',

  /** Payment partially refunded */
  partially_refunded = 'partially_refunded',

  /** Payment disputed (chargeback) */
  disputed = 'disputed',
}

/**
 * Payment Environment Enum
 * RevenueCat specific - identifies sandbox vs production
 */
export enum PaymentEnvironment {
  /** RevenueCat sandbox environment (testing) */
  sandbox = 'sandbox',

  /** RevenueCat production environment (live) */
  production = 'production',
}

/**
 * Payment Platform Enum
 * RevenueCat specific - identifies user's platform
 */
export enum PaymentPlatform {
  /** iOS App Store */
  ios = 'ios',

  /** Google Play Store */
  android = 'android',

  /** Web browser (Stripe/SSLCommerz) */
  web = 'web',
}

/**
 * Currency Enum
 * Supported currencies for payment processing
 */
export enum Currency {
  /** US Dollar - Primary currency for Stripe */
  usd = 'usd',

  /** Bangladeshi Taka - For SSLCommerz */
  bdt = 'bdt',

  /** Euro - Future support */
  eur = 'eur',

  /** British Pound - Future support */
  gbp = 'gbp',
}

/**
 * Transaction Type Enum
 * Identifies what the payment is for
 */
export enum TransactionType {
  /** User subscription payment */
  userSubscription = 'userSubscription',

  /** Purchased journey (future feature) */
  purchasedJourney = 'purchasedJourney',

  /** Purchased admin capsule (future feature) */
  purchasedAdminCapsule = 'purchasedAdminCapsule',
}

/**
 * Payment Gateway Configuration
 * Environment-specific settings
 */
export const PAYMENT_CONFIG = {
  /** Stripe configuration */
  stripe: {
    /** API version */
    apiVersion: '2023-10-16',

    /** Webhook secret environment variable name */
    webhookSecretEnv: 'STRIPE_WEBHOOK_SECRET',

    /** Success URL route */
    successUrl: '/payment/success',

    /** Cancel URL route */
    cancelUrl: '/payment/cancel',
  },

  /** RevenueCat configuration */
  revenueCat: {
    /** Webhook secret environment variable name */
    webhookSecretEnv: 'REVENUECAT_WEBHOOK_SECRET',

    /** API key environment variable name */
    apiKeyEnv: 'REVENUECAT_API_KEY',
  },

  /** SSLCommerz configuration */
  sslcommerz: {
    /** Store ID environment variable name */
    storeIdEnv: 'SSL_STORE_ID',

    /** Store Password environment variable name */
    storePassEnv: 'SSL_STORE_PASSWD',

    /** Live mode flag */
    isLiveEnv: 'SSL_IS_LIVE',

    /** Success URL route */
    successUrl: '/payment/ssl/success',

    /** Cancel URL route */
    cancelUrl: '/payment/ssl/cancel',

    /** Failed URL route */
    failedUrl: '/payment/ssl/failed',
  },
} as const;

/**
 * Rate limits for payment operations
 * Prevents abuse and fraud
 */
export const PAYMENT_RATE_LIMITS = {
  /** Create payment session */
  CREATE_PAYMENT: {
    windowMs: 60000, // 1 minute
    max: 10, // 10 requests per minute
    message: 'Too many payment attempts, please try again later',
  },

  /** Webhook endpoints (higher limit for retries) */
  WEBHOOK: {
    windowMs: 60000, // 1 minute
    max: 100, // 100 requests per minute (gateways retry)
    message: 'Too many webhook requests',
  },

  /** General payment queries */
  GENERAL: {
    windowMs: 60000, // 1 minute
    max: 100, // 100 requests per minute
    message: 'Too many requests, please try again later',
  },
} as const;

/**
 * Cache configuration for payment operations
 */
export const PAYMENT_CACHE_CONFIG = {
  /** Redis key prefix */
  PREFIX: 'payment',

  /** Transaction detail cache TTL (5 minutes) */
  TRANSACTION_DETAIL_TTL: 300,

  /** Earnings summary cache TTL (10 minutes) */
  EARNINGS_SUMMARY_TTL: 600,

  /** User subscription status cache TTL (15 minutes) */
  SUBSCRIPTION_STATUS_TTL: 900,
} as const;

/**
 * Stripe-specific constants
 */
export const STRIPE_CONFIG = {
  /** Payment intent metadata keys */
  METADATA_KEYS: {
    /** User ID */
    USER_ID: 'userId',

    /** Reference ID (subscription, journey, etc.) */
    REFERENCE_ID: 'referenceId',

    /** Reference type */
    REFERENCE_TYPE: 'referenceType',

    /** Transaction ID */
    TRANSACTION_ID: 'transactionId',
  },

  /** Checkout session modes */
  MODE: {
    /** One-time payment */
    PAYMENT: 'payment',

    /** Recurring subscription */
    SUBSCRIPTION: 'subscription',
  },
} as const;

/**
 * RevenueCat-specific constants
 */
export const REVENUECAT_CONFIG = {
  /** Webhook event types */
  EVENT_TYPES: {
    /** First-time subscription purchase */
    INITIAL_PURCHASE: 'INITIAL_PURCHASE',

    /** Subscription renewed */
    RENEWAL: 'RENEWAL',

    /** Subscription cancelled */
    CANCELLATION: 'CANCELLATION',

    /** Subscription expired */
    EXPIRATION: 'EXPIRATION',

    /** Refund processed */
    REFUND: 'REFUND',

    /** Billing issue (payment failed) */
    BILLING_ISSUE: 'BILLING_ISSUE',

    /** General subscription event */
    SUBSCRIPTION: 'SUBSCRIPTION',
  },

  /** Product ID mappings (update based on RevenueCat setup) */
  PRODUCT_MAPPINGS: {
    'individual_monthly': 'individual',
    'individual_annual': 'individual',
    'business_monthly': 'business',
    'business_annual': 'business',
  },
} as const;

/**
 * Export legacy constants for backward compatibility
 */
export const TPaymentGateway = PaymentGateway;
export const TPaymentStatus = PaymentStatus;
export const TPaymentEnvironment = PaymentEnvironment;
export const TPaymentPlatform = PaymentPlatform;
export const TCurrency = Currency;
export const TTransactionFor = TransactionType;
