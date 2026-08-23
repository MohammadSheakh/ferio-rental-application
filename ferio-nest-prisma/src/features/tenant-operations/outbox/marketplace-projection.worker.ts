import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ListingStatus } from '@prisma/marketplace-client';
import { ControlPlanePrismaService } from '../../../infrastructure/control-plane/control-plane-prisma.service';
import { TenantDatabaseManager } from '../../../infrastructure/tenant/tenant-database.manager';
import { MarketplacePrismaService } from '../../../infrastructure/marketplace/marketplace-prisma.service';
import { OutboxEventType, TenantOutboxService } from './tenant-outbox.service';

/** Projection snapshot carried in every outbox payload. */
interface UnitProjectionPayload {
  organizationId: string;
  organizationSlug?: string;
  unitId: string;
  sellerAccountId?: string;
  targetListingId?: string | null;
  title: string;
  description?: string;
  price?: number;
  purpose?: 'RENT' | 'SALE';
  assetType?: string;
  bedrooms?: number;
  bathrooms?: number;
  floor?: number;
  areaSqFt?: number;
  address?: string | null;
  area?: string | null;
  district?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

/**
 * Marketplace Projection Worker
 *
 * Cross-plane propagator implementing §8 of the architecture baseline:
 *
 *   Tenant DB (outbox) → claim → Marketplace DB (projection)
 *
 * Guarantees:
 * - At-least-once delivery: events are retried with exponential backoff.
 * - Idempotent consumers: applying an event twice yields identical state
 *   (upsert-by-source semantics).
 * - Dead-letter after maxAttempts, visible via platform admin endpoints.
 * - Safe horizontal scale: FOR UPDATE SKIP LOCKED batch claiming.
 */
@Injectable()
export class MarketplaceProjectionWorker
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(MarketplaceProjectionWorker.name);

  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private inFlight: Promise<void> = Promise.resolve();

  private readonly pollIntervalMs = Number(
    process.env.OUTBOX_POLL_INTERVAL_MS || 5000,
  );
  private readonly batchSize = Number(process.env.OUTBOX_BATCH_SIZE || 50);
  private readonly maxAttempts = Number(process.env.OUTBOX_MAX_ATTEMPTS || 8);

  constructor(
    private readonly controlPlane: ControlPlanePrismaService,
    private readonly tenantDbManager: TenantDatabaseManager,
    private readonly marketplacePrisma: MarketplacePrismaService,
    private readonly outbox: TenantOutboxService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.tick();
    }, this.pollIntervalMs);
    // Do not block startup on the first tick — unref keeps process exitable.
    this.timer.unref?.();
    this.logger.log(
      `🔄 Projection worker started (interval=${this.pollIntervalMs}ms, batch=${this.batchSize})`,
    );
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    // Wait for the in-flight batch so we never abandon claimed events.
    await this.inFlight.catch(() => {});
    this.logger.log('🛑 Projection worker stopped');
  }

  /** One poll cycle across all active organizations. */
  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.inFlight = (async () => {
      try {
        const orgs = await this.controlPlane.saasOrganization.findMany({
          where: { status: 'ACTIVE', database: { status: 'READY' } },
          select: { id: true },
        });

        let processed = 0;
        let failed = 0;

        for (const org of orgs) {
          try {
            const db = await this.tenantDbManager.getTenantDatabase(org.id);
            const events = await this.outbox.claimBatch(db, this.batchSize);

            for (const event of events) {
              try {
                await this.applyEvent(db, event);
                await this.outbox.markProcessed(db, event.id);
                processed++;
              } catch (err) {
                const outcome = await this.outbox.releaseWithBackoff(
                  db,
                  event.id,
                  event.attempts,
                  this.maxAttempts,
                  err instanceof Error ? err : new Error(String(err)),
                );
                failed++;
                this.logger.warn(
                  `⚠️  Event ${event.eventType}/${event.id} ${outcome}: ${
                    err instanceof Error ? err.message : err
                  }`,
                );
              }
            }
          } catch (orgErr) {
            // Tenant DB unreachable — skip this cycle; events remain PENDING.
            this.logger.warn(
              `⏭️  Skipping org ${org.id} this cycle: ${
                orgErr instanceof Error ? orgErr.message : orgErr
              }`,
            );
          }
        }

        if (processed > 0 || failed > 0) {
          this.logger.log(
            `📊 Projection cycle: ${processed} applied, ${failed} failed/requeued`,
          );
        }
      } catch (cycleErr) {
        this.logger.error(
          `❌ Projection cycle error: ${cycleErr instanceof Error ? cycleErr.message : cycleErr}`,
        );
      } finally {
        this.running = false;
      }
    })();
    await this.inFlight;
  }

  /**
   * Idempotently apply one outbox event to the marketplace plane and
   * reconcile the tenant-side binding.
   */
  private async applyEvent(
    db: Awaited<ReturnType<TenantDatabaseManager['getTenantDatabase']>>,
    event: { eventType: string; aggregateId: string; payload: unknown },
  ): Promise<void> {
    const payload =
      typeof event.payload === 'string'
        ? (JSON.parse(event.payload) as UnitProjectionPayload)
        : (event.payload as UnitProjectionPayload);

    switch (event.eventType as OutboxEventTypeValue) {
      case OutboxEventType.UNIT_LISTING_PUBLISHED:
      case OutboxEventType.UNIT_LISTING_UPDATED:
        await this.upsertListing(payload);
        break;
      case OutboxEventType.UNIT_LISTING_UNPUBLISHED:
        await this.setListingStatus(payload, ListingStatus.PAUSED);
        break;
      case OutboxEventType.UNIT_LISTING_MARKED_RENTED:
        await this.setListingStatus(payload, ListingStatus.RENTED);
        break;
      default:
        // Unknown type — log & succeed so it never dead-loops the queue.
        this.logger.warn(
          `Unknown outbox event type "${event.eventType}", acknowledging.`,
        );
    }
  }

  /**
   * Create-or-update the marketplace listing projected from a managed
   * unit. Resolution order: explicit targetListingId → existing source-
   * bound listing → create new. Re-running is a no-op state-wise.
   */
  private async upsertListing(p: UnitProjectionPayload) {
    const data = {
      title: p.title,
      description: p.description,
      price: p.price ?? 0,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      floor: p.floor,
      areaSqFt: p.areaSqFt,
      address: p.address ?? undefined,
      area: p.area ?? undefined,
      district: p.district ?? undefined,
      latitude: p.latitude ?? undefined,
      longitude: p.longitude ?? undefined,
      status: ListingStatus.ACTIVE,
    };

    let listingId = p.targetListingId ?? null;

    if (!listingId) {
      const existing = await this.marketplacePrisma.propertyListing.findFirst({
        where: {
          sourceOrganizationId: p.organizationId,
          sourceUnitId: p.unitId,
          status: { in: [ListingStatus.ACTIVE, ListingStatus.PAUSED] },
        },
        select: { id: true },
      });
      listingId = existing?.id ?? null;
    }

    if (listingId) {
      const stillExists =
        await this.marketplacePrisma.propertyListing.findUnique({
          where: { id: listingId },
          select: { id: true },
        });
      if (stillExists) {
        await this.marketplacePrisma.propertyListing.update({
          where: { id: listingId },
          data,
        });
      } else {
        listingId = null; // listing was deleted externally → recreate below
      }
    }

    if (!listingId) {
      if (!p.sellerAccountId) {
        throw new Error(
          'Cannot create marketplace listing without sellerAccountId in payload',
        );
      }
      const created = await this.marketplacePrisma.propertyListing.create({
        data: {
          sellerId: p.sellerAccountId,
          purpose: p.purpose ?? 'RENT',
          assetType: (p.assetType as any) ?? 'APARTMENT',
          sellerType: 'OWNER',
          ...data,
          sourceOrganizationId: p.organizationId,
          sourceUnitId: p.unitId,
          publishedAt: new Date(),
        },
      });
      listingId = created.id;
    }

    // Bind back into the tenant DB so future events carry targetListingId.
    await dbSafeBind(
      this.tenantDbManager,
      p.organizationId,
      p.unitId,
      listingId,
    );
  }

  private async setListingStatus(
    p: UnitProjectionPayload,
    status: ListingStatus,
  ) {
    const where = p.targetListingId
      ? { id: p.targetListingId }
      : await this.marketplacePrisma.propertyListing
          .findFirst({
            where: {
              sourceOrganizationId: p.organizationId,
              sourceUnitId: p.unitId,
              status: { in: [ListingStatus.ACTIVE, ListingStatus.PAUSED] },
            },
            select: { id: true },
          })
          .then((r) => (r ? { id: r.id } : null));

    if (!where) return; // nothing to update — idempotent no-op

    await this.marketplacePrisma.propertyListing.update({
      where,
      data: { status },
    });

    if (status === ListingStatus.PAUSED) {
      await dbSetPublishedFlag(
        this.tenantDbManager,
        p.organizationId,
        p.unitId,
        false,
      );
    }
  }

  // ────────────────────────────────────────────────────────────
  // Reconciliation (Week 12 — drift detection & self-healing)
  // ────────────────────────────────────────────────────────────

  /**
   * Compare tenant published-unit state against central marketplace
   * projections and re-enqueue corrective events where they diverge.
   */
  async reconcileOrganization(organizationId: string): Promise<{
    checked: number;
    repaired: number;
  }> {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    const units = await db.unit.findMany({
      select: {
        id: true,
        name: true,
        isPublished: true,
        marketplaceListingId: true,
        property: {
          select: { name: true, address: true, area: true, district: true },
        },
      },
    });

    let repaired = 0;

    for (const unit of units) {
      const central = unit.marketplaceListingId
        ? await this.marketplacePrisma.propertyListing.findUnique({
            where: { id: unit.marketplaceListingId },
            select: { status: true },
          })
        : null;

      const centrallyVisible =
        central?.status === ListingStatus.ACTIVE ||
        central?.status === ListingStatus.PAUSED;

      if (unit.isPublished && !centrallyVisible) {
        await this.enqueueRepairEvent(
          db,
          organizationId,
          unit.id,
          OutboxEventType.UNIT_LISTING_PUBLISHED,
        );
        repaired++;
      } else if (
        !unit.isPublished &&
        central?.status === ListingStatus.ACTIVE
      ) {
        await this.enqueueRepairEvent(
          db,
          organizationId,
          unit.id,
          OutboxEventType.UNIT_LISTING_UNPUBLISHED,
        );
        repaired++;
      }
    }

    this.logger.log(
      `🧹 Reconciled org ${organizationId}: ${units.length} units checked, ${repaired} repairs enqueued`,
    );
    return { checked: units.length, repaired };
  }

  private async enqueueRepairEvent(
    db: Awaited<ReturnType<TenantDatabaseManager['getTenantDatabase']>>,
    organizationId: string,
    unitId: string,
    eventType: OutboxEventTypeValue,
  ): Promise<void> {
    await db.tenantOutboxEvent.create({
      data: {
        eventType,
        aggregateId: unitId,
        payload: { organizationId, unitId } as any,
      },
    });
  }
}

type OutboxEventTypeValue =
  `${(typeof OutboxEventType)[keyof typeof OutboxEventType]}`;

/** Best-effort binding helpers — failures are non-fatal by design. */
async function dbSafeBind(
  manager: TenantDatabaseManager,
  organizationId: string,
  unitId: string,
  listingId: string,
): Promise<void> {
  try {
    const db = await manager.getTenantDatabase(organizationId);
    await db.unit.update({
      where: { id: unitId },
      data: { isPublished: true, marketplaceListingId: listingId },
    });
  } catch {
    // Self-heals on next projection/reconciliation cycle.
  }
}

async function dbSetPublishedFlag(
  manager: TenantDatabaseManager,
  organizationId: string,
  unitId: string,
  isPublished: boolean,
): Promise<void> {
  try {
    const db = await manager.getTenantDatabase(organizationId);
    await db.unit.update({ where: { id: unitId }, data: { isPublished } });
  } catch {
    // Self-heals on next reconciliation cycle.
  }
}
