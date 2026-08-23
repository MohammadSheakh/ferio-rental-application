import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PaymentGateway, PaymentSessionParams, UserPayload, PaymentSessionResult } from './payment.gateway.interface';
import { PAYMENT_CONFIG, STRIPE_CONFIG, Currency } from '../constants/payment.constants';

/**
 * Stripe Gateway Implementation
 * Handles all Stripe payment operations
 *
 * @version 1.0.0 (NestJS Migration)
 * @author Senior Engineering Team
 *
 * @example
 * // Inject in service
 * constructor(private stripeGateway: StripeGateway) {}
 *
 * // Create checkout session
 * const session = await this.stripeGateway.createSession({
 *   customerId: 'cus_123',
 *   price: 2999,
 *   currency: 'usd',
 *   metadata: { userId: '...', referenceId: '...' },
 * });
 */
@Injectable()
export class StripeGateway implements PaymentGateway {
  private readonly logger = new Logger(StripeGateway.name);
  private readonly stripe: Stripe;
  private readonly successUrl: string;
  private readonly cancelUrl: string;

  constructor(private configService: ConfigService) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');

    if (!stripeSecretKey) {
      throw new BadRequestException('STRIPE_SECRET_KEY is not configured');
    }

    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: PAYMENT_CONFIG.stripe.apiVersion,
    });

    this.successUrl = `${this.configService.get('CLIENT_URL')}${PAYMENT_CONFIG.stripe.successUrl}`;
    this.cancelUrl = `${this.configService.get('CLIENT_URL')}${PAYMENT_CONFIG.stripe.cancelUrl}`;

    this.logger.log('✅ Stripe Gateway initialized');
  }

  /**
   * Resolve or create a Stripe customer
   * Links application user to Stripe customer record
   *
   * @param user - User payload
   * @returns Stripe customer ID
   *
   * @example
   * const customerId = await this.resolveCustomer({
   *   userId: '507f1f77bcf86cd799439011',
   *   email: 'user@example.com',
   *   name: 'John Doe',
   * });
   */
  async resolveCustomer(user: UserPayload): Promise<string> {
    this.logger.debug(`Resolving Stripe customer for user ${user.userId}`);

    // Return existing customer ID if available
    if (user.stripe_customer_id) {
      this.logger.debug(`Using existing Stripe customer: ${user.stripe_customer_id}`);
      return user.stripe_customer_id;
    }

    try {
      // Create new Stripe customer
      const customer = await this.stripe.customers.create({
        name: user.name || 'Unknown User',
        email: user.email,
        metadata: {
          userId: user.userId,
        },
      });

      this.logger.log(`Created new Stripe customer: ${customer.id} for user ${user.userId}`);

      // Note: We don't update the user record here
      // The caller should handle updating the user with the new customer ID
      return customer.id;
    } catch (error) {
      this.logger.error(`Failed to create Stripe customer: ${error.message}`, error.stack);
      throw new BadRequestException(
        `Failed to create Stripe customer: ${error.message}`,
      );
    }
  }

  /**
   * Create Stripe Checkout session
   * Returns URL to redirect user for payment completion
   *
   * @param params - Payment session parameters
   * @returns Checkout session URL
   *
   * @example
   * const session = await this.createSession({
   *   customerId: 'cus_123',
   *   price: 2999, // $29.99
   *   currency: 'usd',
   *   metadata: {
   *     userId: '507f1f77bcf86cd799439011',
   *     referenceId: 'subscription_123',
   *     referenceType: 'userSubscription',
   *   },
   *   mode: 'payment',
   * });
   */
  async createSession(params: PaymentSessionParams): Promise<PaymentSessionResult> {
    this.logger.debug(`Creating Stripe Checkout session for customer ${params.customerId}`);

    try {
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: params.mode || 'payment',
        customer: params.customerId,
        line_items: [
          {
            price_data: {
              currency: params.currency || Currency.usd,
              product_data: {
                name: 'Payment',
                description: params.metadata?.referenceType || 'Purchase',
              },
              unit_amount: Math.round(params.price * 100), // Convert to cents
            },
            quantity: 1,
          },
        ],
        metadata: params.metadata || {},
        success_url: params.successUrl || this.successUrl,
        cancel_url: params.cancelUrl || this.cancelUrl,
        allow_promotion_codes: true,
        automatic_tax: {
          enabled: false, // Enable if you need automatic tax calculation
        },
      });

      this.logger.log(`Created Stripe Checkout session: ${session.id}`);
      this.logger.debug(`Session URL: ${session.url}`);

      return {
        url: session.url,
        sessionId: session.id,
        gatewayData: {
          status: session.status,
          payment_status: session.payment_status,
          amount_total: session.amount_total,
          currency: session.currency,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to create Stripe Checkout session: ${error.message}`, error.stack);
      throw new BadRequestException(
        `Failed to create payment session: ${error.message}`,
      );
    }
  }

  /**
   * Retrieve Stripe session details
   * Used for webhook verification and success page
   *
   * @param sessionId - Stripe session ID
   * @returns Session details
   *
   * @example
   * const session = await this.retrieveSession('cs_1234567890');
   */
  async retrieveSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    this.logger.debug(`Retrieving Stripe session: ${sessionId}`);

    try {
      const session = await this.stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['subscription'],
      });

      this.logger.debug(`Retrieved session: ${session.id}, status: ${session.status}`);

      return session;
    } catch (error) {
      this.logger.error(`Failed to retrieve Stripe session: ${error.message}`, error.stack);
      throw new BadRequestException(
        `Failed to retrieve session: ${error.message}`,
      );
    }
  }

  /**
   * Construct Stripe webhook event
   * Verifies webhook signature and parses event
   *
   * @param body - Raw webhook body
   * @param signature - Webhook signature header
   * @returns Stripe event
   *
   * @example
   * const event = await this.constructWebhookEvent(rawBody, signature);
   * console.log('Event type:', event.type);
   */
  async constructWebhookEvent(
    body: Buffer,
    signature: string,
  ): Promise<Stripe.Event> {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');

    if (!webhookSecret) {
      this.logger.error('STRIPE_WEBHOOK_SECRET is not configured');
      throw new BadRequestException('Webhook secret not configured');
    }

    try {
      const event = this.stripe.webhooks.constructEvent(
        body,
        signature,
        webhookSecret,
      );

      this.logger.debug(`Constructed webhook event: ${event.type}`);

      return event;
    } catch (error) {
      this.logger.error(`Failed to construct webhook event: ${error.message}`, error.stack);
      throw new BadRequestException(
        `Invalid webhook signature: ${error.message}`,
      );
    }
  }

  /**
   * Get Stripe instance for advanced operations
   * Use this for operations not covered by gateway methods
   *
   * @returns Stripe instance
   *
   * @example
   * const stripe = this.getStripe();
   * const paymentIntent = await stripe.paymentIntents.retrieve('pi_123');
   */
  getStripe(): Stripe {
    return this.stripe;
  }
}
