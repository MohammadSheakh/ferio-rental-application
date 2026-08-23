import { Module } from '@nestjs/common';
import { SubscriptionPlanModule } from './subscriptionPlan/subscriptionPlan.module';
import { UserSubscriptionModule } from './userSubscription/userSubscription.module';
import { RevenueCatModule } from './revenueCat/revenueCat.module';

/**
 * Subscription Module (Parent Module)
 *
 * 📚 SUBSCRIPTION MANAGEMENT MODULE
 *
 * Architecture:
 * - **SubscriptionPlan**: Admin creates/manages subscription tiers
 * - **UserSubscription**: User subscription lifecycle, free trials
 * - **RevenueCat**: Mobile subscription integration (iOS/Android)
 *
 * Features:
 * - Hybrid payment processing (Stripe for web, RevenueCat for mobile)
 * - Free trial management (7 days with card collection)
 * - Auto-renewal handling
 * - Subscription lifecycle tracking
 * - RevenueCat integration for mobile apps
 *
 * @version 1.0.0 (NestJS Migration)
 * @author Senior Engineering Team
 */
@Module({
  imports: [
    // Subscription Plan sub-module (Admin management)
    SubscriptionPlanModule,

    // User Subscription sub-module (User lifecycle)
    UserSubscriptionModule,

    // RevenueCat sub-module (Mobile integration)
    RevenueCatModule,
  ],
  exports: [
    SubscriptionPlanModule,
    UserSubscriptionModule,
    RevenueCatModule,
  ],
})
export class SubscriptionModule {}
