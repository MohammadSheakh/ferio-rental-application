import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RentalCommunicationsService } from '../services/rental-communications.service';
import { SendWhatsAppMessageDto, WhatsAppInboundWebhookDto } from '../dto/rental-communications.dto';
import { AuthGuard } from '@app/common';

@ApiTags('Rental - WhatsApp & Multichannel Communications Engine')
@Controller('api/rental/communications')
export class RentalCommunicationsController {
  constructor(private readonly commsService: RentalCommunicationsService) {}

  @Post('send-whatsapp')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Send WhatsApp Business Cloud API template (Rent Reminder, Receipt, Repair Alert)' })
  async sendWhatsAppTemplate(@Body() dto: SendWhatsAppMessageDto, @Request() req: any) {
    const userId = req.user?.id || req.user?.sub;
    const data = await this.commsService.sendWhatsAppTemplate(dto, userId);
    return {
      success: true,
      message: `WhatsApp message '${dto.templateType}' dispatched to ${dto.recipientPhone}.`,
      data,
    };
  }

  @Post('whatsapp/webhook')
  @ApiOperation({ summary: 'Inbound WhatsApp Webhook Receiver for Tenant Messages & Maintenance Requests' })
  async handleInboundWhatsApp(@Body() dto: WhatsAppInboundWebhookDto) {
    const data = await this.commsService.handleInboundWhatsApp(dto);
    return {
      success: true,
      message: 'Inbound WhatsApp processed successfully.',
      data,
    };
  }

  @Get('timeline/:personId')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get complete multichannel communication timeline for a tenant or owner' })
  async getCommunicationTimeline(@Param('personId') personId: string) {
    const data = await this.commsService.getCommunicationTimeline(personId);
    return {
      success: true,
      data,
    };
  }
}
