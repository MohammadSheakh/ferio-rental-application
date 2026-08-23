import { Injectable, Inject, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

import { PrismaService } from '@app/database';
import { RedisService } from '@app/redis';
import { BULLMQ_NOTIFICATION_QUEUE } from '@app/queue';
import { SocketGateway } from '../socket.gateway/socket.gateway';
import { SendNotificationDto, EnqueueNotificationDto, BroadcastNotificationDto } from './dto/notification.dto';
import { Prisma, NotificationType } from '@prisma/client';
import { REDIS_NOTIFICATION_UNREAD_PREFIX, UNREAD_COUNT_CACHE_TTL } from './notification.constants';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly socketGateway: SocketGateway,
    @Inject(BULLMQ_NOTIFICATION_QUEUE) private readonly notificationQueue: Queue,
  ) {}

  /**
   * Send notification (synchronous)
   */
  async sendNotification(dto: SendNotificationDto) {
    try {
      const notification = await this.prisma.notification.create({
        data: {
          title: dto.title,
          message: dto.message,
          type: dto.type as any,
          priority: dto.priority as any,
          senderId: dto.senderId,
          receiverId: dto.receiverId,
          receiverRole: dto.receiverRole,
          entityType: dto.entityType,
          entityId: dto.entityId,
          linkFor: dto.linkFor,
          linkId: dto.linkId,
          status: 'sent',
        },
      });

      this.logger.log(`✅ Notification created: ${notification.id}`);

      // Emit via Socket.IO
      await this.emitNotification(notification);

      // Update unread count cache
      if (dto.receiverId) {
        await this.incrementUnreadCount(dto.receiverId);
      }

      return notification;
    } catch (error) {
      this.logger.error(`❌ Failed to send notification: ${error.message}`);
      throw error;
    }
  }

  /**
   * Enqueue notification (async)
   */
  async enqueueNotification(dto: EnqueueNotificationDto, delay?: number): Promise<void> {
    try {
      const jobId = `notif:${dto.receiverId || 'broadcast'}:${Date.now()}`;

      await this.notificationQueue.add(
        'send-notification',
        dto,
        {
          jobId,
          delay: delay || dto.delay || 0,
          attempts: 3,
          removeOnComplete: true,
        },
      );

      this.logger.log(`📬 Notification enqueued: ${jobId}`);
    } catch (error) {
      this.logger.error(`❌ Failed to enqueue notification: ${error.message}`);
      throw error;
    }
  }

  /**
   * Broadcast notification
   */
  async broadcastNotification(dto: BroadcastNotificationDto): Promise<void> {
    try {
      if (dto.receiverIds && dto.receiverIds.length > 0) {
        for (const receiverId of dto.receiverIds) {
          await this.sendNotification({ ...dto, receiverId });
        }
      }

      if (dto.broadcastToRole) {
        await this.socketGateway.broadcastToRole(dto.broadcastToRole, 'notification::broadcast', {
          title: dto.title,
          type: dto.type,
          senderId: dto.senderId,
        });
      }

      this.logger.log(`✅ Broadcasted notification`);
    } catch (error) {
      this.logger.error(`❌ Failed to broadcast notification: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20,
    isRead?: boolean,
  ) {
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = {
      receiverId: userId,
      isDeleted: false,
    };

    if (isRead !== undefined) {
      where.isRead = isRead;
    }

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          sender: { select: { name: true, profileImageUrl: true } }
        }
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { notifications, total };
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.redisService.getOrSet(
      `${REDIS_NOTIFICATION_UNREAD_PREFIX}${userId}`,
      () => this.fetchUnreadCount(userId),
      UNREAD_COUNT_CACHE_TTL
    );
  }

  private async fetchUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        receiverId: userId,
        isRead: false,
        isDeleted: false,
      },
    });
  }

  /**
   * Get all notification types
   */
  getAllNotificationTypes() {
    return Object.values(NotificationType);
  }

  /**
   * Mark as read
   */
  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.update({
      where: { id: notificationId, receiverId: userId },
      data: { isRead: true, readAt: new Date() },
    });

    if (notification) {
      await this.decrementUnreadCount(userId);
    }

    return notification;
  }

  /**
   * Mark all as read
   */
  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        receiverId: userId,
        isRead: false,
        isDeleted: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    await this.redisService.invalidate(`${REDIS_NOTIFICATION_UNREAD_PREFIX}${userId}`);

    return { modifiedCount: result.count };
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    const notification = await this.prisma.notification.update({
      where: { id: notificationId, receiverId: userId },
      data: { isDeleted: true },
    });

    if (notification && !notification.isRead) {
      await this.decrementUnreadCount(userId);
    }
  }

  /**
   * Emit notification
   */
  private async emitNotification(notification: any): Promise<void> {
    try {
      const notificationData = {
        id: notification.id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        senderId: notification.senderId,
        receiverId: notification.receiverId,
        receiverRole: notification.receiverRole,
        linkFor: notification.linkFor,
        linkId: notification.linkId,
        createdAt: notification.createdAt,
      };

      if (notification.receiverRole === 'admin') {
        await this.socketGateway.broadcastToRole('admin', 'notification::admin', notificationData);
      } else if (notification.receiverId) {
        await this.socketGateway.emitNotificationToUser(
          notification.receiverId,
          notificationData,
        );
      }
    } catch (error) {
      this.logger.error(`❌ Failed to emit notification: ${error.message}`);
    }
  }

  private async incrementUnreadCount(userId: string): Promise<void> {
    const client = await this.redisService.getClient();
    if (client) {
      const cacheKey = `${REDIS_NOTIFICATION_UNREAD_PREFIX}${userId}`;
      await client.incr(cacheKey);
      await client.expire(cacheKey, UNREAD_COUNT_CACHE_TTL);
    }
  }

  private async decrementUnreadCount(userId: string): Promise<void> {
    const client = await this.redisService.getClient();
    if (client) {
      const cacheKey = `${REDIS_NOTIFICATION_UNREAD_PREFIX}${userId}`;
      await client.decr(cacheKey);
      await client.expire(cacheKey, UNREAD_COUNT_CACHE_TTL);
    }
  }
}
