import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/database';
import { AuthModule } from '../../authentication/auth.module';
import { RentalCommunicationsController } from './controllers/rental-communications.controller';
import { RentalCommunicationsService } from './services/rental-communications.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [RentalCommunicationsController],
  providers: [RentalCommunicationsService],
  exports: [RentalCommunicationsService],
})
export class RentalCommunicationsModule {}
