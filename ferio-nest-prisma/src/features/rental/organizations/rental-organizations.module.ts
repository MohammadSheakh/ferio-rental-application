import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/database';
import { AuthModule } from '../../authentication/auth.module';
import { RentalOrganizationsController } from './controllers/rental-organizations.controller';
import { RentalOrganizationsService } from './services/rental-organizations.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [RentalOrganizationsController],
  providers: [RentalOrganizationsService],
  exports: [RentalOrganizationsService],
})
export class RentalOrganizationsModule {}
