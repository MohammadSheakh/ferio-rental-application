/**
 * User Module Constants
 * 
 * 
 * 
 * Centralized configuration for cache TTLs, prefixes, and invalidation rules.
 */

export const USER_CACHE_CONFIG = {
  PREFIX: 'user',
  
  // TTL in seconds
  PROFILE: 900,      // 15 minutes
  STATISTICS: 300,   // 5 minutes
  
  // Invalidation mapping: action -> related cache patterns to clear
  INVALIDATION_PATTERNS: {
    PROFILE_UPDATED: (id: string) => [`user:${id}`, `user:stats:${id}`],
    USER_DELETED: (id: string) => [`user:${id}`, `user:stats:${id}`],
  }
} as const;

/**
 * User Rate Limit Presets
 */
export const USER_RATE_LIMITS = {
  // General profile access
  PROFILE_ACCESS: {
    windowMs: 60 * 1000, // 1 minute
    max: 60,
    keyPrefix: 'user_profile'
  },
  
  // Sensitive profile updates
  PROFILE_UPDATE: {
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    keyPrefix: 'user_update'
  }
} as const;
