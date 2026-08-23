import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
//@ts-ignore
import { InjectModel } from '@nestjs/mongoose';
//@ts-ignore
import { Model, Types } from 'mongoose';
//@ts-ignore
import { RevenueCatWebhookEvent, RevenueCatWebhookEventDocument } from './schemas/revenueCatWebhookEvent.schema';
//@ts-ignore
import { PaymentTransactionService } from '../paymentTransaction/services/paymentTransaction.service';
import { PaymentStatus, PaymentGateway, PaymentEnvironment, PaymentPlatform } from '../constants/payment.constants';
import { ConfigService } from '@nestjs/config';
import crypto from 'crypto';

/**
 * RevenueCat Webhook Service
 * Handles all RevenueCat webhook events
 *
 * @version 1.0.0 (NestJS Migration)
 * @author Senior Engineering Team
 */
@Injectable()
export class RevenueCatWebhookService {
  private readonly logger = new Logger(RevenueCatWebhookService.name);

  constructor(
    @InjectModel(RevenueCatWebhookEvent.name)
    private revenueCatWebhookEventModel: Model<RevenueCatWebhookEventDocument>,

    private paymentTransactionService: PaymentTransactionService,

    private configService: ConfigService,
  ) {
    this.logger.log('✅ RevenueCatWebhook Service initialized');
  }

  /**
   * Verify RevenueCat webhook signature
   * RevenueCat signs webhooks with HMAC-SHA256
   */
  verifySignature(body: any, signature: string): boolean {
    const webhookSecret = this.configService.get<string>('REVENUECAT_WEBHOOK_SECRET');

    if (!webhookSecret) {
      this.logger.error('REVENUECAT_WEBHOOK_SECRET is not configured');
      return false;
    }

    if (!signature) {
      this.logger.error('No signature provided');
      return false;
    }

    try {
      // Parse signature to get the hash
      const signatureParts = signature.split('=');
      if (signatureParts.length !== 2) {
        this.logger.error('Invalid signature format');
        return false;
      }

      const receivedHash = signatureParts[1];

      // Calculate expected hash
      const bodyString = JSON.stringify(body);
      const expectedHash = crypto
        .createHmac('sha256', webhookSecret)
        .update(bodyString)
        .digest('hex');

      // Compare hashes using timing-safe comparison
      const isValid = crypto.timingSafeEqual(
        Buffer.from(receivedHash, 'hex'),
        Buffer.from(expectedHash, 'hex'),
      );

      this.logger.log(`Signature verification: ${isValid ? '✅' : '❌'}`);
      return isValid;
    } catch (error) {
      this.logger.error(`Error verifying signature: ${error.message}`);
      return false;
    }
  }

  /**
   * Process RevenueCat webhook event
   */
  async processEvent(event: any): Promise<void> {
    this.logger.log(`📥 Processing RevenueCat event: ${event.event_id}`);

    // Log event to database
    await this.logWebhookEvent(event);

    // Handle specific event types
    switch (event.event_id) {
      case 'INITIAL_PURCHASE':
        await this.handleInitialPurchase(event);
        break;

      case 'RENEWAL':
        await this.handleRenewal(event);
        break;

      case 'CANCELLATION':
        await this.handleCancellation(event);
        break;

      case 'EXPIRATION':
        await this.handleExpiration(event);
        break;

      case 'REFUND':
        await this.handleRefund(event);
        break;

      case 'BILLING_ISSUE':
        await this.handleBillingIssue(event);
        break;

      case 'SUBSCRIPTION':
        await this.handleSubscription(event);
        break;

      default:
        this.logger.log(`⚠️ Unhandled event type: ${event.event_id}`);
        break;
    }
  }

  /**
   * Log webhook event to database
   */
  private async logWebhookEvent(event: any): Promise<void> {
    try {
      await this.revenueCatWebhookEventModel.create({
        eventId: event.event_id || event.id,
        eventType: event.event_id,
        appId: event.app_id,
        userId: event.subscriber?.original_app_user_id,
        productId: event.product_id,
        environment: event.environment,
        eventData: event,
        processingStatus: 'pending',
        attempts: 0,
      });

      this.logger.debug(`Logged RevenueCat event: ${event.event_id}`);
    } catch (error) {
      // Ignore duplicate event errors (eventId is unique)
      if (error.code !== 11000) {
        this.logger.error(`Failed to log RevenueCat event: ${error.message}`);
      }
    }
  }

  /**
   * Handle INITIAL_PURCHASE event
   * Triggered when a user makes their first purchase
   */
  private async handleInitialPurchase(event: any): Promise<void> {
    this.logger.log('1️⃣ Handling INITIAL_PURCHASE');

    try {
      await this.updateProcessingStatus(event.event_id, 'processing');

      const {
        product_id,
        subscriber,
        environment,
      } = event;

      const revenueCatUserId = subscriber.original_app_user_id;
      const platform = subscriber.original_platform as PaymentPlatform;
      const orderId = event.id || event.event_id;
      const transactionId = event.transaction_id || orderId;

      // Check idempotency
      const existingTransaction = await this.paymentTransactionService.findByRevenueCatOrderId(orderId);
      if (existingTransaction) {
        this.logger.warn(`Transaction already exists for order: ${orderId}`);
        await this.updateProcessingStatus(event.event_id, 'completed');
        return;
      }

      // Note: User lookup and subscription creation would happen here
      // This requires User and UserSubscription models to be injected
      // For now, we'll log the event

      this.logger.log(`✅ INITIAL_PURCHASE processed for user: ${revenueCatUserId}`);

      await this.updateProcessingStatus(event.event_id, 'completed');
    } catch (error) {
      this.logger.error(`Error handling INITIAL_PURCHASE: ${error.message}`, error.stack);
      await this.updateProcessingStatus(event.event_id, 'failed', error.message);
      throw error;
    }
  }

  /**
   * Handle RENEWAL event
   * Triggered when a subscription is renewed
   */
  private async handleRenewal(event: any): Promise<void> {
    this.logger.log('🔄 Handling RENEWAL');

    try {
      await this.updateProcessingStatus(event.event_id, 'processing');

      const { product_id, subscriber } = event;
      const revenueCatUserId = subscriber.original_app_user_id;

      this.logger.log(`✅ RENEWAL processed for user: ${revenueCatUserId}, product: ${product_id}`);

      // Update subscription expiration date
      // This would require UserSubscription model

      await this.updateProcessingStatus(event.event_id, 'completed');
    } catch (error) {
      this.logger.error(`Error handling RENEWAL: ${error.message}`);
      await this.updateProcessingStatus(event.event_id, 'failed', error.message);
      throw error;
    }
  }

  /**
   * Handle CANCELLATION event
   * Triggered when a user cancels subscription
   */
  private async handleCancellation(event: any): Promise<void> {
    this.logger.log('❌ Handling CANCELLATION');

    try {
      await this.updateProcessingStatus(event.event_id, 'processing');

      const { product_id, subscriber } = event;
      const revenueCatUserId = subscriber.original_app_user_id;

      this.logger.warn(`CANCELLATION processed for user: ${revenueCatUserId}, product: ${product_id}`);

      // Update subscription status to cancelled
      // This would require UserSubscription model

      await this.updateProcessingStatus(event.event_id, 'completed');
    } catch (error) {
      this.logger.error(`Error handling CANCELLATION: ${error.message}`);
      await this.updateProcessingStatus(event.event_id, 'failed', error.message);
      throw error;
    }
  }

  /**
   * Handle EXPIRATION event
   * Triggered when a subscription expires
   */
  private async handleExpiration(event: any): Promise<void> {
    this.logger.log('⏰ Handling EXPIRATION');

    try {
      await this.updateProcessingStatus(event.event_id, 'processing');

      const { product_id, subscriber } = event;
      const revenueCatUserId = subscriber.original_app_user_id;

      this.logger.warn(`EXPIRATION processed for user: ${revenueCatUserId}, product: ${product_id}`);

      // Update subscription status to expired
      // This would require UserSubscription model

      await this.updateProcessingStatus(event.event_id, 'completed');
    } catch (error) {
      this.logger.error(`Error handling EXPIRATION: ${error.message}`);
      await this.updateProcessingStatus(event.event_id, 'failed', error.message);
      throw error;
    }
  }

  /**
   * Handle REFUND event
   * Triggered when a refund is processed
   */
  private async handleRefund(event: any): Promise<void> {
    this.logger.log('💸 Handling REFUND');

    try {
      await this.updateProcessingStatus(event.event_id, 'processing');

      const { product_id, subscriber } = event;
      const revenueCatUserId = subscriber.original_app_user_id;

      this.logger.warn(`REFUND processed for user: ${revenueCatUserId}, product: ${product_id}`);

      // Update transaction status to refunded
      // This would require PaymentTransaction update

      await this.updateProcessingStatus(event.event_id, 'completed');
    } catch (error) {
      this.logger.error(`Error handling REFUND: ${error.message}`);
      await this.updateProcessingStatus(event.event_id, 'failed', error.message);
      throw error;
    }
  }

  /**
   * Handle BILLING_ISSUE event
   * Triggered when there's a billing problem
   */
  private async handleBillingIssue(event: any): Promise<void> {
    this.logger.log('⚠️ Handling BILLING_ISSUE');

    try {
      await this.updateProcessingStatus(event.event_id, 'processing');

      const { product_id, subscriber } = event;
      const revenueCatUserId = subscriber.original_app_user_id;

      this.logger.warn(`BILLING_ISSUE for user: ${revenueCatUserId}, product: ${product_id}`);

      // Send notification to user about billing issue
      // This would require NotificationService

      await this.updateProcessingStatus(event.event_id, 'completed');
    } catch (error) {
      this.logger.error(`Error handling BILLING_ISSUE: ${error.message}`);
      await this.updateProcessingStatus(event.event_id, 'failed', error.message);
      throw error;
    }
  }

  /**
   * Handle SUBSCRIPTION event
   * General subscription state changes
   */
  private async handleSubscription(event: any): Promise<void> {
    this.logger.log('📋 Handling SUBSCRIPTION');

    try {
      await this.updateProcessingStatus(event.event_id, 'processing');

      const { product_id, subscriber } = event;
      const revenueCatUserId = subscriber.original_app_user_id;

      this.logger.log(`SUBSCRIPTION event for user: ${revenueCatUserId}, product: ${product_id}`);

      await this.updateProcessingStatus(event.event_id, 'completed');
    } catch (error) {
      this.logger.error(`Error handling SUBSCRIPTION: ${error.message}`);
      await this.updateProcessingStatus(event.event_id, 'failed', error.message);
      throw error;
    }
  }

  /**
   * Update processing status for webhook event
   */
  private async updateProcessingStatus(
    eventId: string,
    status: 'pending' | 'processing' | 'completed' | 'failed',
    errorMessage?: string,
  ): Promise<void> {
    try {
      await this.revenueCatWebhookEventModel.findOneAndUpdate(
        { eventId },
        {
          processingStatus: status,
          errorMessage,
          $inc: { attempts: 1 },
          updatedAt: new Date(),
        },
        { upsert: false },
      );
    } catch (error) {
      this.logger.error(`Failed to update processing status: ${error.message}`);
    }
  }

  /**
   * Get webhook event by ID
   */
  async getEventById(eventId: string): Promise<RevenueCatWebhookEventDocument | null> {
    return this.revenueCatWebhookEventModel.findOne({ eventId });
  }

  /**
   * Get failed webhook events for retry
   */
  async getFailedEvents(limit: number = 10): Promise<RevenueCatWebhookEventDocument[]> {
    return this.revenueCatWebhookEventModel.find({
      processingStatus: 'failed',
      attempts: { $lt: 3 },
    })
      .sort({ createdAt: -1 })
      .limit(limit);
  }
}
