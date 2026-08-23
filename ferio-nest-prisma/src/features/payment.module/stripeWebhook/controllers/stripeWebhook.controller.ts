import {
  Controller,
  Post,
  RawBodyRequest,
  Req,
  Res,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { StripeWebhookService } from './services/stripeWebhook.service';
import { Request, Response } from 'express';

/**
 * Stripe Webhook Controller
 * Handles incoming Stripe webhook events
 *
 * @version 1.0.0 (NestJS Migration)
 * @author Senior Engineering Team
 */
@Controller('webhooks/stripe')
@ApiTags('Stripe Webhooks')
export class StripeWebhookController {
  constructor(private readonly stripeWebhookService: StripeWebhookService) {}

  /**
   * Handle Stripe webhook
   * Stripe sends events to this endpoint
   *
   * @param req - Express request with raw body
   * @param signature - Stripe signature header
   * @param res - Express response
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Handle Stripe webhook',
    description: 'Process incoming Stripe webhook events',
  })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid signature' })
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
    @Headers('stripe-signature') signature: string,
  ) {
    try {
      // Get raw body for signature verification
      const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));

      // Construct and verify event
      const event = await this.stripeWebhookService.constructEvent(rawBody, signature);

      // Process event (don't wait for completion)
      this.stripeWebhookService.processEvent(event).catch(error => {
        console.error('Error processing webhook event:', error);
      });

      // Respond immediately to Stripe
      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Stripe webhook error:', error);

      if (error.message.includes('signature')) {
        return res.status(400).json({
          error: 'Invalid signature',
          message: error.message,
        });
      }

      return res.status(500).json({
        error: 'Webhook processing failed',
        message: error.message,
      });
    }
  }

  /**
   * Health check endpoint for Stripe webhooks
   */
  @Post('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Webhook health check',
    description: 'Health check endpoint for Stripe webhooks',
  })
  async healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
