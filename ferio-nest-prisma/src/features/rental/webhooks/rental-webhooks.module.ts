import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/database';
import { AuthModule } from '../../authentication/auth.module';
import { RentalWebhooksController } from './controllers/rental-webhooks.controller';
import { RentalWebhooksService } from './services/rental-webhooks.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [RentalWebhooksController],
  providers: [RentalWebhooksService],
  exports: [RentalWebhooksService],
})
export class RentalWebhooksModule {}
