import { Injectable, Logger } from '@nestjs/common';
import {
  PrismaClient as TenantPrismaClient,
  OutboxEventStatus,
} from '@prisma/tenant-client';

/**
 * Event types emitted to the cross-plane outbox.
 * Keep in sync with MarketplaceProjectionWorker handlers.
 */
export const OutboxEventType = {
  UNIT_LISTING_PUBLISHED: 'unit.listing_published',
  UNIT_LISTING_UPDATED: 'unit.listing_updated',
  UNIT_LISTING_UNPUBLISHED: 'unit.listing_unpublished',
  UNIT_LISTING_MARKED_RENTED: 'unit.listing_marked_rented',
} as const;

export type OutboxEventTypeValue =
  (typeof OutboxEventType)[keyof typeof OutboxEventType];

/**
 * Tenant Outbox Service
 *
 * Implements the transactional outbox pattern for tenant → marketplace
 * synchronization. Events are written INSIDE the same tenant-DB
 * transaction as the domain state change, so either both commit or
 * neither does. A background worker then projects events to the
 * central marketplace database with at-least-once semantics.
 *
 * This replaces unsafe synchronous cross-DB dual writes (§21 rule).
 */
@Injectable()
export class TenantOutboxService {
  private readonly logger = new Logger(TenantOutboxService.name);

  /**
   * Append an outbox event inside an open tenant-DB transaction.
   *
   * @param tx Transaction client from `db.$transaction(async (tx) => ...)`
   */
  async appendInTransaction(
    tx: TenantPrismaClient,
    eventType: OutboxEventTypeValue,
    aggregateId: string,
    payload: Record<string, unknown>,
  ): Promise<string> {
    const event = await tx.tenantOutboxEvent.create({
      data: {
        eventType,
        aggregateId,
        payload: payload as any,
      },
    });

    this.logger.log(
      `📮 Outbox event ${eventType} queued (${event.id}) for unit ${aggregateId}`,
    );
    return event.id;
  }

  /**
   * Atomically claim a batch of due PENDING events.
   *
   * Uses a single UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED)
   * so multiple worker instances never process the same event twice and
   * never block each other.
   */
  async claimBatch(
    db: TenantPrismaClient,
    batchSize: number,
  ): Promise<
    Array<{
      id: string;
      eventType: string;
      aggregateId: string;
      payload: unknown;
      attempts: number;
    }>
  > {
    const rows = await db.$queryRaw<Array<{ id: string }>>`
      UPDATE "TenantOutboxEvent"
      SET "status" = ${OutboxEventStatus.PROCESSING}, "attempts" = "attempts" + 1
      WHERE "id" IN (
        SELECT "id" FROM "TenantOutboxEvent"
        WHERE "status" = ${OutboxEventStatus.PENDING}
          AND "availableAt" <= now()
        ORDER BY "createdAt"
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING "id"
    `;

    if (rows.length === 0) return [];

    const claimed = await db.tenantOutboxEvent.findMany({
      where: { id: { in: rows.map((r) => r.id) } },
      select: {
        id: true,
        eventType: true,
        aggregateId: true,
        payload: true,
        attempts: true,
      },
    });

    return claimed;
  }

  /** Mark an event as successfully projected. */
  markProcessed(db: TenantPrismaClient, eventId: string): Promise<unknown> {
    return db.tenantOutboxEvent.update({
      where: { id: eventId },
      data: {
        status: OutboxEventStatus.PROCESSED,
        processedAt: new Date(),
        lastError: null,
      },
    });
  }

  /**
   * Requeue a failed event with exponential backoff, or dead-letter it
   * once maxAttempts is exhausted.
   */
  async releaseWithBackoff(
    db: TenantPrismaClient,
    eventId: string,
    attempts: number,
    maxAttempts: number,
    error: Error,
  ): Promise<'REQUEUED' | 'DEAD_LETTER'> {
    const backoffSeconds = Math.min(2 ** attempts * 5, 3600); // 10s → 1h cap

    if (attempts >= maxAttempts) {
      await db.tenantOutboxEvent.update({
        where: { id: eventId },
        data: {
          status: OutboxEventStatus.FAILED,
          lastError: error.message.slice(0, 2000),
        },
      });
      return 'DEAD_LETTER';
    }

    await db.tenantOutboxEvent.update({
      where: { id: eventId },
      data: {
        status: OutboxEventStatus.PENDING,
        lastError: error.message.slice(0, 2000),
        availableAt: new Date(Date.now() + backoffSeconds * 1000),
      },
    });
    return 'REQUEUED';
  }
}
