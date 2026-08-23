import { Processor, Process } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { QUEUE_NAMES, BULLMQ_NOTIFICATION_QUEUE } from './bullmq.constants';
import { Notification, NotificationDocument } from '../../modules/notification.module/notification.schema';
import { SocketGateway } from '../../modules/socket.gateway/socket.gateway';
import { SendNotificationDto } from '../../modules/notification.module/dto/notification.dto';

/**
 * Notification Processor
 *
 * 📚 BULLMQ WORKER FOR ASYNC NOTIFICATION PROCESSING
 *
 * Processes notification jobs from the queue:
 * - Creates notification in database
 * - Emits real-time notification via Socket.IO
 * - Handles admin and user notifications differently
 *
 * Compatible with Express.js bullmq.ts startNotificationWorker()
 */
@Processor(QUEUE_NAMES.NOTIFICATION)
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
    @Inject(BULLMQ_NOTIFICATION_QUEUE) private notificationQueue: any,
    private socketGateway: SocketGateway,
  ) {}

  @Process('send-notification')
  async processNotification(job: Job<SendNotificationDto>): Promise<void> {
    const { jobId, name, data } = job;
    this.logger.log(`Processing notification job ${jobId} ⚡ ${name}`, data);

    try {
      // Create notification in DB
      const notification = await this.notificationModel.create({
        title: data.title,
        senderId: data.senderId ? new Types.ObjectId(data.senderId) : undefined,
        receiverId: data.receiverId ? new Types.ObjectId(data.receiverId) : undefined,
        receiverRole: data.receiverRole,
        type: data.type,
        linkFor: data.linkFor,
        linkId: data.linkId ? new Types.ObjectId(data.linkId) : undefined,
        referenceFor: data.referenceFor,
        referenceId: data.referenceId ? new Types.ObjectId(data.referenceId) : undefined,
      });

      this.logger.log(`✅ Notification created for ${data.receiverRole} :: `, notification);

      // Prepare notification data for emission
      const notificationData = {
        title: data.title,
        senderId: data.senderId,
        receiverId: data.receiverId,
        receiverRole: data.receiverRole,
        type: data.type,
        linkFor: data.linkFor,
        linkId: data.linkId,
        referenceFor: data.referenceFor,
        referenceId: data.referenceId,
      };

      // Emit via Socket.IO
      if (data.receiverRole === 'admin') {
        // Broadcast to admin role
        await this.socketGateway.broadcastToRole('admin', 'notification::admin', notificationData);
        this.logger.log(`🔔 Real-time notification sent to admin role`);
      } else {
        // Send to specific user
        const receiverId = data.receiverId?.toString();
        const emitted = await this.socketGateway.emitNotificationToUser(receiverId, notificationData);

        if (emitted) {
          this.logger.log(`🔔 Real-time notification sent to user ${receiverId}`);
        } else {
          this.logger.log(`📴 User ${receiverId} is offline, notification saved in DB only`);
        }
      }
    } catch (err: any) {
      this.logger.error(`❌ Notification job ${jobId} failed: ${err.message}`, err.stack);
      throw err; // ensures retry/backoff
    }
  }
}
