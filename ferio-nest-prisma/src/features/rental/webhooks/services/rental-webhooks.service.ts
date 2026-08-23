import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { CreateApiKeyDto, RegisterWebhookEndpointDto, DispatchTestWebhookDto, ApiKeyPermission } from '../dto/rental-webhooks.dto';
import * as crypto from 'crypto';

@Injectable()
export class RentalWebhooksService {
  constructor(private readonly prisma: PrismaService) {}

  async createApiKey(dto: CreateApiKeyDto, createdByUserId: string) {
    const rawKey = `fr_live_${crypto.randomBytes(24).toString('hex')}`;

    return {
      id: `key-${Date.now()}`,
      organizationId: dto.organizationId,
      name: dto.name,
      permission: dto.permission,
      rawApiKeySecret: rawKey, // Displayed only ONCE to administrator
      maskedKey: `${rawKey.slice(0, 10)}...${rawKey.slice(-4)}`,
      createdByUserId,
      createdAt: new Date(),
    };
  }

  async registerWebhookEndpoint(dto: RegisterWebhookEndpointDto) {
    const secret = dto.secret || `whsec_${crypto.randomBytes(16).toString('hex')}`;

    return {
      id: `wh-ep-${Date.now()}`,
      organizationId: dto.organizationId,
      targetUrl: dto.targetUrl,
      subscribedEvents: dto.subscribedEvents,
      signingSecret: secret,
      active: true,
      createdAt: new Date(),
    };
  }

  async dispatchTestWebhook(dto: DispatchTestWebhookDto) {
    const deliveryId = `del-${Date.now()}`;
    const samplePayload = {
      event: dto.eventType,
      timestamp: new Date().toISOString(),
      data: {
        invoiceId: 'inv-889900',
        amount: 45000.0,
        currency: 'BDT',
        status: 'PAID',
        tenant: 'Tanvir Hossain',
      },
    };

    return {
      deliveryId,
      endpointId: dto.endpointId,
      eventType: dto.eventType,
      httpStatusCode: 200,
      deliveryStatus: 'SUCCESS',
      attempts: 1,
      payload: samplePayload,
      deliveredAt: new Date(),
    };
  }

  async getDeliveriesByOrganization(organizationId: string) {
    return [
      {
        id: 'del-101',
        endpointUrl: 'https://api.myerp.com/ferio-webhooks',
        event: 'PAYMENT_RECEIVED',
        httpStatus: 200,
        status: 'SUCCESS',
        timestamp: '22 Aug 2026, 03:30 PM',
      },
      {
        id: 'del-102',
        endpointUrl: 'https://api.myerp.com/ferio-webhooks',
        event: 'LEASE_ACTIVATED',
        httpStatus: 200,
        status: 'SUCCESS',
        timestamp: '20 Aug 2026, 11:15 AM',
      },
    ];
  }
}
