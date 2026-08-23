//@ts-ignore
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
//@ts-ignore
import { Document, Types } from 'mongoose';

/**
 * RevenueCat Webhook Event Schema
 * Logs all RevenueCat webhook events for audit and debugging
 *
 * @version 1.0.0 (NestJS Migration)
 * @author Senior Engineering Team
 */
@Schema({ timestamps: true })
export class RevenueCatWebhookEvent {
  /**
   * MongoDB document ID
   */
  _id?: Types.ObjectId;

  /**
   * RevenueCat event ID
   */
  @Prop({
    type: String,
    required: [true, 'Event ID is required'],
    unique: true,
    index: true,
  })
  eventId: string;

  /**
   * RevenueCat event type
   */
  @Prop({
    type: String,
    required: [true, 'Event type is required'],
    index: true,
  })
  eventType: string;

  /**
   * App ID
   */
  @Prop({ type: String, index: true })
  appId: string;

  /**
   * User ID (original_app_user_id)
   */
  @Prop({ type: String, index: true })
  userId: string;

  /**
   * Product ID
   */
  @Prop({ type: String, index: true })
  productId: string;

  /**
   * Environment (production or sandbox)
   */
  @Prop({ type: String, enum: ['production', 'sandbox'] })
  environment: string;

  /**
   * Full event data from RevenueCat
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
 * RevenueCat Webhook Event Schema Definition
 */
export const RevenueCatWebhookEventSchema = SchemaFactory.createForClass(RevenueCatWebhookEvent);

/**
 * Index for querying by event type
 */
RevenueCatWebhookEventSchema.index({ eventType: 1, createdAt: -1 });

/**
 * Index for querying by user ID
 */
RevenueCatWebhookEventSchema.index({ userId: 1, createdAt: -1 });

/**
 * Index for querying by processing status
 */
RevenueCatWebhookEventSchema.index({ processingStatus: 1, attempts: 1 });

/**
 * toJSON transformation
 */
RevenueCatWebhookEventSchema.set('toJSON', {
  transform: function (doc, ret, options) {
    ret.webhookEventId = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

/**
 * RevenueCat Webhook Event Document Type
 */
export type RevenueCatWebhookEventDocument = RevenueCatWebhookEvent & Document;

/**
 * RevenueCat Webhook Event Model Type
 */
export type RevenueCatWebhookEventModel = typeof RevenueCatWebhookEvent;
