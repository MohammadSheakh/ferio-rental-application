import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/database';
import { AuthModule } from '../../authentication/auth.module';
import { RentalAutomationsController } from './controllers/rental-automations.controller';
import { RentalAutomationsService } from './services/rental-automations.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [RentalAutomationsController],
  providers: [RentalAutomationsService],
  exports: [RentalAutomationsService],
})
export class RentalAutomationsModule {}
