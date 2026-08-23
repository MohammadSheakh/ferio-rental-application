/**
 * Conversation Types Enum
 *
 * 📚 CONVERSATION TYPES
 *
 * Compatible with Express.js conversation.constant.ts
 */
export enum ConversationType {
  DIRECT = 'direct',
  GROUP = 'group',
}

/**
 * Participant Roles
 */
export enum ParticipantRole {
  ADMIN = 'admin',
  MEMBER = 'member',
}

/**
 * Conversation Constants
 */
export const CONVERSATION_CONSTANTS = {
  TYPES: ConversationType,
  ROLES: ParticipantRole,
} as const;
