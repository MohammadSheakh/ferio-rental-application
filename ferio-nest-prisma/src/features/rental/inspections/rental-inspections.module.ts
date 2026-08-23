import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/database';
import { AuthModule } from '../../authentication/auth.module';
import { RentalInspectionsController } from './controllers/rental-inspections.controller';
import { RentalInspectionsService } from './services/rental-inspections.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [RentalInspectionsController],
  providers: [RentalInspectionsService],
  exports: [RentalInspectionsService],
})
export class RentalInspectionsModule {}
