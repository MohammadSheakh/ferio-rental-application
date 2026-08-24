import { Module } from '@nestjs/common';
import { MarketplaceModule } from '../../features/marketplace/marketplace.module';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';

/**
 * § Week 27 — Bangladesh payment-gateway module.
 * bkash · sslcommerz · aamarpay · shurjopay (+ mock sandbox driver).
 */
@Module({
  imports: [MarketplaceModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
