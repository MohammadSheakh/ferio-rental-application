import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/database';
import { AuthModule } from '../../authentication/auth.module';
import { RentalExpensesController } from './controllers/rental-expenses.controller';
import { RentalExpensesService } from './services/rental-expenses.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [RentalExpensesController],
  providers: [RentalExpensesService],
  exports: [RentalExpensesService],
})
export class RentalExpensesModule {}
