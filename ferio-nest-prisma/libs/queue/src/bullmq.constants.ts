/**
 * BullMQ Queue Constants
 *
 * 📚 QUEUE NAMES FOR ALL BULLMQ QUEUES
 *
 * Compatible with Express.js bullmq.ts
 */

export const BULLMQ_NOTIFICATION_QUEUE = 'BULLMQ_NOTIFICATION_QUEUE';
export const BULLMQ_CONVERSATION_LAST_MESSAGE_QUEUE =
  'BULLMQ_CONVERSATION_LAST_MESSAGE_QUEUE';
export const BULLMQ_NOTIFY_PARTICIPANTS_QUEUE =
  'BULLMQ_NOTIFY_PARTICIPANTS_QUEUE';
export const BULLMQ_EMAIL_QUEUE = 'BULLMQ_EMAIL_QUEUE';
export const BULLMQ_RECONCILIATION_QUEUE = 'BULLMQ_RECONCILIATION_QUEUE';
export const BULLMQ_COURIER_CALLBACK_QUEUE = 'BULLMQ_COURIER_CALLBACK_QUEUE';
export const BULLMQ_COURIER_POLL_QUEUE = 'BULLMQ_COURIER_POLL_QUEUE';
export const BULLMQ_TRANSACTIONAL_MESSAGE_QUEUE =
  'BULLMQ_TRANSACTIONAL_MESSAGE_QUEUE';
export const BULLMQ_PAYMENT_RECOVERY_QUEUE = 'BULLMQ_PAYMENT_RECOVERY_QUEUE';

export const QUEUE_NAMES = {
  NOTIFICATION: 'notificationQueue-e-learning',
  CONVERSATION_LAST_MESSAGE: 'updateConversationsLastMessageQueue-suplify',
  NOTIFY_PARTICIPANTS: 'notify-participants-queue-suplify',
  EMAIL: 'emailQueue-rental-app',
  RECONCILIATION: 'reconciliationQueue-ferio',
  COURIER_CALLBACK: 'courierCallbackQueue-ferio',
  COURIER_POLL: 'courierPollQueue-ferio',
  TRANSACTIONAL_MESSAGE: 'transactionalMessageQueue-ferio',
  PAYMENT_RECOVERY: 'paymentRecoveryQueue-ferio',
} as const;
