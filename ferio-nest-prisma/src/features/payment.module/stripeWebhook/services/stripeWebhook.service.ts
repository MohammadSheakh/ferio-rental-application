import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { StripeWebhookEvent, StripeWebhookEventDocument } from './schemas/stripeWebhookEvent.schema';
import { PaymentTransactionService } from '../paymentTransaction/services/paymentTransaction.service';
import { PaymentStatus, PaymentGateway } from '../constants/payment.constants';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';

/**
 * Stripe Webhook Service
 * Handles all Stripe webhook events
 *
 * @version 1.0.0 (NestJS Migration)
 * @author Senior Engineering Team
 */
@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);
  private readonly stripe: Stripe;

  constructor(
    @InjectModel(StripeWebhookEvent.name)
    private stripeWebhookEventModel: Model<StripeWebhookEventDocument>,

    private paymentTransactionService: PaymentTransactionService,

    private configService: ConfigService,
  ) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');

    if (!stripeSecretKey) {
      throw new BadRequestException('STRIPE_SECRET_KEY is not configured');
    }

    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });

    this.logger.log('✅ StripeWebhook Service initialized');
  }

  /**
   * Construct and verify webhook event
   */
  async constructEvent(body: Buffer, signature: string): Promise<Stripe.Event> {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');

    if (!webhookSecret) {
      this.logger.error('STRIPE_WEBHOOK_SECRET is not configured');
      throw new BadRequestException('Webhook secret not configured');
    }

    try {
      const event = this.stripe.webhooks.constructEvent(body, signature, webhookSecret);
      this.logger.log(`✅ Verified webhook event: ${event.type}`);
      return event;
    } catch (error) {
      this.logger.error(`❌ Webhook signature verification failed: ${error.message}`);
      throw new BadRequestException('Invalid webhook signature');
    }
  }

  /**
   * Process webhook event
   */
  async processEvent(event: Stripe.Event): Promise<void> {
    this.logger.log(`📥 Processing webhook event: ${event.id} (${event.type})`);

    // Log event to database
    await this.logWebhookEvent(event);

    // Handle specific event types
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutSessionCompleted(event);
        break;

      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(event);
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentIntentFailed(event);
        break;

      case 'payment_intent.canceled':
        await this.handlePaymentIntentCanceled(event);
        break;

      case 'charge.refunded':
        await this.handleChargeRefunded(event);
        break;

      case 'charge.dispute.created':
        await this.handleChargeDisputed(event);
        break;

      default:
        this.logger.log(`⚠️ Unhandled event type: ${event.type}`);
        break;
    }
  }

  /**
   * Log webhook event to database
   */
  private async logWebhookEvent(event: Stripe.Event): Promise<void> {
    try {
      const data = event.data.object as any;

      await this.stripeWebhookEventModel.create({
        eventId: event.id,
        eventType: event.type,
        accountId: event.account,
        paymentIntentId: data.payment_intent || data.id,
        customerId: data.customer,
        amount: data.amount,
        currency: data.currency,
        eventData: event,
        processingStatus: 'pending',
        attempts: 0,
      });

      this.logger.debug(`Logged webhook event: ${event.id}`);
    } catch (error) {
      // Ignore duplicate event errors (eventId is unique)
      if (error.code !== 11000) {
        this.logger.error(`Failed to log webhook event: ${error.message}`);
      }
    }
  }

  /**
   * Handle checkout.session.completed
   */
  private async handleCheckoutSessionCompleted(event: Stripe.Event): Promise<void> {
    this.logger.log('📦 Handling checkout.session.completed');

    const session = event.data.object as Stripe.Checkout.Session;

    try {
      // Update processing status
      await this.updateProcessingStatus(event.id, 'processing');

      // Extract metadata
      const metadata = session.metadata || {};
      const userId = metadata.userId;
      const referenceId = metadata.referenceId;
      const referenceType = metadata.referenceType;

      this.logger.debug(`Metadata: userId=${userId}, referenceId=${referenceId}`);

      // Find or create payment transaction
      const existingTransaction = await this.paymentTransactionService.findByRevenueCatOrderId(
        session.id,
      );

      if (existingTransaction) {
        this.logger.warn(`Transaction already exists for session: ${session.id}`);
        await this.updateProcessingStatus(event.id, 'completed');
        return;
      }

      // Create payment transaction
      await this.paymentTransactionService.create({
        userId: new Types.ObjectId(userId),
        referenceFor: referenceType as any,
        referenceId: new Types.ObjectId(referenceId),
        paymentGateway: PaymentGateway.stripe,
        transactionId: session.id,
        paymentIntent: session.payment_intent as string,
        amount: session.amount_total ? session.amount_total / 100 : 0,
        currency: session.currency?.toUpperCase() || 'USD',
        paymentStatus: PaymentStatus.completed,
        gatewayResponse: session,
      });

      this.logger.log(`✅ Created payment transaction for session: ${session.id}`);

      await this.updateProcessingStatus(event.id, 'completed');
    } catch (error) {
      this.logger.error(`Error handling checkout.session.completed: ${error.message}`, error.stack);
      await this.updateProcessingStatus(event.id, 'failed', error.message);
      throw error;
    }
  }

  /**
   * Handle payment_intent.succeeded
   */
  private async handlePaymentIntentSucceeded(event: Stripe.Event): Promise<void> {
    this.logger.log('💰 Handling payment_intent.succeeded');

    const paymentIntent = event.data.object as Stripe.PaymentIntent;

    try {
      await this.updateProcessingStatus(event.id, 'processing');

      // Find transaction by payment intent ID
      // Note: This would require a custom method in PaymentTransactionService
      // For now, we'll log the event

      this.logger.log(`✅ Payment succeeded: ${paymentIntent.id}, amount: ${paymentIntent.amount}`);

      await this.updateProcessingStatus(event.id, 'completed');
    } catch (error) {
      this.logger.error(`Error handling payment_intent.succeeded: ${error.message}`);
      await this.updateProcessingStatus(event.id, 'failed', error.message);
      throw error;
    }
  }

  /**
   * Handle payment_intent.payment_failed
   */
  private async handlePaymentIntentFailed(event: Stripe.Event): Promise<void> {
    this.logger.log('❌ Handling payment_intent.payment_failed');

    const paymentIntent = event.data.object as Stripe.PaymentIntent;

    try {
      await this.updateProcessingStatus(event.id, 'processing');

      this.logger.warn(`Payment failed: ${paymentIntent.id}, reason: ${paymentIntent.last_payment_error?.message}`);

      // Update transaction status to failed if exists
      // This would require a custom method in PaymentTransactionService

      await this.updateProcessingStatus(event.id, 'completed');
    } catch (error) {
      this.logger.error(`Error handling payment_intent.payment_failed: ${error.message}`);
      await this.updateProcessingStatus(event.id, 'failed', error.message);
      throw error;
    }
  }

  /**
   * Handle payment_intent.canceled
   */
  private async handlePaymentIntentCanceled(event: Stripe.Event): Promise<void> {
    this.logger.log('🚫 Handling payment_intent.canceled');

    const paymentIntent = event.data.object as Stripe.PaymentIntent;

    try {
      await this.updateProcessingStatus(event.id, 'processing');

      this.logger.log(`Payment canceled: ${paymentIntent.id}`);

      await this.updateProcessingStatus(event.id, 'completed');
    } catch (error) {
      this.logger.error(`Error handling payment_intent.canceled: ${error.message}`);
      await this.updateProcessingStatus(event.id, 'failed', error.message);
      throw error;
    }
  }

  /**
   * Handle charge.refunded
   */
  private async handleChargeRefunded(event: Stripe.Event): Promise<void> {
    this.logger.log('💸 Handling charge.refunded');

    const charge = event.data.object as Stripe.Charge;

    try {
      await this.updateProcessingStatus(event.id, 'processing');

      this.logger.log(`Charge refunded: ${charge.id}, amount: ${charge.amount_refunded}`);

      // Update transaction status to refunded if exists
      // This would require updating PaymentTransactionService

      await this.updateProcessingStatus(event.id, 'completed');
    } catch (error) {
      this.logger.error(`Error handling charge.refunded: ${error.message}`);
      await this.updateProcessingStatus(event.id, 'failed', error.message);
      throw error;
    }
  }

  /**
   * Handle charge.dispute.created
   */
  private async handleChargeDisputed(event: Stripe.Event): Promise<void> {
    this.logger.log('⚠️ Handling charge.dispute.created');

    const dispute = event.data.object as Stripe.Dispute;

    try {
      await this.updateProcessingStatus(event.id, 'processing');

      this.logger.warn(`Dispute created: ${dispute.id}, amount: ${dispute.amount}, reason: ${dispute.reason}`);

      // Update transaction status to disputed if exists
      // This would require updating PaymentTransactionService

      await this.updateProcessingStatus(event.id, 'completed');
    } catch (error) {
      this.logger.error(`Error handling charge.dispute.created: ${error.message}`);
      await this.updateProcessingStatus(event.id, 'failed', error.message);
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
      await this.stripeWebhookEventModel.findOneAndUpdate(
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
  async getEventById(eventId: string): Promise<StripeWebhookEventDocument | null> {
    return this.stripeWebhookEventModel.findOne({ eventId });
  }

  /**
   * Get failed webhook events for retry
   */
  async getFailedEvents(limit: number = 10): Promise<StripeWebhookEventDocument[]> {
    return this.stripeWebhookEventModel.find({
      processingStatus: 'failed',
      attempts: { $lt: 3 }, // Retry up to 3 times
    })
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  /**
   * Retry failed webhook event
   */
  async retryFailedEvent(eventId: string): Promise<void> {
    const event = await this.getEventById(eventId);

    if (!event) {
      throw new BadRequestException('Webhook event not found');
    }

    this.logger.log(`🔄 Retrying failed webhook event: ${eventId}`);

    // Re-process the event
    await this.processEvent(event.eventData as any);
  }
}
