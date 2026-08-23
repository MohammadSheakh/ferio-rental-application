import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StripeAccount, StripeAccountSchema } from './schemas/stripeAccount.schema';
import { StripeAccountController } from './controllers/stripeAccount.controller';
import { StripeAccountService } from './services/stripeAccount.service';
import { UserModule } from '../../user.module/user.module';

/**
 * StripeAccount Module
 * Handles Stripe Connect onboarding for business users
 *
 * @version 1.0.0 (NestJS Migration)
 * @author Senior Engineering Team
 */
@Module({
  imports: [
    /*
    MongooseModule.forFeature([
      {
        name: StripeAccount.name,
        schema: StripeAccountSchema,
      },
    ]),
    */
    UserModule, // For updating user records
  ],
  controllers: [StripeAccountController],
  providers: [StripeAccountService],
  exports: [
    /*
    MongooseModule.forFeature([
      {
        name: StripeAccount.name,
        schema: StripeAccountSchema,
      },
    ]),
    */
    StripeAccountService,
  ],
})
export class StripeAccountModule {}
