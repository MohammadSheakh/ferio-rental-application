import { Module } from '@nestjs/common';
//@ts-ignore
import { MongooseModule } from '@nestjs/mongoose';
//@ts-ignore
import { PaymentTransaction, PaymentTransactionSchema } from './schemas/paymentTransaction.schema';
import { PaymentTransactionController } from './controllers/paymentTransaction.controller';
import { PaymentTransactionService } from './services/paymentTransaction.service';

/**
 * PaymentTransaction Module
 * Handles all payment transaction operations
 *
 * @version 1.0.0 (NestJS Migration)
 * @author Senior Engineering Team
 */
@Module({
  imports: [
    /*
    MongooseModule.forFeature([
      {
        name: PaymentTransaction.name,
        schema: PaymentTransactionSchema,
      },
    ]),
    */
  ],
  controllers: [PaymentTransactionController],
  providers: [PaymentTransactionService],
  exports: [
    /*
    MongooseModule.forFeature([
      {
        name: PaymentTransaction.name,
        schema: PaymentTransactionSchema,
      },
    ]),
    */
    PaymentTransactionService,
  ],
})
export class PaymentTransactionModule {}
