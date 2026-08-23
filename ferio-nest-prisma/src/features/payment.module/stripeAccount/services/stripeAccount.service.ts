import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { StripeAccount, StripeAccountDocument } from './schemas/stripeAccount.schema';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { User, UserDocument } from '../../user.module/user/user.schema';

/**
 * StripeAccount Service
 * Handles Stripe Connect onboarding for business users
 *
 * @version 1.0.0 (NestJS Migration)
 * @author Senior Engineering Team
 */
@Injectable()
export class StripeAccountService {
  private readonly logger = new Logger(StripeAccountService.name);
  private readonly stripe: Stripe;

  constructor(
    @InjectModel(StripeAccount.name)
    private stripeAccountModel: Model<StripeAccountDocument>,

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

    this.logger.log('✅ StripeAccount Service initialized');
  }

  /**
   * Create connected Stripe account
   * Initiates Stripe Connect onboarding flow
   *
   * @param user - User object
   * @param host - Request host
   * @param protocol - Request protocol (http/https)
   * @returns Onboarding URL
   */
  async createConnectedStripeAccount(
    user: any,
    host: string,
    protocol: string,
  ): Promise<any> {
    this.logger.log(`Creating Stripe account for user ${user.userId}`);

    // Check if account already exists
    const existingAccount = await this.stripeAccountModel.findOne({
      userId: new Types.ObjectId(user.userId),
    });

    if (existingAccount) {
      // If already completed, return existing account
      if (existingAccount.isCompleted) {
        this.logger.warn(`User ${user.userId} already has completed Stripe account`);
        return {
          success: false,
          message: 'Account already exists',
          data: existingAccount,
        };
      }

      // If not completed, create new onboarding link
      const onboardingLink = await this.stripe.accountLinks.create({
        account: existingAccount.accountId,
        refresh_url: `${protocol}://${host}/api/v1/payments/refreshAccountConnect/${existingAccount.accountId}`,
        return_url: `${protocol}://${host}/api/v1/payments/success-account/${existingAccount.accountId}`,
        type: 'account_onboarding',
      });

      this.logger.log(`Generated refresh onboarding link for account ${existingAccount.accountId}`);

      return {
        success: true,
        message: 'Please complete your account',
        url: onboardingLink.url,
      };
    }

    // Create new Stripe account
    const account = await this.stripe.accounts.create({
      type: 'express',
      email: user.email,
      country: 'US',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    this.logger.log(`Created new Stripe account: ${account.id}`);

    // Save to database
    await this.stripeAccountModel.create({
      accountId: account.id,
      userId: user.userId,
      isCompleted: false,
    });

    // Create onboarding link
    const onboardingLink = await this.stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${protocol}://${host}/api/v1/payments/refreshAccountConnect/${account.id}`,
      return_url: `${protocol}://${host}/api/v1/payments/success-account/${account.id}`,
      type: 'account_onboarding',
    });

    this.logger.log(`Generated onboarding link: ${onboardingLink.url}`);

    return {
      success: true,
      message: 'Please complete your account',
      url: onboardingLink.url,
    };
  }

  /**
   * Refresh account connect link
   * Called when user needs to complete/retry onboarding
   *
   * @param accountId - Stripe account ID
   * @param host - Request host
   * @param protocol - Request protocol
   * @returns New onboarding URL
   */
  async refreshAccountConnect(
    accountId: string,
    host: string,
    protocol: string,
  ): Promise<string> {
    this.logger.log(`Refreshing account connect for ${accountId}`);

    const onboardingLink = await this.stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${protocol}://${host}/api/v1/payments/refreshAccountConnect/${accountId}`,
      return_url: `${protocol}://${host}/api/v1/payments/success-account/${accountId}`,
      type: 'account_onboarding',
    });

    this.logger.log(`Generated refresh link: ${onboardingLink.url}`);

    return onboardingLink.url;
  }

  /**
   * Handle successful account onboarding
   * Called when user completes Stripe onboarding
   *
   * @param accountId - Stripe account ID
   */
  async onConnectedStripeAccountSuccess(accountId: string): Promise<any> {
    this.logger.log(`Handling successful onboarding for account ${accountId}`);

    if (!accountId) {
      throw new NotFoundException('Account ID not found');
    }

    // Find Stripe account record
    const stripeAccount = await this.stripeAccountModel.findOne({ accountId }).populate('userId');

    if (!stripeAccount) {
      throw new NotFoundException('Stripe account not found');
    }

    // Mark as completed
    await this.stripeAccountModel.updateOne(
      { accountId },
      { isCompleted: true },
    );

    // Update user record
    await this.userModel.updateOne(
      { _id: stripeAccount.userId },
      { $set: { stripeConnectedAccount: accountId } },
    );

    this.logger.log(`Successfully completed onboarding for account ${accountId}`);

    // Return success HTML (in production, this would be a redirect)
    const user = stripeAccount.userId as any;
    return {
      success: true,
      message: 'Stripe account connected successfully',
      data: {
        accountId,
        userName: user?.full_name || user?.name,
        email: user?.email,
      },
    };
  }

  /**
   * Get Stripe account by user ID
   */
  async findByUserId(userId: string): Promise<StripeAccountDocument | null> {
    return this.stripeAccountModel.findOne({
      userId: new Types.ObjectId(userId),
    });
  }

  /**
   * Get Stripe account by account ID
   */
  async findByAccountId(accountId: string): Promise<StripeAccountDocument | null> {
    return this.stripeAccountModel.findOne({ accountId });
  }

  /**
   * Check if user has completed Stripe onboarding
   */
  async isOnboardingComplete(userId: string): Promise<boolean> {
    const account = await this.stripeAccountModel.findOne({
      userId: new Types.ObjectId(userId),
      isCompleted: true,
    });

    return account !== null;
  }
}
