import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/database';
import { AuthModule } from '../../authentication/auth.module';
import { RentalPeopleController } from './controllers/rental-people.controller';
import { RentalPeopleService } from './services/rental-people.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [RentalPeopleController],
  providers: [RentalPeopleService],
  exports: [RentalPeopleService],
})
export class RentalPeopleModule {}
