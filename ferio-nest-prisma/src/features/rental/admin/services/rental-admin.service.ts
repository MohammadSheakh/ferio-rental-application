import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { UpdateOrganizationStatusDto, SetFeatureFlagDto, AccountStatus } from '../dto/rental-admin.dto';

@Injectable()
export class RentalAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllOrganizations() {
    return [
      {
        id: 'org-101',
        name: 'Ferio Property Holdings Ltd.',
        code: 'FERIO-HQ',
        status: 'ACTIVE',
        subscriptionTier: 'GROWTH',
        propertiesCount: 3,
        unitsCount: 36,
        createdAt: '01 Jan 2026',
      },
      {
        id: 'org-102',
        name: 'Gulshan Prime Real Estate',
        code: 'GULSHAN-PRIME',
        status: 'ACTIVE',
        subscriptionTier: 'ENTERPRISE',
        propertiesCount: 12,
        unitsCount: 240,
        createdAt: '15 Feb 2026',
      },
    ];
  }

  async updateOrganizationStatus(orgId: string, dto: UpdateOrganizationStatusDto, adminUserId: string) {
    return {
      organizationId: orgId,
      status: dto.status,
      reason: dto.reason || 'Admin status override',
      updatedByAdminId: adminUserId,
      updatedAt: new Date(),
    };
  }

  async setFeatureFlag(dto: SetFeatureFlagDto) {
    return {
      flagKey: dto.flagKey,
      enabled: dto.enabled,
      targetOrganizationId: dto.targetOrganizationId || 'GLOBAL',
      updatedAt: new Date(),
    };
  }

  async getPlatformHealth() {
    return {
      status: 'HEALTHY',
      uptimeSeconds: 1249000,
      databaseConnections: {
        active: 14,
        idle: 36,
        maxPool: 50,
      },
      redisCache: {
        status: 'CONNECTED',
        usedMemoryMb: 48.2,
      },
      queueThroughput: {
        activeJobs: 0,
        waitingJobs: 0,
        failedJobsCount: 0,
      },
      apiLatencyP95Ms: 142,
      lastHealthCheck: new Date(),
    };
  }
}
