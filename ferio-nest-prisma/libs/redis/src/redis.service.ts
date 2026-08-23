import { Inject, Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis | null,
  ) {}

  /**
   * Get or set a value in cache
   * @param key Cache key
   * @param fetchFn Function to fetch data if not in cache
   * @param ttl TTL in seconds
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number,
  ): Promise<T> {
    if (!this.redisClient) {
      return await fetchFn();
    }

    try {
      const cached = await this.redisClient.get(key);
      if (cached) {
        return JSON.parse(cached) as T;
      }
    } catch (err) {
      this.logger.error(`Redis get error for key ${key}: ${err.message}`);
    }

    const data = await fetchFn();

    if (data !== null && data !== undefined) {
      try {
        await this.redisClient.set(key, JSON.stringify(data), 'EX', ttl);
      } catch (err) {
        this.logger.error(`Redis set error for key ${key}: ${err.message}`);
      }
    }

    return data;
  }

  async invalidate(key: string | string[]): Promise<void> {
    if (!this.redisClient) return;
    try {
      const keys = Array.isArray(key) ? key : [key];
      await this.redisClient.del(...keys);
    } catch (err) {
      this.logger.error(`Redis invalidate error: ${err.message}`);
    }
  }

  async getClient(): Promise<Redis | null> {
    return this.redisClient;
  }
}
