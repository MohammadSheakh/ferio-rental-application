import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { Logger, Inject } from '@nestjs/common';
import { RevenueCatWebhookService } from '../services/revenueCatWebhook.service';

/**
 * RevenueCat Webhook Controller
 * Handles incoming RevenueCat webhook events
 *
 * @version 1.0.0 (NestJS Migration)
 * @author Senior Engineering Team
 */
@Controller('webhooks/revenuecat')
@ApiTags('RevenueCat Webhooks')
export class RevenueCatWebhookController {

  private readonly logger = new Logger(RevenueCatWebhookController.name);

  constructor(private readonly revenueCatWebhookService: RevenueCatWebhookService) {}

  /**
   * Handle RevenueCat webhook
   * RevenueCat sends subscription lifecycle events to this endpoint
   *
   * Events handled:
   * - INITIAL_PURCHASE: First-time subscription
   * - RENEWAL: Subscription renewed
   * - CANCELLATION: User cancelled
   * - EXPIRATION: Subscription expired
   * - REFUND: Refund processed
   * - BILLING_ISSUE: Payment failed
   * - SUBSCRIPTION: General subscription events
   *
   * @param body - Webhook event data
   * @param signature - RevenueCat signature header
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Handle RevenueCat webhook',
    description: 'Process incoming RevenueCat webhook events for subscription lifecycle',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        api_version: { type: 'string', example: '3.0' },
        event_id: { type: 'string', example: 'INITIAL_PURCHASE' },
        event_time_ms: { type: 'number', example: 1234567890000 },
        product_id: { type: 'string', example: 'individual_monthly' },
        subscriber: {
          type: 'object',
          properties: {
            original_app_user_id: { type: 'string' },
            original_platform: { type: 'string', enum: ['ios', 'android'] },
            expiration_at_ms: { type: 'number' },
          },
        },
        environment: { type: 'string', enum: ['production', 'sandbox'] },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid signature' })
  async handleRevenueCatWebhook(
    @Body() body: any,
    @Headers('X-RevenueCat-Signature') signature: string,
    @Req() req: Req,
  ) {
    try {
      this.logger.log('🪝 RevenueCat webhook received');

      // Verify webhook signature
      const isValid = this.revenueCatWebhookService.verifySignature(body, signature);

      if (!isValid) {
        this.logger.error('❌ RevenueCat webhook signature verification failed');
        return {
          success: false,
          error: 'Invalid signature',
        };
      }

      this.logger.log('✅ RevenueCat webhook signature verified');

      // Process event (don't wait for completion)
      this.revenueCatWebhookService.processEvent(body).catch(error => {
        this.logger.error('Error processing RevenueCat event:', error);
      });

      // Respond immediately to RevenueCat
      return { received: true };
    } catch (error) {
      this.logger.error('RevenueCat webhook error:', error);

      return {
        success: false,
        error: 'Webhook processing failed',
        message: error.message,
      };
    }
  }

  /**
   * Health check endpoint for RevenueCat webhooks
   */
  @Post('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Webhook health check',
    description: 'Health check endpoint for RevenueCat webhooks',
  })
  async healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'RevenueCat Webhook Handler',
    };
  }
}
