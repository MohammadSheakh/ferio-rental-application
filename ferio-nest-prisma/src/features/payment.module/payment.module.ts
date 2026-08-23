import { Module, OnModuleInit } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentService } from './payment.service';
import { StripeGateway } from './gateways/stripe.gateway';
import { PaymentTransactionModule } from './paymentTransaction/paymentTransaction.module';
import { StripeAccountModule } from './stripeAccount/stripeAccount.module';
import { StripeWebhookModule } from './stripeWebhook/stripeWebhook.module';
import { RevenueCatWebhookModule } from './revenueCatWebhook/revenueCatWebhook.module';

/**
 * Payment Module (Parent Module)
 *
 * 📚 PAYMENT PROCESSING MODULE WITH STRATEGY + GATEWAY PATTERNS
 *
 * Architecture:
 * - **Strategy Pattern**: Different purchase types (subscription, journey, capsule)
 * - **Gateway Pattern**: Different payment providers (Stripe, RevenueCat, SSLCommerz)
 *
 * Features:
 * - Multi-gateway support (Stripe, RevenueCat, SSLCommerz)
 * - Strategy-based purchase processing
 * - Transaction tracking and audit
 * - Earnings aggregation
 * - Webhook handling (Stripe + RevenueCat)
 * - Stripe Connect onboarding
 *
 * @version 1.0.0 (NestJS Migration)
 * @author Senior Engineering Team
 */
@Module({
  imports: [
    // Payment Transaction sub-module
    PaymentTransactionModule,

    // Stripe Account sub-module (Stripe Connect)
    StripeAccountModule,

    // Stripe Webhook sub-module
    StripeWebhookModule,

    // RevenueCat Webhook sub-module
    RevenueCatWebhookModule,
  ],
  providers: [
    PaymentService,
    StripeGateway,
    // Additional gateways will be added here
    // RevenueCatGateway,
    // SSLCommerzGateway,
  ],
  exports: [
    PaymentService,
    StripeGateway,
    PaymentTransactionModule,
    StripeAccountModule,
    StripeWebhookModule,
    RevenueCatWebhookModule,
  ],
})
export class PaymentModule implements OnModuleInit {
  constructor(
    private paymentService: PaymentService,
    private stripeGateway: StripeGateway,
  ) {}

  /**
   * Initialize payment strategies and gateways
   * Called automatically when module is loaded
   */
  async onModuleInit() {
    // Register gateways
    this.paymentService.registerGateway('stripe', this.stripeGateway);

    // Note: Strategies will be registered here once implemented
    // Example:
    // const subscriptionStrategy = new SubscriptionPurchaseStrategy(...);
    // this.paymentService.registerStrategy('subscription', subscriptionStrategy);

    console.log('✅ Payment Module initialized');
    console.log('📦 Registered gateways:', this.paymentService.getRegisteredGateways());
    console.log('📦 Registered strategies:', this.paymentService.getRegisteredStrategies());
  }
}
