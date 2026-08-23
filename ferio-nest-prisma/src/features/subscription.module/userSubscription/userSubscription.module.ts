import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserSubscription, UserSubscriptionSchema } from './schemas/userSubscription.schema';
import { UserSubscriptionController } from './controllers/userSubscription.controller';
import { UserSubscriptionService } from './services/userSubscription.service';
import { UserModule } from '../../user.module/user.module';
import { SubscriptionPlanModule } from '../subscriptionPlan/subscriptionPlan.module';

/**
 * UserSubscription Module
 * Handles user subscription lifecycle
 *
 * @version 1.0.0 (NestJS Migration)
 * @author Senior Engineering Team
 */
@Module({
  imports: [
     // MongooseModule.forFeature([
    //   {
    //     name: UserSubscription.name,
    //     schema: UserSubscriptionSchema,
    //   },
    // ]),
    UserModule,
    SubscriptionPlanModule,
  ],
  controllers: [UserSubscriptionController],
  providers: [UserSubscriptionService],
  exports: [
     // MongooseModule.forFeature([
    //   {
    //     name: UserSubscription.name,
    //     schema: UserSubscriptionSchema,
    //   },
    // ]),
    UserSubscriptionService,
  ],
})
export class UserSubscriptionModule {}
