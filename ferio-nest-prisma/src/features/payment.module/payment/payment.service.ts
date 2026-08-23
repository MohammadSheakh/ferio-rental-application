import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentGateway } from './gateways/payment.gateway.interface';
import { PurchaseStrategy } from './strategies/purchase.strategy';
import { UserPayload } from './gateways/payment.gateway.interface';

/**
 * Purchase Type Enum
 * Identifies what is being purchased
 */
export type PurchaseType = 'subscription' | 'journey' | 'capsule';

/**
 * Gateway Type Enum
 * Identifies which payment gateway to use
 */
export type GatewayType = 'stripe' | 'paypal' | 'sslcommerz' | 'revenuecat';

/**
 * Payment Service
 * Orchestrates payment processing using Strategy + Gateway patterns
 *
 * @version 1.0.0 (NestJS Migration)
 * @author Senior Engineering Team
 *
 * @description
 * This service uses two complementary patterns:
 *
 * 1. **Strategy Pattern**: Different purchase types (subscription, journey, capsule)
 *    Each strategy knows how to:
 *    - Find the entity being purchased
 *    - Check if already purchased
 *    - Create pending purchase record
 *    - Generate gateway metadata
 *
 * 2. **Gateway Pattern**: Different payment providers (Stripe, PayPal, etc.)
 *    Each gateway knows how to:
 *    - Resolve/create customers
 *    - Create checkout sessions
 *    - Process webhooks
 *
 * This separation allows:
 * - Adding new purchase types without changing gateway code
 * - Adding new gateways without changing purchase logic
 * - Easy testing with mock strategies/gateways
 *
 * @example
 * // In controller
 * const result = await this.paymentService.processPayment(
 *   'subscription',        // What to buy
 *   'stripe',              // How to pay
 *   'plan_123',            // Entity ID
 *   { userId, email, name } // User info
 * );
 * // Returns: { url: 'https://checkout.stripe.com/...' }
 */
@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  // Registered strategies (WHAT to purchase)
  private strategies: Map<string, PurchaseStrategy<any>> = new Map();

  // Registered gateways (HOW to pay)
  private gateways: Map<string, PaymentGateway> = new Map();

  /**
   * Register a purchase strategy
   * Call this in module initialization to register available purchase types
   *
   * @param type - Purchase type identifier
   * @param strategy - Strategy implementation
   *
   * @example
   * // In PaymentModule.onModuleInit()
   * this.paymentService.registerStrategy('subscription', subscriptionStrategy);
   * this.paymentService.registerStrategy('journey', journeyStrategy);
   */
  registerStrategy(type: PurchaseType, strategy: PurchaseStrategy<any>) {
    this.logger.debug(`Registering strategy for: ${type}`);
    this.strategies.set(type, strategy);
  }

  /**
   * Register a payment gateway
   * Call this in module initialization to register available payment methods
   *
   * @param type - Gateway type identifier
   * @param gateway - Gateway implementation
   *
   * @example
   * // In PaymentModule.onModuleInit()
   * this.paymentService.registerGateway('stripe', stripeGateway);
   * this.paymentService.registerGateway('paypal', paypalGateway);
   */
  registerGateway(type: GatewayType, gateway: PaymentGateway) {
    this.logger.debug(`Registering gateway: ${type}`);
    this.gateways.set(type, gateway);
  }

  /**
   * Process a payment
   * Main entry point for all payment operations
   *
   * Flow:
   * 1. Get strategy for purchase type
   * 2. Get gateway for payment method
   * 3. Delegate to strategy.processPayment()
   *
   * @param purchaseType - What is being purchased
   * @param gatewayType - Which gateway to use
   * @param entityId - ID of the entity to purchase
   * @param user - User making the purchase
   * @returns Checkout session URL
   *
   * @example
   * // Purchase subscription with Stripe
   * const result = await this.processPayment(
   *   'subscription',
   *   'stripe',
   *   'plan_123',
   *   { userId: 'user_456', email: 'user@example.com', name: 'John' }
   * );
   * // res.redirect(result.url);
   *
   * @throws BadRequestException if strategy or gateway not found
   * @throws BadRequestException if already purchased
   * @throws NotFoundException if entity not found
   */
  async processPayment(
    purchaseType: PurchaseType,
    gatewayType: GatewayType,
    entityId: string,
    user: UserPayload,
  ): Promise<{ url: string }> {
    this.logger.log(
      `Processing ${purchaseType} payment via ${gatewayType} for entity ${entityId}`,
    );

    // Get strategy
    const strategy = this.strategies.get(purchaseType);
    if (!strategy) {
      this.logger.error(`Unknown purchase type: ${purchaseType}`);
      throw new BadRequestException(`Unknown purchase type: ${purchaseType}`);
    }

    // Get gateway
    const gateway = this.gateways.get(gatewayType);
    if (!gateway) {
      this.logger.error(`Unknown gateway: ${gatewayType}`);
      throw new BadRequestException(`Unknown gateway: ${gatewayType}`);
    }

    this.logger.debug(`Using strategy: ${strategy.constructor.name}`);
    this.logger.debug(`Using gateway: ${gateway.constructor.name}`);

    // Process payment via strategy
    try {
      const result = await strategy.processPayment(entityId, user, gateway);
      this.logger.log(`Payment processed successfully, redirect URL: ${result.url}`);
      return result;
    } catch (error) {
      this.logger.error(`Payment processing failed: ${error.message}`, error.stack);
      throw error; // Re-throw to be handled by controller
    }
  }

  /**
   * Get registered strategies
   * Useful for debugging and health checks
   *
   * @returns Array of registered strategy types
   */
  getRegisteredStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Get registered gateways
   * Useful for debugging and health checks
   *
   * @returns Array of registered gateway types
   */
  getRegisteredGateways(): string[] {
    return Array.from(this.gateways.keys());
  }

  /**
   * Check if strategy is registered
   *
   * @param type - Purchase type
   * @returns true if registered
   */
  hasStrategy(type: PurchaseType): boolean {
    return this.strategies.has(type);
  }

  /**
   * Check if gateway is registered
   *
   * @param type - Gateway type
   * @returns true if registered
   */
  hasGateway(type: GatewayType): boolean {
    return this.gateways.has(type);
  }

  /**
   * Get strategy by type
   * For advanced use cases where you need direct strategy access
   *
   * @param type - Purchase type
   * @returns Strategy instance
   *
   * @throws NotFoundException if strategy not found
   */
  getStrategy(type: PurchaseType): PurchaseStrategy<any> {
    const strategy = this.strategies.get(type);
    if (!strategy) {
      throw new NotFoundException(`Strategy not found: ${type}`);
    }
    return strategy;
  }

  /**
   * Get gateway by type
   * For advanced use cases where you need direct gateway access
   *
   * @param type - Gateway type
   * @returns Gateway instance
   *
   * @throws NotFoundException if gateway not found
   */
  getGateway(type: GatewayType): PaymentGateway {
    const gateway = this.gateways.get(type);
    if (!gateway) {
      throw new NotFoundException(`Gateway not found: ${type}`);
    }
    return gateway;
  }
}
