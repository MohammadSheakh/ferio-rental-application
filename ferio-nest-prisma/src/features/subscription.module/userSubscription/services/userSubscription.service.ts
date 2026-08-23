import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserSubscription, UserSubscriptionDocument } from './schemas/userSubscription.schema';
import { UserSubscriptionStatus } from './constants/userSubscription.constants';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { User, UserDocument } from '../../user.module/user/user.schema';
import { SubscriptionPlan, SubscriptionPlanDocument } from '../subscriptionPlan/schemas/subscriptionPlan.schema';
import { TTransactionFor } from '../../../constants/TTransactionFor';

/**
 * UserSubscription Service
 * Handles user subscription lifecycle, free trials, and Stripe integration
 *
 * @version 1.0.0 (NestJS Migration)
 * @author Senior Engineering Team
 */
@Injectable()
export class UserSubscriptionService {
  private readonly logger = new Logger(UserSubscriptionService.name);
  private readonly stripe: Stripe;

  constructor(
    @InjectModel(UserSubscription.name)
    private userSubscriptionModel: Model<UserSubscriptionDocument>,

    @InjectModel(SubscriptionPlan.name)
    private subscriptionPlanModel: Model<SubscriptionPlanDocument>,

    @InjectModel(User.name)
    private userModel: Model<UserDocument>,

    private configService: ConfigService,
  ) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');

    if (!stripeSecretKey) {
      throw new BadRequestException('STRIPE_SECRET_KEY is not configured');
    }

    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });

    this.logger.log('✅ UserSubscription Service initialized');
  }

  /**
   * Get or create Stripe customer
   */
  async getOrCreateStripeCustomer(user: UserDocument): Promise<string> {
    this.logger.debug(`Getting or creating Stripe customer for user ${user._id}`);

    if (user.stripe_customer_id) {
      try {
        const customer = await this.stripe.customers.retrieve(user.stripe_customer_id);
        if (!customer.deleted) {
          this.logger.debug(`Using existing Stripe customer: ${user.stripe_customer_id}`);
          return user.stripe_customer_id;
        }
      } catch (error) {
        this.logger.warn(`Failed to retrieve Stripe customer: ${error.message}`);
      }
    }

    const customer = await this.stripe.customers.create({
      name: user.name || user.userName,
      email: user.email,
      metadata: { userId: user._id.toString() },
    });

    await this.userModel.findByIdAndUpdate(user._id, {
      $set: { stripe_customer_id: customer.id },
    });

    this.logger.log(`Created new Stripe customer: ${customer.id}`);
    return customer.id;
  }

  /**
   * Start free trial (7 days with card collection)
   * Creates Stripe checkout session for trial
   *
   * @param userId - User ID
   * @returns Stripe checkout URL
   */
  async startFreeTrial(userId: string): Promise<{ url: string }> {
    this.logger.log(`Starting free trial for user ${userId}`);

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if user already used free trial
    if (user.hasUsedFreeTrial) {
      throw new BadRequestException('User is not eligible for free trial');
    }

    // Get active individual plan
    const individualPlan = await this.subscriptionPlanModel.findOne({
      subscriptionType: 'individual',
      isActive: true,
      isDeleted: false,
    });

    if (!individualPlan) {
      throw new NotFoundException('No active individual plan found');
    }

    // Get or create Stripe customer
    const stripeCustomer = await this.getOrCreateStripeCustomer(user);

    // Create user subscription record
    const newUserSubscription = await this.userSubscriptionModel.create({
      userId: user._id,
      subscriptionPlanId: null, // Will be assigned after trial
      subscriptionStartDate: new Date(),
      currentPeriodStartDate: null,
      expirationDate: null,
      isFromFreeTrial: true,
      cancelledAtPeriodEnd: false,
      status: UserSubscriptionStatus.processing,
      billingCycle: 0,
      paymentGateway: 'stripe',
      purchasePlatform: 'web',
    });

    this.logger.log(`Created user subscription: ${newUserSubscription._id}`);

    // Create Stripe checkout session for trial
    const session = await this.stripe.checkout.sessions.create({
      customer: stripeCustomer,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: individualPlan.stripe_price_id,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 7, // 7 days free trial
        metadata: {
          userId: user._id.toString(),
          subscriptionType: 'individual',
          subscriptionPlanId: individualPlan._id.toString(),
          referenceId: newUserSubscription._id.toString(),
          referenceFor: TTransactionFor.UserSubscription,
          currency: 'usd',
          amount: '70', // Amount to charge after trial
        },
      },
      success_url: this.configService.get('CLIENT_URL') + '/subscription/success',
      cancel_url: this.configService.get('CLIENT_URL') + '/subscription/cancel',
    });

    // Mark user as having used free trial
    await this.userModel.findByIdAndUpdate(userId, {
      $set: { hasUsedFreeTrial: true },
    });

    this.logger.log(`Created Stripe trial session: ${session.id}`);
    return { url: session.url };
  }

  /**
   * Purchase subscription for user
   * Creates Stripe checkout session
   *
   * @param subscriptionPlanId - Plan ID to purchase
   * @param userId - User ID
   * @returns Stripe checkout URL
   */
  async purchaseSubscription(
    subscriptionPlanId: string,
    userId: string,
  ): Promise<{ url: string }> {
    this.logger.log(`Purchasing subscription ${subscriptionPlanId} for user ${userId}`);

    const subscriptionPlan = await this.subscriptionPlanModel.findById(subscriptionPlanId);
    if (!subscriptionPlan) {
      throw new NotFoundException('Subscription plan not found');
    }

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get or create Stripe customer
    const stripeCustomer = await this.getOrCreateStripeCustomer(user);

    // Create user subscription record
    const newUserSubscription = await this.userSubscriptionModel.create({
      userId: user._id,
      subscriptionPlanId: null, // Will be assigned after payment
      subscriptionStartDate: null,
      currentPeriodStartDate: null,
      expirationDate: null,
      isFromFreeTrial: false,
      cancelledAtPeriodEnd: false,
      status: UserSubscriptionStatus.processing,
      billingCycle: 0,
      paymentGateway: 'stripe',
      purchasePlatform: 'web',
    });

    this.logger.log(`Created user subscription: ${newUserSubscription._id}`);

    // Create Stripe checkout session
    const session = await this.stripe.checkout.sessions.create({
      customer: stripeCustomer,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: subscriptionPlan.stripe_price_id,
          quantity: 1,
        },
      ],
      subscription_data: {
        metadata: {
          userId: user._id.toString(),
          subscriptionType: subscriptionPlan.subscriptionType,
          subscriptionPlanId: subscriptionPlan._id.toString(),
          referenceId: newUserSubscription._id.toString(),
          referenceFor: TTransactionFor.UserSubscription,
          currency: subscriptionPlan.currency,
          amount: subscriptionPlan.amount,
          planNickname: subscriptionPlan.subscriptionName,
        },
      },
      metadata: {
        referenceId: newUserSubscription._id.toString(),
        referenceFor: TTransactionFor.UserSubscription,
        userId: user._id.toString(),
        currency: subscriptionPlan.currency,
        amount: subscriptionPlan.amount,
      },
      success_url: this.configService.get('CLIENT_URL') + '/subscription/success',
      cancel_url: this.configService.get('CLIENT_URL') + '/subscription/cancel',
    });

    this.logger.log(`Created Stripe checkout session: ${session.id}`);
    return { url: session.url };
  }

  /**
   * Get user's active subscription
   */
  async getActiveSubscription(userId: string): Promise<UserSubscriptionDocument | null> {
    this.logger.debug(`Getting active subscription for user ${userId}`);

    return this.userSubscriptionModel.findOne({
      userId: new Types.ObjectId(userId),
      status: { $in: [UserSubscriptionStatus.active, UserSubscriptionStatus.trialing] },
      isDeleted: false,
    }).sort({ createdAt: -1 });
  }

  /**
   * Get user's subscription history
   */
  async getSubscriptionHistory(userId: string): Promise<UserSubscriptionDocument[]> {
    return this.userSubscriptionModel.find({
      userId: new Types.ObjectId(userId),
      isDeleted: false,
    }).sort({ createdAt: -1 });
  }

  /**
   * Update subscription status
   */
  async updateSubscriptionStatus(
    subscriptionId: string,
    status: UserSubscriptionStatus,
  ): Promise<UserSubscriptionDocument> {
    this.logger.log(`Updating subscription ${subscriptionId} status to ${status}`);

    const subscription = await this.userSubscriptionModel.findById(subscriptionId);
    if (!subscription) {
      throw new NotFoundException('User subscription not found');
    }

    subscription.status = status;
    await subscription.save();

    this.logger.log(`Updated subscription status to ${status}`);
    return subscription;
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId: string): Promise<UserSubscriptionDocument> {
    this.logger.log(`Cancelling subscription ${subscriptionId}`);

    const subscription = await this.userSubscriptionModel.findById(subscriptionId);
    if (!subscription) {
      throw new NotFoundException('User subscription not found');
    }

    subscription.cancelledAt = new Date();
    subscription.cancelledAtPeriodEnd = true;
    subscription.status = UserSubscriptionStatus.cancelled;
    await subscription.save();

    this.logger.log(`Cancelled subscription ${subscriptionId}`);
    return subscription;
  }

  /**
   * Activate subscription after successful payment
   */
  async activateSubscription(
    subscriptionId: string,
    subscriptionPlanId: string,
    stripeSubscriptionId: string,
  ): Promise<UserSubscriptionDocument> {
    this.logger.log(`Activating subscription ${subscriptionId}`);

    const subscription = await this.userSubscriptionModel.findById(subscriptionId);
    if (!subscription) {
      throw new NotFoundException('User subscription not found');
    }

    subscription.subscriptionPlanId = new Types.ObjectId(subscriptionPlanId);
    subscription.stripe_subscription_id = stripeSubscriptionId;
    subscription.subscriptionStartDate = new Date();
    subscription.currentPeriodStartDate = new Date();
    subscription.status = UserSubscriptionStatus.active;
    subscription.billingCycle = 1;
    subscription.isAutoRenewed = true;

    await subscription.save();

    // Update user's subscription type
    const plan = await this.subscriptionPlanModel.findById(subscriptionPlanId);
    if (plan) {
      await this.userModel.findByIdAndUpdate(subscription.userId, {
        $set: { subscriptionType: plan.subscriptionType },
      });
    }

    this.logger.log(`Activated subscription ${subscriptionId}`);
    return subscription;
  }

  /**
   * Find subscription by Stripe session ID (for webhook processing)
   */
  async findByStripeSessionId(sessionId: string): Promise<UserSubscriptionDocument | null> {
    // Note: This would require storing stripe_session_id in the schema
    // For now, we'll search by stripe_subscription_id
    return this.userSubscriptionModel.findOne({
      stripe_subscription_id: sessionId,
      isDeleted: false,
    });
  }

  /**
   * Find subscription by Stripe subscription ID
   */
  async findByStripeSubscriptionId(
    stripeSubscriptionId: string,
  ): Promise<UserSubscriptionDocument | null> {
    return this.userSubscriptionModel.findOne({
      stripe_subscription_id: stripeSubscriptionId,
      isDeleted: false,
    });
  }

  /**
   * Find subscription by RevenueCat order ID
   */
  async findByRevenueCatOrderId(orderId: string): Promise<UserSubscriptionDocument | null> {
    return this.userSubscriptionModel.findOne({
      revenueCatOrderId: orderId,
      isDeleted: false,
    });
  }
}
