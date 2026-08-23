import { SetMetadata } from '@nestjs/common';

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyPrefix?: string;
}

export const RATE_LIMIT_KEY = 'rate_limit_options';

/**
 * RateLimit Decorator
 *
 * Configure sliding window rate limiting for a specific route
 */
export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);
