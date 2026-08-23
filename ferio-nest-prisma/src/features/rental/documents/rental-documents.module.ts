import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/database';
import { AuthModule } from '../../authentication/auth.module';
import { RentalDocumentsController } from './controllers/rental-documents.controller';
import { RentalDocumentsService } from './services/rental-documents.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [RentalDocumentsController],
  providers: [RentalDocumentsService],
  exports: [RentalDocumentsService],
})
export class RentalDocumentsModule {}
