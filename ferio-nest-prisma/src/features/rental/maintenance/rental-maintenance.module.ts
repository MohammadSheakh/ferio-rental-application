import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/database';
import { AuthModule } from '../../authentication/auth.module';
import { RentalMaintenanceController } from './controllers/rental-maintenance.controller';
import { RentalMaintenanceService } from './services/rental-maintenance.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [RentalMaintenanceController],
  providers: [RentalMaintenanceService],
  exports: [RentalMaintenanceService],
})
export class RentalMaintenanceModule {}
