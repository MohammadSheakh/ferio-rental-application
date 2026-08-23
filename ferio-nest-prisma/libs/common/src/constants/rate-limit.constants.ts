/**
 * Global Rate Limit Presets
 *
 * Centralized rate limit configurations matching the express-example logic.
 * These are used by the SlidingWindowRateLimitGuard.
 */

export const GLOBAL_RATE_LIMITS = {
  user: {
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    keyPrefix: 'api_user',
  },
  admin: {
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    keyPrefix: 'api_admin',
  },
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts per 15 minutes
    keyPrefix: 'auth_attempt',
  },
  strict: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    keyPrefix: 'strict_op',
  },
} as const;
