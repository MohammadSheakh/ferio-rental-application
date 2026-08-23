import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { CreateSubscriptionPlanDto, SubscribeOrganizationDto, SubscriptionStatus, SubscriptionTier } from '../dto/rental-subscriptions.dto';

@Injectable()
export class RentalSubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async createPlan(dto: CreateSubscriptionPlanDto) {
    return {
      id: `plan-${dto.tier.toLowerCase()}-${Date.now()}`,
      name: dto.name,
      tier: dto.tier,
      monthlyPriceBdt: dto.monthlyPriceBdt,
      maxUnits: dto.maxUnits,
      maxProperties: dto.maxProperties,
      maxTeamMembers: dto.maxTeamMembers,
      enabledFeatures: dto.enabledFeatures,
      createdAt: new Date(),
    };
  }

  async getAllPlans() {
    return [
      {
        id: 'plan-starter',
        name: 'Ferio Starter (10 Units)',
        tier: 'STARTER',
        monthlyPriceBdt: 1999.0,
        maxUnits: 10,
        maxProperties: 2,
        maxTeamMembers: 3,
        enabledFeatures: ['BASIC_BILLING', 'SMS_REMINDERS'],
      },
      {
        id: 'plan-growth',
        name: 'Ferio Growth (50 Units)',
        tier: 'GROWTH',
        monthlyPriceBdt: 4999.0,
        maxUnits: 50,
        maxProperties: 10,
        maxTeamMembers: 10,
        enabledFeatures: ['BASIC_BILLING', 'MFS_AUTOMATION', 'WHATSAPP_TEMPLATES', 'ADVANCED_ANALYTICS'],
      },
      {
        id: 'plan-enterprise',
        name: 'Ferio Enterprise Unlimited',
        tier: 'ENTERPRISE',
        monthlyPriceBdt: 14999.0,
        maxUnits: 9999,
        maxProperties: 999,
        maxTeamMembers: 99,
        enabledFeatures: ['BASIC_BILLING', 'MFS_AUTOMATION', 'WHATSAPP_TEMPLATES', 'ADVANCED_ANALYTICS', 'CUSTOM_DOMAIN', 'DEDICATED_ACCOUNT_MANAGER'],
      },
    ];
  }

  async subscribeOrganization(dto: SubscribeOrganizationDto) {
    const org = await this.prisma.rentalOrganization.findUnique({
      where: { id: dto.organizationId },
    });

    if (!org) {
      throw new NotFoundException(`Organization with ID '${dto.organizationId}' not found.`);
    }

    const now = new Date();
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    return {
      id: `sub-${Date.now()}`,
      organizationId: dto.organizationId,
      planId: dto.planId,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      autoRenew: true,
      paymentMethod: dto.paymentMethod,
    };
  }

  async getOrganizationSubscription(organizationId: string) {
    return {
      organizationId,
      planName: 'Ferio Growth (50 Units)',
      tier: SubscriptionTier.GROWTH,
      status: SubscriptionStatus.ACTIVE,
      unitsUsed: 36,
      unitsLimit: 50,
      propertiesUsed: 3,
      propertiesLimit: 10,
      currentPeriodEnd: '2026-09-22T23:59:59.000Z',
      autoRenew: true,
    };
  }
}
