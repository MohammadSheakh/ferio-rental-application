import { Injectable, Logger, Inject, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Queue } from 'bullmq';

import { PrismaService } from '@app/database';
import { RedisService } from '@app/redis';
import { SocketGateway } from '../../socket.gateway/socket.gateway';
import {
  BULLMQ_CONVERSATION_LAST_MESSAGE_QUEUE,
  BULLMQ_NOTIFY_PARTICIPANTS_QUEUE,
} from '@app/queue';
import { SendMessageDto } from './dto/message.dto';

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly socketGateway: SocketGateway,
    @Inject(BULLMQ_CONVERSATION_LAST_MESSAGE_QUEUE) private conversationLastMessageQueue: Queue,
    @Inject(BULLMQ_NOTIFY_PARTICIPANTS_QUEUE) private notifyParticipantsQueue: Queue,
  ) {}

  /**
   * Send Message
   */
  async sendMessage(
    conversationId: string,
    senderId: string,
    dto: SendMessageDto,
  ) {
    const { text, attachments } = dto;

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId, isDeleted: false },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const isParticipant = await this.prisma.conversationParticipents.findFirst({
      where: {
        userId: senderId,
        conversationId: conversationId,
        isDeleted: false,
      },
    });

    if (!isParticipant) {
      throw new BadRequestException('You are not a participant in this conversation');
    }

    const message = await this.prisma.message.create({
      data: {
        text,
        senderId,
        conversationId,
        // attachments: { connect: attachments?.map(id => ({ id })) || [] }, // Handle attachments if model exists
      },
      include: {
        sender: {
          select: { name: true, profileImageUrl: true, role: true }
        }
      }
    });

    this.logger.log(`✅ Message created: ${message.id} in conversation ${conversationId}`);

    // Update conversation last message (async via BullMQ)
    await this.conversationLastMessageQueue.add(
      'update-conversation-last-message',
      {
        conversationId,
        lastMessageId: message.id,
        lastMessage: text,
      },
      { removeOnComplete: true }
    );

    // Notify participants (async via BullMQ)
    await this.notifyParticipantsInConversation(conversationId, message);

    // Emit real-time event via Socket.IO
    await this.emitNewMessageEvent(conversationId, message);

    return message;
  }

  /**
   * Get Messages by Conversation ID
   */
  async getMessagesByConversation(
    conversationId: string,
    userId?: string,
    page: number = 1,
    limit: number = 50,
    role?: string,
  ) {
    await this.assertConversationAccess(conversationId, userId, role);
    const skip = (page - 1) * limit;

    const rawId = conversationId.replace('conv-', '');
    const prefId = conversationId.startsWith('conv-') ? conversationId : `conv-${conversationId}`;

    const possibleIds = new Set<string>([conversationId, rawId, prefId]);

    try {
      const [user, customer] = await Promise.all([
        this.prisma.user.findFirst({
          where: {
            OR: [
              { id: rawId },
              { customerId: rawId },
              { id: conversationId },
              { customerId: conversationId },
            ],
          },
        }),
        this.prisma.customer.findFirst({
          where: {
            OR: [
              { id: rawId },
              { id: conversationId },
            ],
          },
          include: { user: true },
        }),
      ]);

      if (user) {
        possibleIds.add(user.id);
        possibleIds.add(`conv-${user.id}`);
        if (user.customerId) {
          possibleIds.add(user.customerId);
          possibleIds.add(`conv-${user.customerId}`);
        }
      }

      if (customer) {
        possibleIds.add(customer.id);
        possibleIds.add(`conv-${customer.id}`);
        if (customer.user?.id) {
          possibleIds.add(customer.user.id);
          possibleIds.add(`conv-${customer.user.id}`);
        }
      }

      // If we found a user or customer with an email, search by email cross-reference
      const targetEmail = user?.email || customer?.email;
      if (targetEmail) {
        const [linkedUserByEmail, linkedCustByEmail] = await Promise.all([
          this.prisma.user.findFirst({ where: { email: targetEmail } }),
          this.prisma.customer.findFirst({
            where: { email: targetEmail },
            include: { user: true },
          }),
        ]);

        if (linkedUserByEmail) {
          possibleIds.add(linkedUserByEmail.id);
          possibleIds.add(`conv-${linkedUserByEmail.id}`);
          if (linkedUserByEmail.customerId) {
            possibleIds.add(linkedUserByEmail.customerId);
            possibleIds.add(`conv-${linkedUserByEmail.customerId}`);
          }
        }
        if (linkedCustByEmail) {
          possibleIds.add(linkedCustByEmail.id);
          possibleIds.add(`conv-${linkedCustByEmail.id}`);
          if (linkedCustByEmail.user?.id) {
            possibleIds.add(linkedCustByEmail.user.id);
            possibleIds.add(`conv-${linkedCustByEmail.user.id}`);
          }
        }
      }
    } catch {
      // Fallback ignore
    }

    const queryIds = Array.from(possibleIds);

    const messages = await this.prisma.message.findMany({
      where: {
        conversationId: { in: queryIds },
        isDeleted: false,
      },
      include: {
        sender: {
          select: { name: true, profileImageUrl: true, role: true }
        },
        attachments: true
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    const total = await this.prisma.message.count({
      where: {
        conversationId: { in: queryIds },
        isDeleted: false,
      },
    });

    // Mark messages as read if userId provided
    if (userId) {
      try {
        await this.markMessagesAsRead(conversationId, userId, messages.map(m => m.id));
      } catch (err) {
        // Non-blocking fallback
      }
    }

    return {
      results: messages.reverse(),
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      totalResults: total,
    };
  }

  /**
   * Get Messages with Cursor Pagination
   */
  async getMessagesWithCursor(
    conversationId: string,
    userId: string,
    options: {
      before?: string;
      after?: string;
      limit?: number;
    } = {},
    role?: string,
  ) {
    await this.assertConversationAccess(conversationId, userId, role);
    const { before, after, limit = 20 } = options;

    const query: any = {
      conversationId,
      isDeleted: false,
    };

    if (before) {
      const beforeMessage = await this.prisma.message.findUnique({ where: { id: before } });
      if (beforeMessage) query.createdAt = { lt: beforeMessage.createdAt };
    }

    if (after) {
      const afterMessage = await this.prisma.message.findUnique({ where: { id: after } });
      if (afterMessage) query.createdAt = { ...query.createdAt, gt: afterMessage.createdAt };
    }

    const messages = await this.prisma.message.findMany({
      where: query,
      include: {
        sender: {
          select: { name: true, profileImageUrl: true, role: true }
        },
        attachments: true
      },
      orderBy: { createdAt: before ? 'desc' : 'asc' },
      take: limit + 1,
    });

    const hasMore = messages.length > limit;
    const resultMessages = hasMore ? messages.slice(0, limit) : messages;

    // Mark messages as read
    await this.markMessagesAsRead(
      conversationId,
      userId,
      resultMessages.map(m => m.id),
    );

    return {
      results: before ? resultMessages.reverse() : resultMessages,
      hasMore,
      nextCursor: hasMore ? resultMessages[resultMessages.length - 1].id : null,
      prevCursor: resultMessages[0]?.id || null,
    };
  }

  private async assertConversationAccess(
    conversationId: string,
    userId?: string,
    role?: string,
  ) {
    if (['admin', 'super_admin', 'super-admin'].includes(String(role || '').toLowerCase())) {
      return;
    }
    if (!userId) throw new ForbiddenException('Conversation access denied');

    const allowedIds = new Set([userId, `conv-${userId}`]);
    if (role !== 'guest') {
      const account = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { customerId: true },
      });
      if (account?.customerId) {
        allowedIds.add(account.customerId);
        allowedIds.add(`conv-${account.customerId}`);
      }
    }

    if (!allowedIds.has(conversationId)) {
      throw new ForbiddenException('Conversation access denied');
    }
  }

  /**
   * Update Message
   */
  async updateMessage(
    messageId: string,
    userId: string,
    text: string,
  ) {
    const message = await this.prisma.message.findFirst({
      where: {
        id: messageId,
        senderId: userId,
        isDeleted: false,
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found or you do not have permission to edit it');
    }

    const updatedMessage = await this.prisma.message.update({
      where: { id: messageId },
      data: { text },
    });

    this.logger.log(`✅ Message updated: ${messageId}`);

    // Emit update event
    await this.socketGateway.emitToRoom(message.conversationId, 'message-updated', {
      messageId,
      text,
      updatedAt: updatedMessage.updatedAt,
    });

    return updatedMessage;
  }

  /**
   * Delete Message
   */
  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const message = await this.prisma.message.findFirst({
      where: {
        id: messageId,
        senderId: userId,
        isDeleted: false,
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found or you do not have permission to delete it');
    }

    await this.prisma.message.update({
      where: { id: messageId },
      data: { isDeleted: true },
    });

    this.logger.log(`✅ Message deleted: ${messageId}`);

    // Emit delete event
    await this.socketGateway.emitToRoom(message.conversationId, 'message-deleted', {
      messageId,
      conversationId: message.conversationId,
    });
  }

  /**
   * Mark Messages as Read
   */
  async markMessagesAsRead(
    conversationId: string,
    userId: string,
    messageIds: string[],
  ): Promise<void> {
    if (!messageIds || messageIds.length === 0) return;

    const latestMessageId = messageIds[messageIds.length - 1];
    const latestMessage = await this.prisma.message.findUnique({ where: { id: latestMessageId } });

    if (!latestMessage) return;

    await this.prisma.conversationParticipents.updateMany({
      where: {
        userId: userId,
        conversationId: conversationId,
      },
      data: {
        lastMessageReadAt: latestMessage.createdAt,
        lastMessageReadId: latestMessageId,
        isThisConversationUnseen: 0,
      },
    });

    this.logger.debug(`✅ Messages marked as read for user ${userId} in conversation ${conversationId}`);
  }

  /**
   * Notify Participants in Conversation
   */
  private async notifyParticipantsInConversation(
    conversationId: string,
    message: any,
  ): Promise<void> {
    try {
      const participants = await this.prisma.conversationParticipents.findMany({
        where: {
          conversationId,
          isDeleted: false,
        },
        select: { userId: true },
      });

      const participantIds = participants.map(p => p.userId);
      const sender = message.sender;

      await this.notifyParticipantsQueue.add(
        'notify-participants',
        {
          conversationId,
          messageId: message.id,
          messageText: message.text,
          senderId: message.senderId,
          senderProfile: {
            name: sender?.name || 'User',
            profileImage: sender?.profileImageUrl,
            role: sender?.role || 'user',
          },
          participantIds,
        },
        { removeOnComplete: true },
      );

      this.logger.log(`📬 Queued notification for ${participantIds.length} participants`);
    } catch (error) {
      this.logger.error(`❌ Failed to notify participants: ${error.message}`);
    }
  }

  /**
   * Emit New Message Event via Socket.IO
   */
  private async emitNewMessageEvent(
    conversationId: string,
    message: any,
  ): Promise<void> {
    try {
      const sender = message.sender;

      await this.socketGateway.emitToRoom(conversationId, 'new-message-received', {
        _messageId: message.id,
        conversationId,
        text: message.text,
        senderId: message.senderId,
        senderName: sender?.name || 'User',
        senderProfileImage: sender?.profileImageUrl,
        createdAt: message.createdAt,
        attachments: message.attachments,
      });

      this.logger.debug(`📡 Emitted new-message-received to room ${conversationId}`);
    } catch (error) {
      this.logger.error(`❌ Failed to emit new message event: ${error.message}`);
    }
  }

  /**
   * Get Unread Message Count
   */
  async getUnreadCount(userId: string, conversationId: string): Promise<number> {
    const participent = await this.prisma.conversationParticipents.findFirst({
      where: {
        userId,
        conversationId,
        isDeleted: false,
      },
      select: { lastMessageReadAt: true },
    });

    if (!participent || !participent.lastMessageReadAt) {
      return await this.prisma.message.count({
        where: {
          conversationId,
          senderId: { not: userId },
          isDeleted: false,
        },
      });
    }

    return await this.prisma.message.count({
      where: {
        conversationId,
        senderId: { not: userId },
        createdAt: { gt: participent.lastMessageReadAt },
        isDeleted: false,
      },
    });
  }
}
