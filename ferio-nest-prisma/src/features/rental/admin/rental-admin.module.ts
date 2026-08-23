import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/database';
import { AuthModule } from '../../authentication/auth.module';
import { RentalAdminController } from './controllers/rental-admin.controller';
import { RentalAdminService } from './services/rental-admin.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [RentalAdminController],
  providers: [RentalAdminService],
  exports: [RentalAdminService],
})
export class RentalAdminModule {}
