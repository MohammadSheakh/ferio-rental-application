import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/database';
import { AuthModule } from '../../authentication/auth.module';
import { RentalCrmController } from './controllers/rental-crm.controller';
import { RentalCrmService } from './services/rental-crm.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [RentalCrmController],
  providers: [RentalCrmService],
  exports: [RentalCrmService],
})
export class RentalCrmModule {}
