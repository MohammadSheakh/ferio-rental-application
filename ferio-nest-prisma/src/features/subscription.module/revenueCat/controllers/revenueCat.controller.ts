import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RevenueCatService } from './services/revenueCat.service';

/**
 * RevenueCat Controller
 * Handles RevenueCat API operations
 *
 * @version 1.0.0 (NestJS Migration)
 * @author Senior Engineering Team
 */
@Controller('revenuecat')
@ApiTags('RevenueCat')
export class RevenueCatController {
  constructor(private readonly revenueCatService: RevenueCatService) {}

  /**
   * Get user subscriptions
   */
  @Get('subscriptions/:userId')
  @ApiOperation({
    summary: 'Get user subscriptions',
    description: 'Get user\'s subscriptions from RevenueCat',
  })
  @ApiResponse({ status: 200, description: 'Subscriptions retrieved' })
  async getUserSubscriptions(@Param('userId') userId: string) {
    const result = await this.revenueCatService.getUserSubscriptions(userId);

    return {
      success: true,
      data: result,
      message: 'Subscriptions retrieved successfully',
    };
  }

  /**
   * Validate receipt
   */
  @Post('validate-receipt')
  @ApiOperation({
    summary: 'Validate receipt',
    description: 'Validate Apple/Google receipt via RevenueCat',
  })
  @ApiResponse({ status: 200, description: 'Receipt validated' })
  async validateReceipt(@Body('receipt') receiptData: string) {
    const result = await this.revenueCatService.validateReceipt(receiptData);

    return {
      success: true,
      data: result,
      message: 'Receipt validated successfully',
    };
  }

  /**
   * Health check for RevenueCat webhooks
   */
  @Post('webhook/health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Webhook health check',
    description: 'Health check for RevenueCat webhooks',
  })
  async healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'RevenueCat Webhook Handler',
    };
  }
}
