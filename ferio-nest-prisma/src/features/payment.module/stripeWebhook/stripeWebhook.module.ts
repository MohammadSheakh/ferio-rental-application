import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StripeWebhookEvent, StripeWebhookEventSchema } from './schemas/stripeWebhookEvent.schema';
import { StripeWebhookController } from './controllers/stripeWebhook.controller';
import { StripeWebhookService } from './services/stripeWebhook.service';
import { PaymentTransactionModule } from '../paymentTransaction/paymentTransaction.module';

/**
 * StripeWebhook Module
 * Handles all Stripe webhook events
 *
 * @version 1.0.0 (NestJS Migration)
 * @author Senior Engineering Team
 */
@Module({
  imports: [
    /*
    MongooseModule.forFeature([
      {
        name: StripeWebhookEvent.name,
        schema: StripeWebhookEventSchema,
      },
    ]),
    */
    PaymentTransactionModule, // For updating transactions
  ],
  controllers: [StripeWebhookController],
  providers: [StripeWebhookService],
  exports: [StripeWebhookService],
})
export class StripeWebhookModule {}
