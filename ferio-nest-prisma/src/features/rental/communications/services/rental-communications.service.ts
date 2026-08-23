import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { SendWhatsAppMessageDto, WhatsAppInboundWebhookDto, MessageTemplateType } from '../dto/rental-communications.dto';

@Injectable()
export class RentalCommunicationsService {
  constructor(private readonly prisma: PrismaService) {}

  async sendWhatsAppTemplate(dto: SendWhatsAppMessageDto, senderUserId: string) {
    const person = await this.prisma.rentalPerson.findUnique({
      where: { id: dto.recipientPersonId },
    });

    if (!person) {
      throw new NotFoundException(`Person with ID '${dto.recipientPersonId}' not found.`);
    }

    const messageId = `wamid-${Date.now()}`;
    const formattedContent = this.formatTemplateMessage(dto.templateType, dto.templateParams);

    return {
      messageId,
      channel: 'WHATSAPP',
      recipientPersonId: dto.recipientPersonId,
      recipientPhone: dto.recipientPhone,
      templateType: dto.templateType,
      messageBody: formattedContent,
      status: 'DELIVERED',
      sentAt: new Date(),
    };
  }

  async handleInboundWhatsApp(dto: WhatsAppInboundWebhookDto) {
    const person = await this.prisma.rentalPerson.findFirst({
      where: { phone: dto.fromPhone },
    });

    return {
      whatsappMessageId: dto.whatsappMessageId,
      senderPerson: person ? `${person.firstName} ${person.lastName}` : 'Unknown Contact',
      phone: dto.fromPhone,
      messageBody: dto.messageBody,
      mediaCount: dto.mediaUrls ? dto.mediaUrls.length : 0,
      maintenanceDraftCreated: true,
      receivedAt: new Date(),
    };
  }

  async getCommunicationTimeline(personId: string) {
    return [
      {
        id: 'msg-01',
        channel: 'WHATSAPP',
        direction: 'OUTBOUND',
        template: 'RENT_REMINDER',
        content: 'Dear Tanvir, your monthly rent of ৳45,000 for Rose Valley #A-4 is due on 05 Sep 2026. Pay via bKash: https://pay.ferio.com/inv-01',
        status: 'DELIVERED',
        timestamp: '22 Aug 2026, 09:00 AM',
      },
      {
        id: 'msg-02',
        channel: 'WHATSAPP',
        direction: 'INBOUND',
        template: 'MAINTENANCE_INBOUND',
        content: 'Master bathroom shower mixer water pressure low.',
        status: 'RECEIVED',
        timestamp: '10 Aug 2026, 02:15 PM',
      },
    ];
  }

  private formatTemplateMessage(templateType: MessageTemplateType, params: Record<string, any> = {}): string {
    switch (templateType) {
      case MessageTemplateType.RENT_REMINDER:
        return `Dear ${params.tenantName || 'Tenant'}, your monthly rent of ${params.amount || '৳45,000'} for ${params.unit || 'your unit'} is due on ${params.dueDate || 'due date'}.`;
      case MessageTemplateType.PAYMENT_CONFIRMATION:
        return `Payment received! Rent payment of ${params.amount} for ${params.period} confirmed. Download receipt: ${params.receiptUrl}`;
      case MessageTemplateType.MAINTENANCE_CREATED:
        return `Repair ticket #${params.ticketId} created. Caretaker/Vendor will inspect your unit shortly.`;
      default:
        return `Notification from Ferio Rental Management.`;
    }
  }
}
