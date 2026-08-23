import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/database';
import { AuthModule } from '../../authentication/auth.module';
import { RentalReportsController } from './controllers/rental-reports.controller';
import { RentalReportsService } from './services/rental-reports.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [RentalReportsController],
  providers: [RentalReportsService],
  exports: [RentalReportsService],
})
export class RentalReportsModule {}
