import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
//@ts-ignore
import { Document, Types } from 'mongoose';

/**
 * Stripe Webhook Event Schema
 * Logs all Stripe webhook events for audit and debugging
 *
 * @version 1.0.0 (NestJS Migration)
 * @author Senior Engineering Team
 */
@Schema({ timestamps: true })
export class StripeWebhookEvent {
  /**
   * MongoDB document ID
   */
  _id?: Types.ObjectId;

  /**
   * Stripe event ID
   */
  @Prop({
    type: String,
    required: [true, 'Event ID is required'],
    unique: true,
    index: true,
  })
  eventId: string;

  /**
   * Stripe event type
   */
  @Prop({
    type: String,
    required: [true, 'Event type is required'],
    index: true,
  })
  eventType: string;

  /**
   * Stripe account ID
   */
  @Prop({ type: String })
  accountId: string;

  /**
   * Payment intent ID (if applicable)
   */
  @Prop({ type: String, index: true })
  paymentIntentId?: string;

  /**
   * Customer ID (if applicable)
   */
  @Prop({ type: String, index: true })
  customerId?: string;

  /**
   * Amount (if applicable, in cents)
   */
  @Prop({ type: Number })
  amount?: number;

  /**
   * Currency
   */
  @Prop({ type: String })
  currency?: string;

  /**
   * Full event data from Stripe
   */
  @Prop({ type: Schema.Types.Mixed, required: true })
  eventData: Record<string, any>;

  /**
   * Processing status
   */
  @Prop({
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
  })
  processingStatus: string;

  /**
   * Error message (if processing failed)
   */
  @Prop({ type: String })
  errorMessage?: string;

  /**
   * Number of processing attempts
   */
  @Prop({ default: 0 })
  attempts: number;

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
 * Stripe Webhook Event Schema Definition
 */
export const StripeWebhookEventSchema = SchemaFactory.createForClass(StripeWebhookEvent);

/**
 * Index for querying by event type
 */
StripeWebhookEventSchema.index({ eventType: 1, createdAt: -1 });

/**
 * Index for querying by payment intent
 */
StripeWebhookEventSchema.index({ paymentIntentId: 1, createdAt: -1 });

/**
 * Index for querying by processing status
 */
StripeWebhookEventSchema.index({ processingStatus: 1, attempts: 1 });

/**
 * toJSON transformation
 */
StripeWebhookEventSchema.set('toJSON', {
  transform: function (doc, ret, options) {
    ret.webhookEventId = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

/**
 * Stripe Webhook Event Document Type
 */
export type StripeWebhookEventDocument = StripeWebhookEvent & Document;

/**
 * Stripe Webhook Event Model Type
 */
export type StripeWebhookEventModel = typeof StripeWebhookEvent;
