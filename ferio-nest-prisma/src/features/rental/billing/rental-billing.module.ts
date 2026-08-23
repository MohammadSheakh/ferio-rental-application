import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/database';
import { AuthModule } from '../../authentication/auth.module';
import { RentalBillingController } from './controllers/rental-billing.controller';
import { RentalBillingService } from './services/rental-billing.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [RentalBillingController],
  providers: [RentalBillingService],
  exports: [RentalBillingService],
})
export class RentalBillingModule {}
