import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserSubscription, UserSubscriptionSchema } from '../userSubscription/schemas/userSubscription.schema';
import { RevenueCatController } from './controllers/revenueCat.controller';
import { RevenueCatService } from './services/revenueCat.service';
import { RevenueCatWebhookController } from './controllers/revenueCatWebhook.controller';
import { RevenueCatWebhookService } from './services/revenueCatWebhook.service';
import { PaymentTransactionModule } from '../../payment.module/paymentTransaction/paymentTransaction.module';

/**
 * RevenueCat Module
 * Handles RevenueCat API integration and webhooks
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
    PaymentTransactionModule,
  ],
  controllers: [RevenueCatController, RevenueCatWebhookController],
  providers: [RevenueCatService, RevenueCatWebhookService],
  exports: [RevenueCatService, RevenueCatWebhookService],
})
export class RevenueCatModule {}
