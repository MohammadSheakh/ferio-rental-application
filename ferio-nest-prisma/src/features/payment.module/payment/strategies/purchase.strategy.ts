import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentGateway } from '../gateways/payment.gateway.interface';
import { UserPayload } from '../gateways/payment.gateway.interface';

/**
 * Purchase Strategy Interface
 * Defines the contract for different purchase type implementations
 *
 * @version 1.0.0 (NestJS Migration)
 * @author Senior Engineering Team
 *
 * @description
 * The Strategy Pattern allows us to handle different purchase types
 * (subscriptions, journeys, capsules) with a unified payment flow.
 *
 * Each purchase type implements this strategy, providing:
 * - How to find the entity being purchased
 * - How to check if already purchased
 * - How to create a pending purchase record
 * - What metadata to send to the payment gateway
 *
 * @example
 * // Subscription Purchase Strategy
 * @Injectable()
 * export class SubscriptionPurchaseStrategy extends PurchaseStrategy {
 *   async findExisting(entityId: string) {
 *     return this.subscriptionPlanModel.findById(entityId);
 *   }
 *
 *   async checkAlreadyPurchased(entityId: string, userId: string) {
 *     return this.userSubscriptionModel.exists({ userId, planId: entityId });
 *   }
 *
 *   async createPendingPurchase(entity, user, session) {
 *     return this.userSubscriptionModel.create({ ... });
 *   }
 *
 *   getMetadata(purchase, entity, user) {
 *     return {
 *       userId: user.userId,
 *       subscriptionType: entity.type,
 *     };
 *   }
 * }
 */
export abstract class PurchaseStrategy<T = any> {
  protected readonly logger = new Logger(PurchaseStrategy.name);

  /**
   * Find the entity being purchased
   * Implementation varies by purchase type (subscription, journey, capsule)
   *
   * @param entityId - ID of the entity to find
   * @returns The entity being purchased
   *
   * @example
   * const subscriptionPlan = await this.findExisting('plan_123');
   */
  abstract findExisting(entityId: string): Promise<T>;

  /**
   * Check if user has already purchased this entity
   * Prevents duplicate purchases
   *
   * @param entityId - ID of the entity
   * @param userId - User ID to check
   * @returns true if already purchased, false otherwise
   *
   * @example
   * const alreadyPurchased = await this.checkAlreadyPurchased('plan_123', 'user_456');
   * if (alreadyPurchased) {
   *   throw new BadRequestException('Already purchased');
   * }
   */
  abstract checkAlreadyPurchased(entityId: string, userId: string): Promise<boolean>;

  /**
   * Create a pending purchase record
   * Called within a database transaction to ensure consistency
   *
   * @param entity - The entity being purchased
   * @param user - User making the purchase
   * @param session - Database transaction session
   * @returns The pending purchase record
   *
   * @example
   * const pendingPurchase = await this.createPendingPurchase(
   *   subscriptionPlan,
   *   user,
   *   session
   * );
   */
  abstract createPendingPurchase(
    entity: T,
    user: UserPayload,
    session: any,
  ): Promise<any>;

  /**
   * Get metadata for payment gateway
   * This metadata is sent to the payment gateway and returned in webhooks
   *
   * @param purchase - The pending purchase record
   * @param entity - The entity being purchased
   * @param user - User making the purchase
   * @returns Metadata object with string keys and values
   *
   * @example
   * const metadata = this.getMetadata(pendingPurchase, subscriptionPlan, user);
   * // Returns: { userId: '...', subscriptionType: 'individual', ... }
   */
  abstract getMetadata(
    purchase: any,
    entity: T,
    user: UserPayload,
  ): Record<string, string>;

  /**
   * Process payment for this purchase type
   * This is the main entry point - NEVER override this method
   *
   * The flow:
   * 1. Check if already purchased
   * 2. Find the entity
   * 3. Resolve/create gateway customer
   * 4. Create pending purchase (in transaction)
   * 5. Create gateway checkout session
   * 6. Return checkout URL
   *
   * @param entityId - ID of the entity to purchase
   * @param user - User making the purchase
   * @param gateway - Payment gateway to use
   * @returns Checkout session URL
   *
   * @example
   * const result = await this.processPayment(
   *   'plan_123',
   *   { userId: 'user_456', email: 'user@example.com' },
   *   stripeGateway
   * );
   * // Returns: { url: 'https://checkout.stripe.com/...' }
   */
  async processPayment(
    entityId: string,
    user: UserPayload,
    gateway: PaymentGateway,
  ): Promise<{ url: string }> {
    this.logger.log(`Processing payment for entity ${entityId} by user ${user.userId}`);

    // 1. Check if already purchased
    const alreadyPurchased = await this.checkAlreadyPurchased(entityId, user.userId);
    if (alreadyPurchased) {
      this.logger.warn(`User ${user.userId} already purchased entity ${entityId}`);
      throw new BadRequestException('Already purchased');
    }

    // 2. Find the entity
    const entity = await this.findExisting(entityId);
    if (!entity) {
      this.logger.warn(`Entity ${entityId} not found`);
      throw new NotFoundException('Entity not found');
    }

    this.logger.debug(`Found entity: ${JSON.stringify(entity)}`);

    // 3. Resolve or create gateway customer
    const customerId = await gateway.resolveCustomer(user);
    this.logger.debug(`Resolved customer ID: ${customerId}`);

    // 4. Create pending purchase (in transaction)
    let pendingPurchase: any;
    // Note: Transaction handling is done in the service layer
    // The strategy just creates the record
    pendingPurchase = await this.createPendingPurchase(entity, user, null);
    this.logger.debug(`Created pending purchase: ${pendingPurchase.id || pendingPurchase._id}`);

    // 5. Get metadata for gateway
    const metadata = this.getMetadata(pendingPurchase, entity, user);
    this.logger.debug(`Payment metadata: ${JSON.stringify(metadata)}`);

    // 6. Create gateway checkout session
    const session = await gateway.createSession({
      customerId,
      price: pendingPurchase.price,
      currency: pendingPurchase.currency || 'usd',
      metadata,
      mode: pendingPurchase.mode || 'payment',
    });

    this.logger.log(`Payment session created: ${session.sessionId || 'N/A'}`);

    return { url: session.url };
  }
}
