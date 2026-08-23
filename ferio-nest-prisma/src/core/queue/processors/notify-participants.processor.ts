import { Processor, Process } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { QUEUE_NAMES } from './bullmq.constants';
import { SocketGateway } from '../../modules/socket.gateway/socket.gateway';

export interface INotifyParticipantsJobData {
  conversationId: string;
  messageId: string;
  messageText: string;
  senderId: string;
  senderProfile: {
    name: string;
    profileImage?: string;
    role?: string;
  };
  participantIds: string[];
}

/**
 * Notify Participants Processor
 *
 * 📚 BULLMQ WORKER FOR NOTIFYING CHAT PARTICIPANTS
 *
 * Processes jobs to notify all participants in a conversation:
 * - Updates unread counts
 * - Emits conversation list updates
 * - Emits unseen count updates
 *
 * Compatible with Express.js bullmq.ts startNotifyParticipantsWorker()
 */
@Processor(QUEUE_NAMES.NOTIFY_PARTICIPANTS)
export class NotifyParticipantsProcessor {
  private readonly logger = new Logger(NotifyParticipantsProcessor.name);

  constructor(
    private socketGateway: SocketGateway,
    // Note: Add ConversationParticipents model when migrating chat module
    // @InjectModel('ConversationParticipents') private conversationParticipentsModel: Model<any>,
  ) {}

  @Process('notify-participants')
  async processNotifyParticipants(job: Job<INotifyParticipantsJobData>): Promise<void> {
    const { conversationId, messageId, messageText, senderId, senderProfile, participantIds } = job.data;

    this.logger.log(`Notifying ${participantIds.length} participants for conversation ${conversationId}`);

    // Process each participant
    for (const participantId of participantIds) {
      try {
        const isOnline = await this.socketGateway.isUserOnline(participantId);
        const isInRoom = await this.socketGateway.isMemberInRoom(participantId, conversationId);

        if (isInRoom) {
          // Emit conversation list update (no unread count bump)
          await this.socketGateway.emitToUser(participantId, `conversation-list-updated::${participantId}`, {
            userId: senderProfile,
            conversations: [{
              _conversationId: conversationId,
              lastMessage: messageText,
              updatedAt: new Date(),
            }],
          });
        } else if (isOnline && !isInRoom) {
          await this.socketGateway.emitToUser(participantId, `conversation-list-updated::${participantId}`, {
            userId: senderProfile,
            conversations: [{
              _conversationId: conversationId,
              lastMessage: messageText,
              updatedAt: new Date(),
            }],
          });

          // Update unread count (skip sender)
          if (participantId === senderId) continue;

          // Note: Update ConversationParticipents model when migrating chat module
          // const updatedParticipant = await ConversationParticipents.findOneAndUpdate(
          //   {
          //     userId: new Types.ObjectId(participantId),
          //     conversationId: new Types.ObjectId(conversationId)
          //   },
          //   {
          //     $set: { isThisConversationUnseen: 1 },
          //   },
          //   { new: true }
          // );

          // Calculate total unseen conversations
          // const [result] = await ConversationParticipents.aggregate([
          //   { $match: { userId: new Types.ObjectId(participantId) } },
          //   { $group: { _id: null, totalUnseen: { $sum: "$isThisConversationUnseen" } } }
          // ]);

          // const unreadConversationCount = result?.totalUnseen || 0;

          // await this.socketGateway.emitToUser(participantId, `unseen-count::${participantId}`, {
          //   unreadConversationCount
          // });
        } else {
          // If offline → skip (or add push notification later)
          if (participantId === senderId) continue;

          // Note: Update ConversationParticipents model when migrating chat module
          // const updatedParticipant = await ConversationParticipents.findOneAndUpdate(
          //   {
          //     userId: new Types.ObjectId(participantId),
          //     conversationId: new Types.ObjectId(conversationId)
          //   },
          //   {
          //     $set: { isThisConversationUnseen: 1 },
          //   },
          //   { new: true }
          // );

          // Calculate total unseen conversations and emit
          // const unreadConversationCount = result?.totalUnseen || 0;
          // await this.socketGateway.emitToUser(participantId, `unseen-count::${participantId}`, {
          //   unreadConversationCount
          // });
        }
      } catch (err) {
        this.logger.error(`Failed to notify participant ${participantId}:`, err);
        // Don't throw → continue with others
      }
    }

    this.logger.log(`✅ Chat notification job ${job.id} completed`);
  }
}
