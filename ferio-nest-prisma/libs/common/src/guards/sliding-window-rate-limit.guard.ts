import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../constants/redis.constants';
import {
  RATE_LIMIT_KEY,
  RateLimitOptions,
} from '../decorators/rate-limit.decorator';
import { StructuredLogger } from '../utils/structured-logger';

/**
 * Sliding Window Rate Limit Guard
 *
 *
 *
 * High-performance rate limiting using Redis Sorted Sets
 * Features:
 * ✅ Sliding window algorithm (no burst at window edges)
 * ✅ Atomic operations via Redis Pipeline
 * ✅ Fail-open logic for high availability
 * ✅ Standard X-RateLimit headers
 * ✅ Custom route-based presets
 */
@Injectable()
export class SlidingWindowRateLimitGuard implements CanActivate {
  private readonly logger = new StructuredLogger(
    SlidingWindowRateLimitGuard.name,
  );

  constructor(
    private readonly reflector: Reflector,
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis | null,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<RateLimitOptions>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );

    // If no options provided, bypass rate limiting
    if (!options) {
      return true;
    }

    // If Redis is down, fail open (allow request)
    if (!this.redisClient) {
      this.logger.warn('rate_limit_bypassed', {
        reason: 'REDIS_UNAVAILABLE',
        keyPrefix: options.keyPrefix || 'default',
      });
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Generate unique identifier
    const userId = request.user?.userId;
    const ip = request.ip || request.connection.remoteAddress || 'unknown';
    const identifier = userId ? `user:${userId}` : `ip:${ip}`;

    const keyPrefix = options.keyPrefix || 'default';
    const key = `ratelimit:${keyPrefix}:${identifier}`;

    try {
      const now = Date.now();
      const windowStart = now - options.windowMs;

      // Atomic sliding window logic
      const pipeline = this.redisClient.multi();

      // 1. Remove entries outside the sliding window
      pipeline.zremrangebyscore(key, 0, windowStart);

      // 2. Add current request
      pipeline.zadd(key, now, `${now}-${Math.random()}`);

      // 3. Set expiry to clean up old keys
      pipeline.expire(key, Math.ceil(options.windowMs / 1000) + 1);

      // 4. Count remaining entries in window
      pipeline.zcard(key);

      // 5. Get oldest entry score in current window for exact retry calculation
      pipeline.zrange(key, 0, 0, 'WITHSCORES');

      const results = await pipeline.exec();

      if (!results) {
        return true; // Fail open
      }

      // results is array of [error, result]
      // index 3 is zcard result
      const count = results[3][1] as number;
      const remaining = Math.max(0, options.max - count);
      const reset = Math.ceil((now + options.windowMs) / 1000);

      // Set standard headers
      response.set('X-RateLimit-Limit', String(options.max));
      response.set('X-RateLimit-Remaining', String(remaining));
      response.set('X-RateLimit-Reset', String(reset));

      if (count > options.max) {
        let retryAfterSeconds = Math.ceil(options.windowMs / 1000);
        try {
          const zrangeResult = results[4]?.[1] as string[] | undefined;
          if (Array.isArray(zrangeResult) && zrangeResult.length >= 2) {
            const oldestScore = Number(zrangeResult[1]);
            if (!Number.isNaN(oldestScore) && oldestScore > 0) {
              const remainingMs = oldestScore + options.windowMs - now;
              retryAfterSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
            }
          }
        } catch {}

        const durationText = this.formatDuration(retryAfterSeconds);
        response.set('Retry-After', String(retryAfterSeconds));

        this.logger.warn('authentication_rate_limit_exceeded', {
          keyPrefix,
          userId,
          requestCount: count,
          requestLimit: options.max,
          windowMs: options.windowMs,
          retryAfterSeconds,
        });

        throw new HttpException(
          {
            success: false,
            message: `Too many requests, please slow down. Try again in ${durationText}.`,
            retryAfter: `${retryAfterSeconds}s`,
            retryAfterSeconds,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      return true;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('rate_limit_evaluation_failed', error, {
        keyPrefix,
      });
      return true; // Fail open for any other errors
    }
  }

  private formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${seconds} second${seconds === 1 ? '' : 's'}`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSecs = seconds % 60;
    if (remainingSecs === 0) {
      return `${minutes} minute${minutes === 1 ? '' : 's'}`;
    }
    return `${minutes} minute${minutes === 1 ? '' : 's'} ${remainingSecs} second${remainingSecs === 1 ? '' : 's'}`;
  }
}
