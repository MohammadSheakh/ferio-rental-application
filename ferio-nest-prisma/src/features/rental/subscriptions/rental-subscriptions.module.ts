import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/database';
import { AuthModule } from '../../authentication/auth.module';
import { RentalSubscriptionsController } from './controllers/rental-subscriptions.controller';
import { RentalSubscriptionsService } from './services/rental-subscriptions.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [RentalSubscriptionsController],
  providers: [RentalSubscriptionsService],
  exports: [RentalSubscriptionsService],
})
export class RentalSubscriptionsModule {}
