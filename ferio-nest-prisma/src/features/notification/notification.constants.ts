/**
 * Notification Constants
 * 
 * 📚 GENERIC NOTIFICATION SYSTEM
 */

// BullMQ Queue Names
export const BULLMQ_NOTIFICATION_QUEUE = 'notification-queue';
export const BULLMQ_NOTIFICATION_QUEUE_PROCESSOR = 'send-notification';

// Notification Event Names (Socket.IO)
export const SOCKET_NOTIFICATION_EVENT = 'notification::';
export const SOCKET_UNREAD_COUNT_EVENT = 'notification:unread-count::';

// Redis Keys
export const REDIS_NOTIFICATION_UNREAD_PREFIX = 'notification:unread:';
export const REDIS_NOTIFICATION_PREFIX = 'notification:';

// Notification TTL (30 days for read notifications)
export const NOTIFICATION_TTL_SECONDS = 30 * 24 * 60 * 60;

// Cache TTL
export const UNREAD_COUNT_CACHE_TTL = 300; // 5 minutes
