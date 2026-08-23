import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
//@ts-ignore
import { Document, Types } from 'mongoose';

/**
 * Stripe Account Schema
 * Tracks Stripe Connect onboarding for business users
 *
 * @version 1.0.0 (NestJS Migration)
 * @author Senior Engineering Team
 */
@Schema({ timestamps: true })
export class StripeAccount {
  /**
   * MongoDB document ID
   */
  _id?: Types.ObjectId;

  /**
   * User who owns this Stripe account
   */
  @Prop({
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true,
  })
  userId: Types.ObjectId;

  /**
   * Stripe Account ID from Stripe
   */
  @Prop({
    type: String,
    required: [true, 'Account ID is required'],
    index: true,
  })
  accountId: string;

  /**
   * Whether onboarding is complete
   */
  @Prop({ default: false })
  isCompleted: boolean;

  /**
   * Creation timestamp (auto-managed by Mongoose)
   */
  createdAt?: Date;

  /**
   * Last update timestamp (auto-managed by Mongoose)
   */
  updatedAt?: Date;
}

/**
 * Stripe Account Schema Definition
 */
export const StripeAccountSchema = SchemaFactory.createForClass(StripeAccount);

/**
 * Index for efficient queries
 */
StripeAccountSchema.index({ userId: 1, isCompleted: 1 });

/**
 * Static method: Find by account ID
 */
StripeAccountSchema.statics.findByAccountId = async function (
  accountId: string,
): Promise<StripeAccountDocument | null> {
  return this.findOne({ accountId, isDeleted: false });
};

/**
 * Static method: Find by user ID
 */
StripeAccountSchema.statics.findByUserId = async function (
  userId: string,
): Promise<StripeAccountDocument | null> {
  return this.findOne({ userId: new Types.ObjectId(userId), isDeleted: false });
};

/**
 * toJSON transformation
 */
StripeAccountSchema.set('toJSON', {
  transform: function (doc, ret, options) {
    ret.stripeAccountId = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

/**
 * Stripe Account Document Type
 */
export type StripeAccountDocument = StripeAccount & Document;

/**
 * Stripe Account Model Type
 */
export type StripeAccountModel = typeof StripeAccount;
