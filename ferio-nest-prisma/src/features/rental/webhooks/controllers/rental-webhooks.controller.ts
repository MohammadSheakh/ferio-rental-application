import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RentalWebhooksService } from '../services/rental-webhooks.service';
import { CreateApiKeyDto, RegisterWebhookEndpointDto, DispatchTestWebhookDto } from '../dto/rental-webhooks.dto';
import { AuthGuard } from '@app/common';

@ApiTags('Rental - Enterprise API Keys & Outbound Webhooks Engine')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('api/rental/webhooks')
export class RentalWebhooksController {
  constructor(private readonly webhooksService: RentalWebhooksService) {}

  @Post('keys')
  @ApiOperation({ summary: 'Generate an Enterprise API Key for third-party ERP/accounting sync' })
  async createApiKey(@Body() dto: CreateApiKeyDto, @Request() req: any) {
    const userId = req.user?.id || req.user?.sub;
    const data = await this.webhooksService.createApiKey(dto, userId);
    return {
      success: true,
      message: `API Key '${dto.name}' generated successfully. Copy secret now—it will not be shown again!`,
      data,
    };
  }

  @Post('endpoints')
  @ApiOperation({ summary: 'Register an Outbound Webhook target URL for live event push notifications' })
  async registerWebhookEndpoint(@Body() dto: RegisterWebhookEndpointDto) {
    const data = await this.webhooksService.registerWebhookEndpoint(dto);
    return {
      success: true,
      message: `Webhook endpoint registered for events: ${dto.subscribedEvents.join(', ')}.`,
      data,
    };
  }

  @Post('test-dispatch')
  @ApiOperation({ summary: 'Dispatch a test webhook event payload to a target endpoint' })
  async dispatchTestWebhook(@Body() dto: DispatchTestWebhookDto) {
    const data = await this.webhooksService.dispatchTestWebhook(dto);
    return {
      success: true,
      message: `Test event '${dto.eventType}' dispatched successfully. HTTP ${data.httpStatusCode}.`,
      data,
    };
  }

  @Get('deliveries/:organizationId')
  @ApiOperation({ summary: 'Get outbound webhook delivery attempt audit logs for an organization' })
  async getDeliveriesByOrganization(@Param('organizationId') organizationId: string) {
    const data = await this.webhooksService.getDeliveriesByOrganization(organizationId);
    return {
      success: true,
      data,
    };
  }
}
