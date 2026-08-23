import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RentalPaymentGatewayService } from '../services/rental-payment-gateway.service';
import { InitiateMfsPaymentDto, MfsWebhookPayloadDto } from '../dto/rental-payment-gateway.dto';
import { AuthGuard } from '@app/common';

@ApiTags('Rental - MFS Online Payment Gateway & Webhook Reconciliation')
@Controller('api/rental/payments')
export class RentalPaymentGatewayController {
  constructor(private readonly gatewayService: RentalPaymentGatewayService) {}

  @Post('initiate-mfs')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Initiate bKash or Nagad Merchant Checkout URL for rent invoice' })
  async initiateMfsPayment(@Body() dto: InitiateMfsPaymentDto, @Request() req: any) {
    const userId = req.user?.id || req.user?.sub;
    const data = await this.gatewayService.initiateMfsPayment(dto, userId);
    return {
      success: true,
      message: `${dto.provider} checkout URL generated successfully.`,
      data,
    };
  }

  @Post('bkash/webhook')
  @ApiOperation({ summary: 'bKash Merchant Payment Instant Webhook Notification URL' })
  async handleBkashWebhook(@Body() payload: MfsWebhookPayloadDto) {
    const result = await this.gatewayService.handleBkashWebhook(payload);
    return {
      statusCode: '0000',
      statusMessage: 'Successful',
      result,
    };
  }

  @Post('nagad/webhook')
  @ApiOperation({ summary: 'Nagad Merchant Instant Webhook Notification URL' })
  async handleNagadWebhook(@Body() payload: MfsWebhookPayloadDto) {
    const result = await this.gatewayService.handleNagadWebhook(payload);
    return {
      status: 'SUCCESS',
      result,
    };
  }

  @Get('reconciliation-findings')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get automated MFS reconciliation findings queue' })
  async getReconciliationFindings(@Query('organizationId') organizationId: string) {
    const data = await this.gatewayService.getReconciliationFindings(organizationId);
    return {
      success: true,
      data,
    };
  }
}
