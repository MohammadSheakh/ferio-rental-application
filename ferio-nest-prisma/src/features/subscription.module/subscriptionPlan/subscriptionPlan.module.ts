import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SubscriptionPlan, SubscriptionPlanSchema } from './schemas/subscriptionPlan.schema';
import { SubscriptionPlanController } from './controllers/subscriptionPlan.controller';
import { SubscriptionPlanService } from './services/subscriptionPlan.service';
import { UserModule } from '../../user.module/user.module';

/**
 * SubscriptionPlan Module
 * Handles subscription plan management
 *
 * @version 1.0.0 (NestJS Migration)
 * @author Senior Engineering Team
 */
@Module({
  imports: [
     // MongooseModule.forFeature([
    //   {
    //     name: SubscriptionPlan.name,
    //     schema: SubscriptionPlanSchema,
    //   },
    // ]),
    UserModule, // For Stripe customer management
  ],
  controllers: [SubscriptionPlanController],
  providers: [SubscriptionPlanService],
  exports: [
     // MongooseModule.forFeature([
    //   {
    //     name: SubscriptionPlan.name,
    //     schema: SubscriptionPlanSchema,
    //   },
    // ]),
    SubscriptionPlanService,
  ],
})
export class SubscriptionPlanModule {}
