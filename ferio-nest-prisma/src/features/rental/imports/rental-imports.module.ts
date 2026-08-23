import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/database';
import { AuthModule } from '../../authentication/auth.module';
import { RentalImportsController } from './controllers/rental-imports.controller';
import { RentalImportsService } from './services/rental-imports.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [RentalImportsController],
  providers: [RentalImportsService],
  exports: [RentalImportsService],
})
export class RentalImportsModule {}
