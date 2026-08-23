import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsNotEmpty, IsObject, IsMongoId } from 'class-validator';
import { Types } from 'mongoose';
import { NotificationType, NotificationPriority } from '../notification.schema';

/**
 * Send Notification DTO
 * 
 * 📚 GENERIC NOTIFICATION SYSTEM
 * 
 * Used for sending notifications from any module:
 * - Task module (task created, updated, completed)
 * - Chat module (new message, conversation update)
 * - Subscription module (payment success, renewal)
 * - System module (announcements, maintenance)
 * 
 * Usage:
 * ```typescript
 * // From Task module
 * await notificationService.sendNotification({
 *   title: 'New Task Assigned',
 *   senderId: userId,
 *   receiverId: assigneeId,
 *   type: NotificationType.ASSIGNMENT,
 *   entityType: 'task',
 *   entityId: taskId,
 * });
 * 
 * // From Chat module
 * await notificationService.sendNotification({
 *   title: 'New Message',
 *   senderId: senderId,
 *   receiverId: receiverId,
 *   type: NotificationType.CUSTOM,
 *   entityType: 'conversation',
 *   entityId: conversationId,
 * });
 * ```
 */
export class SendNotificationDto {
  @ApiProperty({ description: 'Notification title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: 'Notification message' })
  @IsString()
  @IsOptional()
  message?: string;

  @ApiPropertyOptional({ description: 'Sender user ID' })
  @IsMongoId()
  @IsOptional()
  senderId?: string;

  @ApiPropertyOptional({ description: 'Receiver user ID' })
  @IsMongoId()
  @IsOptional()
  receiverId?: string;

  @ApiPropertyOptional({ description: 'Receiver role (for broadcast)' })
  @IsString()
  @IsOptional()
  receiverRole?: string;

  @ApiProperty({ description: 'Notification type', enum: NotificationType })
  @IsEnum(NotificationType)
  @IsNotEmpty()
  type: NotificationType;

  @ApiPropertyOptional({ description: 'Notification priority', enum: NotificationPriority, default: NotificationPriority.NORMAL })
  @IsEnum(NotificationPriority)
  @IsOptional()
  priority?: NotificationPriority = NotificationPriority.NORMAL;

  @ApiPropertyOptional({ description: 'Entity type this notification is about (task, conversation, etc.)' })
  @IsString()
  @IsOptional()
  entityType?: string;

  @ApiPropertyOptional({ description: 'Entity ID this notification is about' })
  @IsMongoId()
  @IsOptional()
  entityId?: string;

  @ApiPropertyOptional({ description: 'Link for notification action' })
  @IsString()
  @IsOptional()
  linkFor?: string;

  @ApiPropertyOptional({ description: 'Link ID for navigation' })
  @IsMongoId()
  @IsOptional()
  linkId?: string;

  @ApiPropertyOptional({ description: 'Additional data payload' })
  @IsObject()
  @IsOptional()
  data?: any;
}

/**
 * Enqueue Notification DTO
 * 
 * For async notification processing via BullMQ
 */
export class EnqueueNotificationDto extends SendNotificationDto {
  @ApiPropertyOptional({ description: 'Delay in milliseconds before sending' })
  @IsOptional()
  delay?: number;

  @ApiPropertyOptional({ description: 'Schedule time for sending' })
  @IsOptional()
  scheduledAt?: Date;
}

/**
 * Broadcast Notification DTO
 * 
 * For broadcasting to multiple users or roles
 */
export class BroadcastNotificationDto extends SendNotificationDto {
  @ApiPropertyOptional({ description: 'Array of receiver user IDs' })
  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  receiverIds?: string[];

  @ApiPropertyOptional({ description: 'Broadcast to role' })
  @IsString()
  @IsOptional()
  broadcastToRole?: string;

  @ApiPropertyOptional({ description: 'Broadcast to all users' })
  @IsOptional()
  broadcastToAll?: boolean = false;
}
