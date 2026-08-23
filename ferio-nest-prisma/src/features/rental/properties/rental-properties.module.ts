import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/database';
import { AuthModule } from '../../authentication/auth.module';
import { RentalPropertiesController } from './controllers/rental-properties.controller';
import { RentalPropertiesService } from './services/rental-properties.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [RentalPropertiesController],
  providers: [RentalPropertiesService],
  exports: [RentalPropertiesService],
})
export class RentalPropertiesModule {}
