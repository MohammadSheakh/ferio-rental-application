/**
 * BullMQ Queue Constants
 *
 * 📚 QUEUE NAMES FOR ALL BULLMQ QUEUES
 *
 * Compatible with Express.js bullmq.ts
 */

export const BULLMQ_NOTIFICATION_QUEUE = 'BULLMQ_NOTIFICATION_QUEUE';
export const BULLMQ_CONVERSATION_LAST_MESSAGE_QUEUE ='BULLMQ_CONVERSATION_LAST_MESSAGE_QUEUE';
export const BULLMQ_NOTIFY_PARTICIPANTS_QUEUE = 'BULLMQ_NOTIFY_PARTICIPANTS_QUEUE';
export const BULLMQ_EMAIL_QUEUE = 'BULLMQ_EMAIL_QUEUE';


export const QUEUE_NAMES = {
  NOTIFICATION: 'notificationQueue-e-learning',
  CONVERSATION_LAST_MESSAGE: 'updateConversationsLastMessageQueue-suplify',
  NOTIFY_PARTICIPANTS: 'notify-participants-queue-suplify',
  EMAIL: 'emailQueue-rental-app',
} as const;
