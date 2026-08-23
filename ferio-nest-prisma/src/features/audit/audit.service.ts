import { Injectable } from '@nestjs/common';
import { AuditSource, Prisma } from '@prisma/client';
import type { UserPayload } from '@app/common';
import { PrismaService } from '@app/database';
import { AuditLogQueryDto } from './dto/audit.dto';
import { safeAuditJson } from './audit.util';

type AuditClient = Prisma.TransactionClient | PrismaService;

export type RecordAuditInput = {
  action: string;
  entityType: string;
  entityId: string;
  actor?: Pick<UserPayload, 'userId' | 'role'>;
  source?: AuditSource;
  previousValue?: unknown;
  newValue?: unknown;
  metadata?: unknown;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  record(input: RecordAuditInput, client: AuditClient = this.prisma) {
    return client.auditLog.create({
      data: {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        actorId: input.actor?.userId,
        actorRole: input.actor?.role,
        source: input.source ?? 'ADMIN_API',
        previousValue: safeAuditJson(input.previousValue),
        newValue: safeAuditJson(input.newValue),
        metadata: safeAuditJson(input.metadata),
      },
    });
  }

  async getAuditLogs(query: AuditLogQueryDto) {
    const where: Prisma.AuditLogWhereInput = {
      action: query.action
        ? { contains: query.action.normalize('NFKC').trim(), mode: 'insensitive' }
        : undefined,
      entityType: query.entityType
        ? { equals: query.entityType.normalize('NFKC').trim(), mode: 'insensitive' }
        : undefined,
      entityId: query.entityId
        ? { contains: query.entityId.normalize('NFKC').trim(), mode: 'insensitive' }
        : undefined,
      actorId: query.actorId,
      source: query.source,
    };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    const totalPages = Math.ceil(total / query.limit) || 1;
    return {
      items,
      results: items,
      data: items,
      page: query.page,
      limit: query.limit,
      total,
      totalPages,
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPrevPage: query.page > 1,
      },
    };
  }
}
