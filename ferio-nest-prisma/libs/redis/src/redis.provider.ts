import { Provider, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT, REDIS_PUB_CLIENT, REDIS_SUB_CLIENT } from './redis.constants';
import { ConfigService } from '@nestjs/config';

/**
 * Redis configuration options shared across the application
 */
export const getRedisOptions = (configService: ConfigService) => ({
  host: configService.get<string>('REDIS_HOST', 'localhost'),
  port: configService.get<number>('REDIS_PORT', 6379),
  password: configService.get<string>('REDIS_PASSWORD', '') || undefined,
  db: configService.get<number>('REDIS_DB', 0),
});

/**
 * Creates a Redis client with the given options and logger
 */
const createRedisClient = (options: any, logger: Logger, label: string) => {
  try {
    const client = new Redis({
      ...options,
      retryStrategy: (retries) => {
        if (retries > 10) {
          logger.error(`Max reconnection attempts reached for ${label}`);
          return null;
        }
        return Math.min(retries * 100, 3000);
      },
    });

    client.on('error', (err) => logger.error(`Redis Client (${label}) Error:`, err.message));
    client.on('connect', () => logger.log(`Redis Client (${label}) connected successfully`));

    return client;
  } catch (error) {
    logger.error(`Redis Client (${label}) connection failed:`, error.message);
    return null;
  }
};

/**
 * Redis Provider
 */
export const RedisProvider: Provider = {
  provide: REDIS_CLIENT,
  useFactory: (configService: ConfigService): Redis | null => {
    const logger = new Logger('RedisProvider');
    const options = getRedisOptions(configService);
    return createRedisClient(options, logger, 'Main');
  },
  inject: [ConfigService],
};

/**
 * Redis Pub Client Provider
 */
export const RedisPubProvider: Provider = {
  provide: REDIS_PUB_CLIENT,
  useFactory: (configService: ConfigService): Redis | null => {
    const logger = new Logger('RedisPubProvider');
    const options = getRedisOptions(configService);
    return createRedisClient(options, logger, 'Pub');
  },
  inject: [ConfigService],
};

/**
 * Redis Sub Client Provider
 */
export const RedisSubProvider: Provider = {
  provide: REDIS_SUB_CLIENT,
  useFactory: (configService: ConfigService): Redis | null => {
    const logger = new Logger('RedisSubProvider');
    const options = getRedisOptions(configService);
    return createRedisClient(options, logger, 'Sub');
  },
  inject: [ConfigService],
};
