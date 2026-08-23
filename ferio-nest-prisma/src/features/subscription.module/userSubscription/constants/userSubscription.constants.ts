/**
 * UserSubscription Constants
 * Subscription status types and configuration
 *
 * @version 1.0.0 (NestJS Migration)
 * @author Senior Engineering Team
 */

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
 * Default values for user subscriptions
 */
export const USER_SUBSCRIPTION_DEFAULTS = {
  /** Default billing cycle */
  BILLING_CYCLE: 0,

  /** Default auto-renew */
  IS_AUTO_RENEWED: false,

  /** Default cancelled at period end */
  CANCELLED_AT_PERIOD_END: false,

  /** Default status */
  STATUS: UserSubscriptionStatus.processing,

  /** Default is deleted */
  IS_DELETED: false,

  /** Default payment gateway */
  PAYMENT_GATEWAY: 'stripe',

  /** Default purchase platform */
  PURCHASE_PLATFORM: 'web',
} as const;

/**
 * Subscription lifecycle events for tracking
 */
export const SUBSCRIPTION_EVENTS = {
  /** Subscription created */
  CREATED: 'subscription:created',

  /** Subscription activated */
  ACTIVATED: 'subscription:activated',

  /** Subscription renewed */
  RENEWED: 'subscription:renewed',

  /** Subscription cancelled */
  CANCELLED: 'subscription:cancelled',

  /** Subscription expired */
  EXPIRED: 'subscription:expired',

  /** Trial started */
  TRIAL_STARTED: 'subscription:trial_started',

  /** Trial ended */
  TRIAL_ENDED: 'subscription:trial_ended',
} as const;

/**
 * Export legacy constants
 */
export const UserSubscriptionStatusType = UserSubscriptionStatus;
