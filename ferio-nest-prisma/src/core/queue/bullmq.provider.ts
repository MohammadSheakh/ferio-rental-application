import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { getRedisOptions } from '../database/redis/redis.provider';
import { QUEUE_NAMES } from './bullmq.constants';

/**
 * BullMQ Queues Registration
 *
 */
export const BullMQQueues = BullModule.registerQueueAsync(
  {
    name: QUEUE_NAMES.NOTIFICATION,
    useFactory: (configService: ConfigService) => ({
      connection: getRedisOptions(configService),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    }),
    inject: [ConfigService],
  },
  {
    name: QUEUE_NAMES.CONVERSATION_LAST_MESSAGE,
    useFactory: (configService: ConfigService) => ({
      connection: getRedisOptions(configService),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    }),
    inject: [ConfigService],
  },
  {
    name: QUEUE_NAMES.NOTIFY_PARTICIPANTS,
    useFactory: (configService: ConfigService) => ({
      connection: getRedisOptions(configService),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    }),
    inject: [ConfigService],
  },
  {
    name: QUEUE_NAMES.EMAIL,
    useFactory: (configService: ConfigService) => ({
      connection: getRedisOptions(configService),
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    }),
    inject: [ConfigService],
  },
);
