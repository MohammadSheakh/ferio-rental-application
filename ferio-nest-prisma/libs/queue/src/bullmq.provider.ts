import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
// import { getRedisOptions } from '../database/redis/redis.provider';
import { QUEUE_NAMES } from './bullmq.constants';
import { getRedisOptions } from '@app/redis';

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
  {
    name: QUEUE_NAMES.RECONCILIATION,
    useFactory: (configService: ConfigService) => ({
      connection: getRedisOptions(configService),
      prefix: configService.get<string>('QUEUE_PREFIX', 'bullmq'),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 60000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    }),
    inject: [ConfigService],
  },
  {
    name: QUEUE_NAMES.COURIER_CALLBACK,
    useFactory: (configService: ConfigService) => ({
      connection: getRedisOptions(configService),
      prefix: configService.get<string>('QUEUE_PREFIX', 'bullmq'),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 30000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    }),
    inject: [ConfigService],
  },
  {
    name: QUEUE_NAMES.COURIER_POLL,
    useFactory: (configService: ConfigService) => ({
      connection: getRedisOptions(configService),
      prefix: configService.get<string>('QUEUE_PREFIX', 'bullmq'),
      defaultJobOptions: {
        attempts: 4,
        backoff: { type: 'exponential', delay: 60000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    }),
    inject: [ConfigService],
  },
  {
    name: QUEUE_NAMES.TRANSACTIONAL_MESSAGE,
    useFactory: (configService: ConfigService) => ({
      connection: getRedisOptions(configService),
      prefix: configService.get<string>('QUEUE_PREFIX', 'bullmq'),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 60000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    }),
    inject: [ConfigService],
  },
  {
    name: QUEUE_NAMES.PAYMENT_RECOVERY,
    useFactory: (configService: ConfigService) => ({
      connection: getRedisOptions(configService),
      prefix: configService.get<string>('QUEUE_PREFIX', 'bullmq'),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 30000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    }),
    inject: [ConfigService],
  },
);
