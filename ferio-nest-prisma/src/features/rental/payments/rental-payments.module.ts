import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/database';
import { AuthModule } from '../../authentication/auth.module';
import { RentalBillingModule } from '../billing/rental-billing.module';
import { RentalPaymentGatewayController } from './controllers/rental-payment-gateway.controller';
import { RentalPaymentGatewayService } from './services/rental-payment-gateway.service';

@Module({
  imports: [PrismaModule, AuthModule, RentalBillingModule],
  controllers: [RentalPaymentGatewayController],
  providers: [RentalPaymentGatewayService],
  exports: [RentalPaymentGatewayService],
})
export class RentalPaymentsModule {}
