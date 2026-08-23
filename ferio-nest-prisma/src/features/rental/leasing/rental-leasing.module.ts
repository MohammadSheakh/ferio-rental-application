import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/database';
import { AuthModule } from '../../authentication/auth.module';
import { RentalLeasingController } from './controllers/rental-leasing.controller';
import { RentalLeasingService } from './services/rental-leasing.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [RentalLeasingController],
  providers: [RentalLeasingService],
  exports: [RentalLeasingService],
})
export class RentalLeasingModule {}
