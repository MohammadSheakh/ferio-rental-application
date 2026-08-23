import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RevenueCatWebhookService } from './services/revenueCatWebhook.service';

/**
 * RevenueCat Webhook Controller
 * Handles incoming RevenueCat webhook events
 */
@Controller('webhooks/revenuecat-subscription')
@ApiTags('RevenueCat Webhooks')
export class RevenueCatWebhookController {
  constructor(private readonly webhookService: RevenueCatWebhookService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle RevenueCat webhook' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  @ApiResponse({ status: 401, description: 'Invalid signature' })
  async handleWebhook(
    @Body() body: any,
    @Headers('X-RevenueCat-Signature') signature: string,
  ) {
    // Verify signature
    const isValid = this.webhookService.verifySignature(body, signature);
    if (!isValid) {
      return { success: false, error: 'Invalid signature' };
    }

    // Process event asynchronously
    this.webhookService.processEvent(body).catch(err => {
      console.error('RevenueCat webhook error:', err);
    });

    return { received: true };
  }
}
