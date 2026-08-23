import { Module } from '@nestjs/common';
//@ts-ignore
import { MongooseModule } from '@nestjs/mongoose';
import { RevenueCatWebhookEvent, RevenueCatWebhookEventSchema } from './schemas/revenueCatWebhookEvent.schema';
import { RevenueCatWebhookController } from './controllers/revenueCatWebhook.controller';
import { RevenueCatWebhookService } from './services/revenueCatWebhook.service';
import { PaymentTransactionModule } from '../paymentTransaction/paymentTransaction.module';

/**
 * RevenueCatWebhook Module
 * Handles all RevenueCat webhook events
 *
 * @version 1.0.0 (NestJS Migration)
 * @author Senior Engineering Team
 */
@Module({
  imports: [
    /*
    MongooseModule.forFeature([
      {
        name: RevenueCatWebhookEvent.name,
        schema: RevenueCatWebhookEventSchema,
      },
    ]),
    */
    PaymentTransactionModule, // For updating transactions
  ],
  controllers: [RevenueCatWebhookController],
  providers: [RevenueCatWebhookService],
  exports: [RevenueCatWebhookService],
})
export class RevenueCatWebhookModule {}
