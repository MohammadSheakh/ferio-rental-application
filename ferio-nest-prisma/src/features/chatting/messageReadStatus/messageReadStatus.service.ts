import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { MessageReadStatus, MessageReadStatusDocument } from './messageReadStatus.schema';

/**
 * Message Read Status Service
 *
 * 📚 MESSAGE READ STATUS TRACKING
 *
 * Features:
 * - Track which users have read which messages
 * - Get read receipts for messages
 * - Mark messages as read
 * - Get unread messages for a user
 *
 * Compatible with Express.js messageReadStatus service
 */
@Injectable()
export class MessageReadStatusService {
  private readonly logger = new Logger(MessageReadStatusService.name);

  constructor(
    @InjectModel(MessageReadStatus.name) private messageReadStatusModel: Model<MessageReadStatusDocument>,
  ) {}

  /**
   * Mark Message as Read
   *
   * Creates or updates read status for a message
   */
  async markAsRead(
    messageId: string,
    userId: string,
    conversationId: string,
  ): Promise<MessageReadStatusDocument> {
    const readStatus = await this.messageReadStatusModel.findOneAndUpdate(
      {
        messageId: new Types.ObjectId(messageId),
        userId: new Types.ObjectId(userId),
      },
      {
        messageId: new Types.ObjectId(messageId),
        userId: new Types.ObjectId(userId),
        conversationId: new Types.ObjectId(conversationId),
        isRead: true,
        readAt: new Date(),
        isDeleted: false,
      },
      {
        upsert: true,
        new: true,
      },
    ).exec();

    this.logger.debug(`✅ Message ${messageId} marked as read by user ${userId}`);

    return readStatus;
  }

  /**
   * Mark Multiple Messages as Read
   *
   * Batch update for efficiency
   */
  async markMultipleAsRead(
    messageIds: string[],
    userId: string,
    conversationId: string,
  ): Promise<number> {
    const now = new Date();
    const updates = messageIds.map(messageId => ({
      updateOne: {
        filter: {
          messageId: new Types.ObjectId(messageId),
          userId: new Types.ObjectId(userId),
        },
        update: {
          messageId: new Types.ObjectId(messageId),
          userId: new Types.ObjectId(userId),
          conversationId: new Types.ObjectId(conversationId),
          isRead: true,
          readAt: now,
          isDeleted: false,
        },
        upsert: true,
      },
    }));

    const result = await this.messageReadStatusModel.bulkWrite(updates);

    this.logger.debug(`✅ ${result.modifiedCount + result.upsertedCount} messages marked as read by user ${userId}`);

    return result.modifiedCount + result.upsertedCount;
  }

  /**
   * Get Read Status for Message
   *
   * Returns who has read a specific message
   */
  async getReadStatus(messageId: string): Promise<any[]> {
    const statuses = await this.messageReadStatusModel.find({
      messageId: new Types.ObjectId(messageId),
      isRead: true,
      isDeleted: false,
    })
      .populate('userId', 'name profileImage')
      .lean()
      .exec();

    return statuses.map(status => ({
      userId: status.userId,
      readAt: status.readAt,
    }));
  }

  /**
   * Get Unread Messages for User
   *
   * Returns messages that user hasn't read yet
   */
  async getUnreadMessages(userId: string, conversationId: string, limit: number = 50): Promise<string[]> {
    // Find messages where user hasn't read or no read status exists
    const unreadStatuses = await this.messageReadStatusModel.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          conversationId: new Types.ObjectId(conversationId),
          isRead: false,
          isDeleted: false,
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $limit: limit,
      },
      {
        $project: {
          messageId: 1,
        },
      },
    ]);

    return unreadStatuses.map(status => status.messageId.toString());
  }

  /**
   * Get Read Count for Message
   *
   * Returns how many users have read a message
   */
  async getReadCount(messageId: string): Promise<number> {
    const count = await this.messageReadStatusModel.countDocuments({
      messageId: new Types.ObjectId(messageId),
      isRead: true,
      isDeleted: false,
    });

    return count;
  }

  /**
   * Check if User Has Read Message
   */
  async hasUserReadMessage(messageId: string, userId: string): Promise<boolean> {
    const status = await this.messageReadStatusModel.findOne({
      messageId: new Types.ObjectId(messageId),
      userId: new Types.ObjectId(userId),
      isRead: true,
      isDeleted: false,
    });

    return !!status;
  }

  /**
   * Get Read Receipts for Conversation
   *
   * Returns read status for all messages in a conversation
   */
  async getReadReceiptsForConversation(
    conversationId: string,
    userId: string,
  ): Promise<{ messageId: string; isRead: boolean; readAt?: Date }[]> {
    const statuses = await this.messageReadStatusModel.find({
      conversationId: new Types.ObjectId(conversationId),
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    }).lean();

    return statuses.map(status => ({
      messageId: status.messageId.toString(),
      isRead: status.isRead,
      readAt: status.readAt,
    }));
  }

  /**
   * Cleanup Old Read Statuses
   *
   * Remove read statuses for deleted messages
   */
  async cleanupOldStatuses(): Promise<void> {
    const result = await this.messageReadStatusModel.deleteMany({
      isDeleted: true,
    });

    this.logger.debug(`🧹 Cleaned up ${result.deletedCount} old read statuses`);
  }
}
