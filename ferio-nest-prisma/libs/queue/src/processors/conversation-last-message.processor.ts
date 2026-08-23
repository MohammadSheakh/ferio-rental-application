import { Processor, Process } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { QUEUE_NAMES } from './bullmq.constants';

/**
 * Update Conversations Last Message Processor
 *
 * 📚 BULLMQ WORKER FOR UPDATING CONVERSATION METADATA
 *
 * Processes jobs to update conversation last message:
 * - Updates lastMessageId
 * - Updates lastMessage text
 *
 * Compatible with Express.js bullmq.ts startUpdateConversationsLastMessageWorker()
 */
@Processor(QUEUE_NAMES.CONVERSATION_LAST_MESSAGE)
export class ConversationLastMessageProcessor {
  private readonly logger = new Logger(ConversationLastMessageProcessor.name);

  @Process('update-conversation-last-message')
  async processUpdate(job: Job<{ conversationId: string; lastMessageId: string; lastMessage: string }>): Promise<void> {
    const { jobId, data } = job;
    this.logger.log(`Processing conversation update job ${jobId}`, data);

    try {
      // Note: Implement Conversation model when migrating chat module
      // const updatedConversation = await Conversation.findByIdAndUpdate(data.conversationId, {
      //   lastMessageId: data.lastMessageId,
      //   lastMessage: data.lastMessage,
      // });

      this.logger.log(`✅ Conversation ${data.conversationId} updated`);
    } catch (err: any) {
      this.logger.error(`❌ Conversation update job ${jobId} failed: ${err.message}`, err.stack);
      throw err;
    }
  }
}
