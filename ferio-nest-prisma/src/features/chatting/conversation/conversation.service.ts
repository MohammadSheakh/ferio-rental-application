import {
  ForbiddenException,
  Injectable,
  Logger,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { Queue } from 'bullmq';

import { PrismaService } from '@app/database';
import { RedisService } from '@app/redis';
import { SocketGateway } from '../../socket.gateway/socket.gateway';
import { SocketRoomService } from '../../socket.gateway/services/socket-room.service';
import {
  BULLMQ_CONVERSATION_LAST_MESSAGE_QUEUE,
  BULLMQ_NOTIFY_PARTICIPANTS_QUEUE,
} from '@app/queue';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ConversationType, ParticipantRole } from './conversation.constant';

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly socketGateway: SocketGateway,
    private readonly socketRoomService: SocketRoomService,
    @Inject(BULLMQ_CONVERSATION_LAST_MESSAGE_QUEUE)
    private conversationLastMessageQueue: Queue,
    @Inject(BULLMQ_NOTIFY_PARTICIPANTS_QUEUE)
    private notifyParticipantsQueue: Queue,
  ) {}

  /**
   * Create Conversation
   */
  async createConversation(dto: CreateConversationDto, creatorId: string) {
    const { participants, message, groupName, groupProfilePicture } = dto;
    const allParticipants = [...new Set([...participants, creatorId])];

    if (allParticipants.length < 2) {
      throw new Error('At least 2 participants required');
    }

    const type =
      allParticipants.length > 2
        ? ConversationType.GROUP
        : ConversationType.DIRECT;

    let existingConversation: any = null;
    if (type === ConversationType.DIRECT) {
      existingConversation =
        await this.findExistingDirectConversation(allParticipants);
    }

    if (!existingConversation) {
      const conversation = await this.prisma.conversation.create({
        data: {
          creatorId,
          type: type === ConversationType.GROUP ? 'group' : 'direct',
          groupName,
          groupProfilePicture,
        },
      });

      await this.addParticipantsToConversation(
        conversation.id,
        allParticipants,
        creatorId,
      );

      if (message) {
        await this.sendMessage(conversation.id, creatorId, message);
      }

      return { conversation, created: true };
    }

    if (message) {
      await this.sendMessage(existingConversation.id, creatorId, message);
    }

    return { conversation: existingConversation, created: false };
  }

  /**
   * Find existing direct conversation
   */
  private async findExistingDirectConversation(participantIds: string[]) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        type: 'direct',
        isDeleted: false,
        participants: {
          every: { userId: { in: participantIds } },
        },
      },
      include: {
        participants: { select: { userId: true } },
      },
    });

    return (
      conversations.find(
        (c) =>
          c.participants.length === participantIds.length &&
          JSON.stringify(c.participants.map((p) => p.userId).sort()) ===
            JSON.stringify([...participantIds].sort()),
      ) || null
    );
  }

  /**
   * Add participants to conversation
   */
  async addParticipantsToConversation(
    conversationId: string,
    participantIds: string[],
    creatorId: string,
    enforceActorPermission = false,
  ) {
    if (enforceActorPermission) {
      const actor = await this.prisma.conversationParticipents.findFirst({
        where: {
          conversationId,
          userId: creatorId,
          role: ParticipantRole.ADMIN,
          isDeleted: false,
        },
        select: { id: true },
      });
      if (!actor) {
        throw new ForbiddenException(
          'Conversation administrator permission is required',
        );
      }
    }

    for (const userId of participantIds) {
      const existing = await this.prisma.conversationParticipents.findFirst({
        where: { userId, conversationId, isDeleted: false },
      });

      if (existing) continue;

      const user = await this.getUserInfo(userId);
      await this.prisma.conversationParticipents.create({
        data: {
          conversationId,
          userId,
          userName: user.name,
          role:
            userId === creatorId
              ? ParticipantRole.ADMIN
              : ParticipantRole.MEMBER,
        },
      });
    }
  }

  /**
   * Send Message (integrated with conversation update)
   */
  async sendMessage(conversationId: string, senderId: string, text: string) {
    const message = await this.prisma.message.create({
      data: { conversationId, senderId, text },
      include: {
        sender: { select: { name: true, profileImageUrl: true, role: true } },
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageId: message.id,
        lastMessageText: text,
        lastMessageCreatedAt: message.createdAt,
      },
    });

    await this.conversationLastMessageQueue.add(
      'update-conversation-last-message',
      {
        conversationId,
        lastMessageId: message.id,
        lastMessage: text,
      },
      { removeOnComplete: true },
    );

    await this.notifyParticipantsInConversation(conversationId, message);

    return message;
  }

  /**
   * Notify participants
   */
  private async notifyParticipantsInConversation(
    conversationId: string,
    message: any,
  ) {
    const participants = await this.prisma.conversationParticipents.findMany({
      where: { conversationId, isDeleted: false },
      select: { userId: true },
    });

    const participantIds = participants.map((p) => p.userId);
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
  }

  /**
   * Get conversations for user
   */
  async getConversationsByUserId(
    userId: string,
    page: number = 1,
    limit: number = 10,
    search: string = '',
  ) {
    const skip = (page - 1) * limit;

    const participants = await this.prisma.conversationParticipents.findMany({
      where: { userId, isDeleted: false },
      include: {
        conversation: {
          include: {
            participants: {
              include: {
                user: { select: { name: true, profileImageUrl: true } },
              },
            },
          },
        },
      },
      orderBy: { conversation: { lastMessageCreatedAt: 'desc' } },
      skip,
      take: limit,
    });

    const results = await Promise.all(
      participants.map(async (p) => {
        const unreadCount = await this.prisma.message.count({
          where: {
            conversationId: p.conversationId,
            senderId: { not: userId },
            createdAt: { gt: p.lastMessageReadAt || new Date(0) },
            isDeleted: false,
          },
        });

        const otherParticipants = p.conversation.participants.filter(
          (pt) => pt.userId !== userId,
        );

        return {
          id: p.conversationId,
          type: p.conversation.type,
          groupName: p.conversation.groupName,
          lastMessage: p.conversation.lastMessageText,
          lastMessageAt: p.conversation.lastMessageCreatedAt,
          unreadCount,
          participants: otherParticipants.map((pt) => ({
            userId: pt.userId,
            name: pt.userName,
            profileImage: pt.user?.profileImageUrl,
            isOnline: this.socketGateway.isUserOnline(pt.userId),
          })),
        };
      }),
    );

    const total = await this.prisma.conversationParticipents.count({
      where: { userId, isDeleted: false },
    });

    return {
      results,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      totalResults: total,
    };
  }

  /**
   * Remove participant
   */
  async removeParticipant(
    conversationId: string,
    participantId: string,
    actorId: string,
  ) {
    const actor = await this.prisma.conversationParticipents.findFirst({
      where: { conversationId, userId: actorId, isDeleted: false },
      select: { role: true },
    });
    const removingSelf = actorId === participantId;
    if (!actor || (!removingSelf && actor.role !== ParticipantRole.ADMIN)) {
      throw new ForbiddenException(
        'Conversation administrator permission is required',
      );
    }

    await this.prisma.conversationParticipents.updateMany({
      where: { conversationId, userId: participantId },
      data: { isDeleted: true },
    });

    await this.socketGateway.emitToRoom(conversationId, 'participant-removed', {
      conversationId,
      participantId,
    });
  }

  /**
   * Mark as read
   */
  async markAsRead(userId: string, conversationId: string) {
    await this.prisma.conversationParticipents.updateMany({
      where: { conversationId, userId },
      data: { lastMessageReadAt: new Date(), unreadCount: 0 },
    });
  }

  /**
   * Get all conversations (Admin)
   */
  async getAllConversations(page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;

    const conversations = await this.prisma.conversation.findMany({
      where: { isDeleted: false },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit,
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { text: true, createdAt: true, senderId: true },
        },
      },
    });

    const total = await this.prisma.conversation.count({
      where: { isDeleted: false },
    });

    const results = conversations.map((conv) => {
      const lastMsg = conv.messages[0];
      return {
        id: conv.id,
        type: conv.type,
        groupName: conv.groupName,
        lastMessage: conv.lastMessageText || lastMsg?.text || 'No messages',
        lastMessageAt:
          conv.lastMessageCreatedAt || lastMsg?.createdAt || conv.updatedAt,
        updatedAt: conv.updatedAt,
      };
    });

    return {
      results,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      totalResults: total,
    };
  }

  /**
   * Get user info
   */
  private async getUserInfo(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, role: true, profileImageUrl: true },
    });
    return {
      name: user?.name || 'User',
      role: user?.role || 'user',
      profileImage: user?.profileImageUrl || undefined,
    };
  }
}
