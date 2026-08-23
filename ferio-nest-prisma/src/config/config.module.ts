// configModule import

import { Module, Global } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

/**
 * Config Module
 *
 * 📚 INDUSTRY STANDARD IMPLEMENTATION
 *
 * Global module providing configuration via environment variables
 * with validation
 *
 * Features:
 * ✅ Global module (available everywhere)
 * ✅ Environment variable validation
 * ✅ Default values
 * ✅ Type safety
 */
@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validate: (config) => {
        // Required variables
        const required = [
          'DATABASE_URL',
          'JWT_ACCESS_SECRET',
          'JWT_REFRESH_SECRET',
          'REDIS_HOST',
        ];
        const missing = required.filter((key) => !config[key]);

        if (missing.length > 0) {
          throw new Error(
            `Missing required environment variables: ${missing.join(', ')}`,
          );
        }

        // Validation rules
        if (config.JWT_ACCESS_SECRET && config.JWT_ACCESS_SECRET.length < 32) {
          throw new Error(
            'JWT_ACCESS_SECRET must be at least 32 characters for security',
          );
        }

        if (
          config.JWT_REFRESH_SECRET &&
          config.JWT_REFRESH_SECRET.length < 32
        ) {
          throw new Error(
            'JWT_REFRESH_SECRET must be at least 32 characters for security',
          );
        }

        if (
          config.JWT_ACCESS_EXPIRY &&
          !/^\d+[smhd]$/.test(config.JWT_ACCESS_EXPIRY)
        ) {
          throw new Error(
            'JWT_ACCESS_EXPIRY must be in format: number + s/m/h/d (e.g., 15m)',
          );
        }

        const redisPort = Number(config.REDIS_PORT || 6379);
        if (
          !Number.isInteger(redisPort) ||
          redisPort < 1 ||
          redisPort > 65535
        ) {
          throw new Error('REDIS_PORT must be a valid port number (1-65535)');
        }

        config.REDIS_PORT = redisPort;
        config.PORT = Number(config.PORT || 6733);

        const scheduleEnabled =
          config.RECONCILIATION_SCHEDULE_ENABLED || 'false';
        if (!['true', 'false'].includes(scheduleEnabled)) {
          throw new Error(
            'RECONCILIATION_SCHEDULE_ENABLED must be true or false',
          );
        }
        const scheduleMinutes = Number(
          config.RECONCILIATION_SCHEDULE_EVERY_MINUTES || 60,
        );
        if (!Number.isInteger(scheduleMinutes) || scheduleMinutes < 5) {
          throw new Error(
            'RECONCILIATION_SCHEDULE_EVERY_MINUTES must be an integer of at least 5',
          );
        }
        const overdueHours = Number(config.RECONCILIATION_OVERDUE_HOURS || 168);
        if (
          !Number.isInteger(overdueHours) ||
          overdueHours < 24 ||
          overdueHours > 2160
        ) {
          throw new Error(
            'RECONCILIATION_OVERDUE_HOURS must be an integer from 24 to 2160',
          );
        }

        config.RECONCILIATION_SCHEDULE_ENABLED = scheduleEnabled;
        config.RECONCILIATION_SCHEDULE_EVERY_MINUTES = scheduleMinutes;
        config.RECONCILIATION_OVERDUE_HOURS = overdueHours;

        const courierRetryEnabled =
          config.COURIER_CALLBACK_RETRY_ENABLED || 'false';
        if (!['true', 'false'].includes(courierRetryEnabled)) {
          throw new Error(
            'COURIER_CALLBACK_RETRY_ENABLED must be true or false',
          );
        }
        const courierRetryEveryMinutes = Number(
          config.COURIER_CALLBACK_RETRY_EVERY_MINUTES || 5,
        );
        if (
          !Number.isInteger(courierRetryEveryMinutes) ||
          courierRetryEveryMinutes < 1 ||
          courierRetryEveryMinutes > 1440
        ) {
          throw new Error(
            'COURIER_CALLBACK_RETRY_EVERY_MINUTES must be an integer from 1 to 1440',
          );
        }
        const courierRetryMaxAttempts = Number(
          config.COURIER_CALLBACK_RETRY_MAX_ATTEMPTS || 6,
        );
        if (
          !Number.isInteger(courierRetryMaxAttempts) ||
          courierRetryMaxAttempts < 1 ||
          courierRetryMaxAttempts > 20
        ) {
          throw new Error(
            'COURIER_CALLBACK_RETRY_MAX_ATTEMPTS must be an integer from 1 to 20',
          );
        }
        config.COURIER_CALLBACK_RETRY_ENABLED = courierRetryEnabled;
        config.COURIER_CALLBACK_RETRY_EVERY_MINUTES = courierRetryEveryMinutes;
        config.COURIER_CALLBACK_RETRY_MAX_ATTEMPTS = courierRetryMaxAttempts;

        const courierPollingEnabled = config.COURIER_POLLING_ENABLED || 'false';
        if (!['true', 'false'].includes(courierPollingEnabled)) {
          throw new Error('COURIER_POLLING_ENABLED must be true or false');
        }
        const courierPollingEveryMinutes = Number(
          config.COURIER_POLLING_EVERY_MINUTES || 15,
        );
        if (
          !Number.isInteger(courierPollingEveryMinutes) ||
          courierPollingEveryMinutes < 5 ||
          courierPollingEveryMinutes > 1440
        ) {
          throw new Error(
            'COURIER_POLLING_EVERY_MINUTES must be an integer from 5 to 1440',
          );
        }
        const courierPollingBatchSize = Number(
          config.COURIER_POLLING_BATCH_SIZE || 100,
        );
        if (
          !Number.isInteger(courierPollingBatchSize) ||
          courierPollingBatchSize < 1 ||
          courierPollingBatchSize > 500
        ) {
          throw new Error(
            'COURIER_POLLING_BATCH_SIZE must be an integer from 1 to 500',
          );
        }
        config.COURIER_POLLING_ENABLED = courierPollingEnabled;
        config.COURIER_POLLING_EVERY_MINUTES = courierPollingEveryMinutes;
        config.COURIER_POLLING_BATCH_SIZE = courierPollingBatchSize;

        const messageDispatchEnabled =
          config.TRANSACTIONAL_MESSAGE_DISPATCH_ENABLED || 'false';
        if (!['true', 'false'].includes(messageDispatchEnabled)) {
          throw new Error(
            'TRANSACTIONAL_MESSAGE_DISPATCH_ENABLED must be true or false',
          );
        }
        const messageSweepMinutes = Number(
          config.TRANSACTIONAL_MESSAGE_SWEEP_EVERY_MINUTES || 5,
        );
        if (
          !Number.isInteger(messageSweepMinutes) ||
          messageSweepMinutes < 1 ||
          messageSweepMinutes > 1440
        ) {
          throw new Error(
            'TRANSACTIONAL_MESSAGE_SWEEP_EVERY_MINUTES must be an integer from 1 to 1440',
          );
        }
        const messageBatchSize = Number(
          config.TRANSACTIONAL_MESSAGE_BATCH_SIZE || 100,
        );
        if (
          !Number.isInteger(messageBatchSize) ||
          messageBatchSize < 1 ||
          messageBatchSize > 500
        ) {
          throw new Error(
            'TRANSACTIONAL_MESSAGE_BATCH_SIZE must be an integer from 1 to 500',
          );
        }
        config.TRANSACTIONAL_MESSAGE_DISPATCH_ENABLED = messageDispatchEnabled;
        config.TRANSACTIONAL_MESSAGE_SWEEP_EVERY_MINUTES = messageSweepMinutes;
        config.TRANSACTIONAL_MESSAGE_BATCH_SIZE = messageBatchSize;

        const paymentRecoveryEnabled =
          config.PAYMENT_RECOVERY_ENABLED || 'false';
        if (!['true', 'false'].includes(paymentRecoveryEnabled)) {
          throw new Error('PAYMENT_RECOVERY_ENABLED must be true or false');
        }
        const paymentRecoveryMinutes = Number(
          config.PAYMENT_RECOVERY_EVERY_MINUTES || 5,
        );
        if (
          !Number.isInteger(paymentRecoveryMinutes) ||
          paymentRecoveryMinutes < 1 ||
          paymentRecoveryMinutes > 1440
        ) {
          throw new Error(
            'PAYMENT_RECOVERY_EVERY_MINUTES must be an integer from 1 to 1440',
          );
        }
        const paymentRecoveryBatchSize = Number(
          config.PAYMENT_RECOVERY_BATCH_SIZE || 100,
        );
        if (
          !Number.isInteger(paymentRecoveryBatchSize) ||
          paymentRecoveryBatchSize < 1 ||
          paymentRecoveryBatchSize > 500
        ) {
          throw new Error(
            'PAYMENT_RECOVERY_BATCH_SIZE must be an integer from 1 to 500',
          );
        }
        config.PAYMENT_RECOVERY_ENABLED = paymentRecoveryEnabled;
        config.PAYMENT_RECOVERY_EVERY_MINUTES = paymentRecoveryMinutes;
        config.PAYMENT_RECOVERY_BATCH_SIZE = paymentRecoveryBatchSize;

        return config;
      },
    }),
  ],
})
export class ConfigModule {}
