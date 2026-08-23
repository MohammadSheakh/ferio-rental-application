import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SubscriptionPlan, SubscriptionPlanDocument } from './schemas/subscriptionPlan.schema';
import { CreateSubscriptionPlanDto } from './dto/subscriptionPlan.dto';
import { SubscriptionType, STRIPE_SUBSCRIPTION_CONFIG } from '../constants/subscriptionPlan.constants';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { User, UserDocument } from '../../user.module/user/user.schema';

/**
 * SubscriptionPlan Service
 * Handles subscription plan management and Stripe integration
 *
 * @version 1.0.0 (NestJS Migration)
 * @author Senior Engineering Team
 */
@Injectable()
export class SubscriptionPlanService {
  private readonly logger = new Logger(SubscriptionPlanService.name);
  private readonly stripe: Stripe;

  constructor(
    @InjectModel(SubscriptionPlan.name)
    private subscriptionPlanModel: Model<SubscriptionPlanDocument>,

    private configService: ConfigService,
  ) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');

    if (!stripeSecretKey) {
      throw new BadRequestException('STRIPE_SECRET_KEY is not configured');
    }

    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });

    this.logger.log('✅ SubscriptionPlan Service initialized');
  }

  /**
   * Get subscription plan by type
   */
  async getBySubscriptionType(
    subscriptionType: SubscriptionType,
  ): Promise<SubscriptionPlanDocument | null> {
    this.logger.debug(`Finding active plan for type: ${subscriptionType}`);

    return this.subscriptionPlanModel.findOne({
      subscriptionType,
      isActive: true,
      isDeleted: false,
    });
  }

  /**
   * Get all active subscription plans
   */
  async findActivePlans(): Promise<SubscriptionPlanDocument[]> {
    this.logger.debug('Finding all active plans');

    return this.subscriptionPlanModel.find({
      isActive: true,
      isDeleted: false,
    }).sort({ amount: 1 });
  }

  /**
   * Find plan by Stripe price ID
   */
  async findByStripePriceId(priceId: string): Promise<SubscriptionPlanDocument | null> {
    return this.subscriptionPlanModel.findOne({
      stripe_price_id: priceId,
      isDeleted: false,
    });
  }

  /**
   * Find plan by RevenueCat product identifier
   */
  async findByRevenueCatProduct(
    productIdentifier: string,
  ): Promise<SubscriptionPlanDocument | null> {
    return this.subscriptionPlanModel.findOne({
      revenueCatProductIdentifier: productIdentifier,
      isDeleted: false,
    });
  }

  /**
   * Create subscription plan (Admin Dashboard)
   *
   * Business Logic:
   * - Individual plans → RevenueCat (iOS/Android mobile apps)
   * - Business plans → Stripe (web)
   *
   * @param planData - Subscription plan data from admin
   * @returns Created subscription plan with metadata
   *
   * @description
   * For Stripe: Automatically creates product and price in Stripe
   * For RevenueCat: Generates product identifiers (admin must create in RevenueCat dashboard)
   */
  async createSubscriptionPlan(
    planData: CreateSubscriptionPlanDto & {
      revenueCatProductIdentifier?: string;
      revenueCatPackageIdentifier?: string;
    },
  ): Promise<{
    plan: SubscriptionPlanDocument;
    metadata: {
      stripeProductId?: string;
      stripePriceId?: string;
      revenueCatSetupRequired?: boolean;
      revenueCatProductIdentifier?: string;
      revenueCatPackageIdentifier?: string;
      dashboardUrl?: string;
    };
  }> {
    this.logger.log(`Creating subscription plan: ${planData.subscriptionName}`);

    // Deactivate existing plans with same subscription type
    const existingPlans = await this.subscriptionPlanModel.find({
      isActive: true,
      subscriptionType: planData.subscriptionType,
      isDeleted: false,
    });

    for (const plan of existingPlans) {
      plan.isActive = false;
      await plan.save();
      this.logger.log(`Deactivated plan: ${plan._id}`);
    }

    // Prepare plan data
    const data: Partial<SubscriptionPlanDocument> = {
      subscriptionName: planData.subscriptionName,
      amount: planData.amount,
      subscriptionType: planData.subscriptionType,
      initialDuration: planData.initialDuration || 'month',
      renewalFrequncy: planData.renewalFrequncy || 'monthly',
      currency: planData.currency || 'usd',
      isActive: true,
      maxChildrenAccount: planData.maxChildrenAccount,
      freeTrialEnabled: planData.freeTrialEnabled,
      freeTrialDurationDays: planData.freeTrialDurationDays,
      purchaseChannel: planData.purchaseChannel,
      availablePlatforms: planData.availablePlatforms,
      revenueCatProductIdentifier: planData.revenueCatProductIdentifier,
      revenueCatPackageIdentifier: planData.revenueCatPackageIdentifier,
    };

    // Set purchase channel based on subscription type if not provided
    if (!data.purchaseChannel) {
      if (planData.subscriptionType === SubscriptionType.individual) {
        data.purchaseChannel = 'revenuecat'; // Individual plans use RevenueCat
        data.availablePlatforms = ['ios', 'android'];
      } else {
        data.purchaseChannel = 'stripe'; // Business plans use Stripe
        data.availablePlatforms = ['web'];
      }
    }

    // Create Stripe product and price (for Business plans or both)
    if (
      data.purchaseChannel === 'stripe' ||
      data.purchaseChannel === 'both'
    ) {
      try {
        this.logger.log('Creating Stripe product and price...');

        const product = await this.stripe.products.create({
          name: data.subscriptionType,
          description: `Subscription plan for ${data.subscriptionType}`,
        });

        const price = await this.stripe.prices.create({
          unit_amount: Math.round(parseFloat(data.amount as string) * 100), // Amount in cents
          currency: data.currency as string,
          recurring: {
            interval: 'month',
            interval_count: 1,
          },
          product: product.id,
        });

        data.stripe_product_id = product.id;
        data.stripe_price_id = price.id;

        this.logger.log(`Created Stripe product: ${product.id}, price: ${price.id}`);
      } catch (error) {
        this.logger.error(`Failed to create Stripe product/price: ${error.message}`);
        throw new BadRequestException(
          `Failed to create Stripe product: ${error.message}`,
        );
      }
    }

    // Set RevenueCat identifiers (for Individual plans or both)
    if (
      data.purchaseChannel === 'revenuecat' ||
      data.purchaseChannel === 'both'
    ) {
      data.revenueCatProductIdentifier =
        planData.revenueCatProductIdentifier ||
        `${data.subscriptionType}_monthly`;

      data.revenueCatPackageIdentifier =
        planData.revenueCatPackageIdentifier || 'monthly';

      // Log setup instructions for admin
      this.logger.log(`
╔══════════════════════════════════════════════════════════════╗
║  📱 REVENUECAT PRODUCT SETUP REQUIRED                        ║
╠══════════════════════════════════════════════════════════════╣
║  Subscription Plan: ${data.subscriptionName}
║  Product Identifier: ${data.revenueCatProductIdentifier}
║  Package Identifier: ${data.revenueCatPackageIdentifier}
╠══════════════════════════════════════════════════════════════╣
║  Steps to complete:                                          ║
║  1. Go to https://dashboard.revenuecat.com                   ║
║  2. Navigate to Products section                             ║
║  3. Create new Product with identifier above                 ║
║  4. Link to App Store Connect (iOS)                          ║
║  5. Link to Google Play Console (Android)                    ║
║  6. Create Package with identifier above                     ║
║  7. Set price in App Store Connect & Google Play Console     ║
╚══════════════════════════════════════════════════════════════╝
      `);
    }

    // Create the plan in database
    const plan = await this.subscriptionPlanModel.create(data as any);

    this.logger.log(`Created subscription plan: ${plan._id}`);

    // Return metadata based on purchase channel
    const metadata: any = {};

    if (data.purchaseChannel === 'stripe' || data.purchaseChannel === 'both') {
      metadata.stripeProductId = data.stripe_product_id;
      metadata.stripePriceId = data.stripe_price_id;
    }

    if (data.purchaseChannel === 'revenuecat' || data.purchaseChannel === 'both') {
      metadata.revenueCatSetupRequired = true;
      metadata.revenueCatProductIdentifier = data.revenueCatProductIdentifier;
      metadata.revenueCatPackageIdentifier = data.revenueCatPackageIdentifier;
      metadata.dashboardUrl = 'https://dashboard.revenuecat.com';
    }

    return {
      plan,
      metadata,
    };
  }

  /**
   * Update subscription plan
   */
  async updateSubscriptionPlan(
    id: string,
    updateData: Partial<SubscriptionPlanDocument>,
  ): Promise<SubscriptionPlanDocument> {
    this.logger.log(`Updating subscription plan: ${id}`);

    const plan = await this.subscriptionPlanModel.findById(id);
    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }

    // If updating amount, update Stripe price as well
    if (updateData.amount && plan.stripe_price_id) {
      try {
        await this.stripe.prices.update(plan.stripe_price_id, {
          unit_amount: Math.round(parseFloat(updateData.amount) * 100),
        });
        this.logger.log(`Updated Stripe price: ${plan.stripe_price_id}`);
      } catch (error) {
        this.logger.error(`Failed to update Stripe price: ${error.message}`);
      }
    }

    Object.assign(plan, updateData);
    await plan.save();

    this.logger.log(`Updated subscription plan: ${plan._id}`);
    return plan;
  }

  /**
   * Delete subscription plan (soft delete)
   */
  async deleteSubscriptionPlan(id: string): Promise<SubscriptionPlanDocument> {
    this.logger.log(`Soft deleting subscription plan: ${id}`);

    const plan = await this.subscriptionPlanModel.findById(id);
    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }

    plan.isDeleted = true;
    plan.isActive = false;
    await plan.save();

    this.logger.log(`Deleted subscription plan: ${plan._id}`);
    return plan;
  }

  /**
   * Get or create Stripe customer
   */
  async getOrCreateStripeCustomer(user: UserDocument): Promise<string> {
    this.logger.debug(`Getting or creating Stripe customer for user ${user._id}`);

    if (user.stripe_customer_id) {
      try {
        // Check if existing customer still exists
        const customer = await this.stripe.customers.retrieve(
          user.stripe_customer_id,
        );

        if (!customer.deleted) {
          this.logger.debug(`Using existing Stripe customer: ${user.stripe_customer_id}`);
          return user.stripe_customer_id;
        }
      } catch (error) {
        this.logger.warn(`Failed to retrieve Stripe customer: ${error.message}`);
        // Customer doesn't exist, will create new one
      }
    }

    // Create new Stripe customer
    const customer = await this.stripe.customers.create({
      name: user.name || user.userName,
      email: user.email,
      metadata: {
        userId: user._id.toString(),
      },
    });

    // Update user with new customer ID
    await User.findByIdAndUpdate(user._id, {
      $set: { stripe_customer_id: customer.id },
    });

    this.logger.log(`Created new Stripe customer: ${customer.id}`);
    return customer.id;
  }
}
