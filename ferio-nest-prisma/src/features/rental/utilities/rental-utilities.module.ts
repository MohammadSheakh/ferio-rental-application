import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/database';
import { AuthModule } from '../../authentication/auth.module';
import { RentalUtilitiesController } from './controllers/rental-utilities.controller';
import { RentalUtilitiesService } from './services/rental-utilities.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [RentalUtilitiesController],
  providers: [RentalUtilitiesService],
  exports: [RentalUtilitiesService],
})
export class RentalUtilitiesModule {}
