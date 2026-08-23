import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserSubscription, UserSubscriptionDocument } from '../userSubscription/schemas/userSubscription.schema';
import { UserSubscriptionStatus } from '../userSubscription/constants/userSubscription.constants';
import { PaymentTransactionService } from '../../payment.module/paymentTransaction/services/paymentTransaction.service';
import { PaymentStatus, PaymentGateway } from '../../payment.module/payment/constants/payment.constants';
import { TTransactionFor } from '../../../constants/TTransactionFor';
import crypto from 'crypto';

/**
 * RevenueCat Webhook Service
 * Handles RevenueCat subscription webhook events
 */
@Injectable()
export class RevenueCatWebhookService {
  private readonly logger = new Logger(RevenueCatWebhookService.name);
  private readonly webhookSecret: string;

  constructor(
    @InjectModel(UserSubscription.name)
    private userSubscriptionModel: Model<UserSubscriptionDocument>,

    private paymentTransactionService: PaymentTransactionService,
    private configService: ConfigService,
  ) {
    this.webhookSecret = this.configService.get<string>('REVENUECAT_WEBHOOK_SECRET');
    this.logger.log('✅ RevenueCat Webhook Service initialized');
  }

  /**
   * Verify RevenueCat webhook signature
   */
  verifySignature(body: any, signature: string): boolean {
    if (!this.webhookSecret) {
      this.logger.error('REVENUECAT_WEBHOOK_SECRET not configured');
      return false;
    }

    if (!signature) return false;

    try {
      const parts = signature.split('=');
      if (parts.length !== 2) return false;

      const receivedHash = parts[1];
      const expectedHash = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(JSON.stringify(body))
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(receivedHash, 'hex'),
        Buffer.from(expectedHash, 'hex'),
      );
    } catch (error) {
      this.logger.error(`Signature verification error: ${error.message}`);
      return false;
    }
  }

  /**
   * Process RevenueCat webhook event
   */
  async processEvent(event: any): Promise<void> {
    this.logger.log(`Processing RevenueCat event: ${event.event_id}`);

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
      default:
        this.logger.warn(`Unhandled event type: ${event.event_id}`);
    }
  }

  /**
   * Handle INITIAL_PURCHASE - First subscription purchase
   */
  private async handleInitialPurchase(event: any): Promise<void> {
    this.logger.log('1️⃣ Handling INITIAL_PURCHASE');

    const { product_id, subscriber, environment } = event;
    const revenueCatUserId = subscriber.original_app_user_id;
    const platform = subscriber.original_platform as 'ios' | 'android';
    const orderId = event.id || event.event_id;

    // Check idempotency
    const existing = await this.userSubscriptionModel.findOne({ revenueCatOrderId: orderId });
    if (existing) {
      this.logger.warn(`Subscription already exists: ${orderId}`);
      return;
    }

    // Find user by RevenueCat ID
    const { User } = await import('../../user.module/user/user.schema');
    const user = await User.findOne({ revenueCatUserId });
    if (!user) {
      this.logger.error(`User not found: ${revenueCatUserId}`);
      return;
    }

    // Create user subscription
    const subscription = await this.userSubscriptionModel.create({
      userId: user._id,
      subscriptionPlanId: null, // Will be mapped later
      paymentGateway: PaymentGateway.revenuecat,
      purchasePlatform: platform,
      revenueCatUserId,
      revenueCatOrderId: orderId,
      revenueCatEnvironment: environment as 'production' | 'sandbox',
      subscriptionStartDate: new Date(event.event_time_ms),
      currentPeriodStartDate: new Date(event.event_time_ms),
      expirationDate: new Date(subscriber.expiration_at_ms),
      renewalDate: new Date(subscriber.expiration_at_ms),
      billingCycle: 1,
      isAutoRenewed: true,
      status: UserSubscriptionStatus.active,
      isActive: true,
      isFromFreeTrial: false,
      cancelledAtPeriodEnd: false,
    });

    this.logger.log(`✅ Created subscription: ${subscription._id}`);
  }

  /**
   * Handle RENEWAL - Subscription renewed
   */
  private async handleRenewal(event: any): Promise<void> {
    this.logger.log('🔄 Handling RENEWAL');

    const { subscriber } = event;
    const revenueCatUserId = subscriber.original_app_user_id;

    const subscription = await this.userSubscriptionModel.findOne({ revenueCatUserId });
    if (subscription) {
      subscription.expirationDate = new Date(subscriber.expiration_at_ms);
      subscription.renewalDate = new Date(subscriber.expiration_at_ms);
      subscription.billingCycle += 1;
      await subscription.save();
      this.logger.log(`✅ Renewed subscription for user: ${revenueCatUserId}`);
    }
  }

  /**
   * Handle CANCELLATION - User cancelled subscription
   */
  private async handleCancellation(event: any): Promise<void> {
    this.logger.log('❌ Handling CANCELLATION');

    const { subscriber } = event;
    const revenueCatUserId = subscriber.original_app_user_id;

    const subscription = await this.userSubscriptionModel.findOne({ revenueCatUserId });
    if (subscription) {
      subscription.cancelledAt = new Date();
      subscription.cancelledAtPeriodEnd = true;
      subscription.status = UserSubscriptionStatus.cancelled;
      await subscription.save();
      this.logger.log(`✅ Cancelled subscription: ${subscription._id}`);
    }
  }

  /**
   * Handle EXPIRATION - Subscription expired
   */
  private async handleExpiration(event: any): Promise<void> {
    this.logger.log('⏰ Handling EXPIRATION');

    const { subscriber } = event;
    const revenueCatUserId = subscriber.original_app_user_id;

    const subscription = await this.userSubscriptionModel.findOne({ revenueCatUserId });
    if (subscription) {
      subscription.status = UserSubscriptionStatus.incomplete_expired;
      subscription.isActive = false;
      await subscription.save();
      this.logger.log(`✅ Expired subscription: ${subscription._id}`);
    }
  }

  /**
   * Handle REFUND - Refund processed
   */
  private async handleRefund(event: any): Promise<void> {
    this.logger.log('💸 Handling REFUND');

    const { subscriber } = event;
    const revenueCatUserId = subscriber.original_app_user_id;

    const subscription = await this.userSubscriptionModel.findOne({ revenueCatUserId });
    if (subscription) {
      subscription.status = UserSubscriptionStatus.past_due;
      await subscription.save();
      this.logger.log(`✅ Refunded subscription: ${subscription._id}`);
    }
  }

  /**
   * Handle BILLING_ISSUE - Payment failed
   */
  private async handleBillingIssue(event: any): Promise<void> {
    this.logger.log('⚠️ Handling BILLING_ISSUE');

    const { subscriber } = event;
    const revenueCatUserId = subscriber.original_app_user_id;

    const subscription = await this.userSubscriptionModel.findOne({ revenueCatUserId });
    if (subscription) {
      subscription.status = UserSubscriptionStatus.payment_failed;
      await subscription.save();
      this.logger.log(`✅ Billing issue recorded: ${subscription._id}`);
    }
  }
}
