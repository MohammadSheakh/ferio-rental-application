import { Injectable } from '@nestjs/common';

/**
 * Payment Session Parameters
 * Used to create checkout sessions across different gateways
 */
export interface PaymentSessionParams {
  /** Stripe customer ID (optional for new customers) */
  customerId?: string;

  /** Payment amount in cents/smallest currency unit */
  price: number;

  /** Currency code (usd, bdt, eur, etc.) */
  currency?: string;

  /** Session metadata (userId, referenceId, etc.) */
  metadata: Record<string, string>;

  /** Payment mode (payment or subscription) */
  mode?: 'payment' | 'subscription';

  /** Success URL (optional, uses default if not provided) */
  successUrl?: string;

  /** Cancel URL (optional, uses default if not provided) */
  cancelUrl?: string;
}

/**
 * Payment Gateway Interface
 * Defines the contract for all payment gateway implementations
 *
 * @version 1.0.0 (NestJS Migration)
 * @author Senior Engineering Team
 *
 * @example
 * // Stripe Gateway Implementation
 * @Injectable()
 * export class StripeGateway implements PaymentGateway {
 *   async resolveCustomer(user: UserPayload): Promise<string> {
 *     // Create or retrieve Stripe customer
 *   }
 *
 *   async createSession(params: PaymentSessionParams): Promise<{ url: string }> {
 *     // Create Stripe Checkout session
 *   }
 * }
 */
export abstract class PaymentGateway {
  /**
   * Resolve or create a customer in the payment gateway
   * Links the application user to a gateway customer record
   *
   * @param user - User payload with email and ID
   * @returns Gateway customer ID (e.g., Stripe customer ID)
   *
   * @example
   * const customerId = await gateway.resolveCustomer({
   *   userId: '507f1f77bcf86cd799439011',
   *   email: 'user@example.com',
   *   name: 'John Doe',
   * });
   * // Returns: 'cus_1234567890'
   */
  abstract resolveCustomer(user: UserPayload): Promise<string>;

  /**
   * Create a checkout session for payment
   * Returns a URL to redirect the user to complete payment
   *
   * @param params - Payment session parameters
   * @returns Checkout session URL
   *
   * @example
   * const session = await gateway.createSession({
   *   customerId: 'cus_1234567890',
   *   price: 2999, // $29.99 in cents
   *   currency: 'usd',
   *   metadata: {
   *     userId: '507f1f77bcf86cd799439011',
   *     subscriptionType: 'individual',
   *   },
   * });
   * // Returns: { url: 'https://checkout.stripe.com/...' }
   */
  abstract createSession(params: PaymentSessionParams): Promise<{ url: string }>;
}

/**
 * User Payload Interface
 * Minimal user data required for payment processing
 */
export interface UserPayload {
  /** User MongoDB ID */
  userId: string;

  /** User email address */
  email: string;

  /** User name (optional) */
  name?: string;

  /** Gateway-specific customer ID (optional) */
  stripe_customer_id?: string;

  /** RevenueCat user ID (optional) */
  revenueCatUserId?: string;
}

/**
 * Payment Session Result
 * Standardized response from createSession
 */
export interface PaymentSessionResult {
  /** Checkout URL to redirect user to */
  url: string;

  /** Session ID (optional, for tracking) */
  sessionId?: string;

  /** Gateway-specific response data (optional) */
  gatewayData?: any;
}
