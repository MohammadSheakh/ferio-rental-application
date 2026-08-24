import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { UnitStatus } from '@prisma/tenant-client';
import { TenantDatabaseManager } from '../../infrastructure/tenant/tenant-database.manager';
import {
  OutboxEventType,
  TenantOutboxService,
} from './outbox/tenant-outbox.service';

/**
 * Marketplace Projection Service
 *
 * Public API for publishing managed units to the central marketplace.
 *
 * v2.1: writes are TRANSACTIONAL OUTBOX events (§8 Cross-Plane Event
 * Architecture). The unit state change and its cross-plane event commit
 * atomically in the tenant DB; MarketplaceProjectionWorker then applies
 * the projection to the marketplace DB asynchronously with retry,
 * dead-letter and reconciliation. No synchronous cross-DB dual writes.
 */
@Injectable()
export class MarketplaceProjectionService {
  private readonly logger = new Logger(MarketplaceProjectionService.name);

  constructor(
    private readonly tenantDbManager: TenantDatabaseManager,
    private readonly outbox: TenantOutboxService,
  ) {}

  /**
   * Publish a managed unit to the central public marketplace.
   * Queues `unit.listing_published` transactionally with the unit
   * status change; the projection appears when the worker drains.
   */
  async publishUnitToMarketplace(
    organizationId: string,
    unitId: string,
    sellerAccountId: string,
    options?: {
      price?: number;
      purpose?: 'RENT' | 'SALE';
      assetType?: string;
      description?: string;
    },
  ) {
    if (!sellerAccountId) {
      throw new BadRequestException(
        'sellerAccountId is required to publish a unit',
      );
    }

    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    return db.$transaction(async (tx) => {
      const unit = await tx.unit.findUnique({
        where: { id: unitId },
        include: {
          property: {
            select: {
              id: true,
              name: true,
              address: true,
              area: true,
              district: true,
              latitude: true,
              longitude: true,
            },
          },
          building: { select: { name: true, totalFloors: true } },
          ownership: { where: { isPrimary: true }, take: 1 },
        },
      });

      if (!unit) {
        throw new NotFoundException('Unit not found in tenant database');
      }

      const title = `${unit.property.name} — Unit ${unit.name}`;

      // §24: carry the room-by-room breakdown into the projection so the
      // public listing renders full detail (name/type/ft×ft/photos).
      const rooms = await tx.unitRoom.findMany({
        where: { unitId },
        orderBy: { sortOrder: 'asc' },
        include: { media: { orderBy: { sortOrder: 'asc' } } },
      });

      const payload = {
        organizationId,
        unitId,
        sellerAccountId,
        targetListingId: unit.marketplaceListingId,
        title,
        description:
          options?.description ??
          `Managed unit listed by property owner. Location: ${unit.property.address || unit.property.area || 'Dhaka'}`,
        price: options?.price ?? 0,
        purpose: options?.purpose ?? 'RENT',
        assetType: options?.assetType ?? 'APARTMENT',
        bedrooms: unit.bedrooms,
        bathrooms: unit.bathrooms,
        floor: unit.floor,
        areaSqFt: unit.areaSqFt,
        address: unit.property.address,
        area: unit.property.area,
        district: unit.property.district,
        latitude: unit.property.latitude,
        longitude: unit.property.longitude,
        rooms: rooms.map((r) => ({
          name: r.name,
          type: r.type as string,
          lengthFt: r.lengthFt,
          widthFt: r.widthFt,
          description: r.description,
          sortOrder: r.sortOrder,
          media: r.media.map((m) => ({ url: m.url, caption: m.caption ?? undefined })),
        })),
      };

      // Domain state change + event in ONE tenant-DB transaction.
      await tx.unit.update({
        where: { id: unitId },
        data: { status: UnitStatus.LISTED, isPublished: true },
      });
      await this.outbox.appendInTransaction(
        tx as any,
        OutboxEventType.UNIT_LISTING_PUBLISHED,
        unitId,
        payload,
      );

      this.logger.log(
        `📮 Publish queued for unit ${unitId} (Org: ${organizationId}) — projection pending worker drain`,
      );
      return {
        queued: true,
        unitId,
        organizationId,
        eventType: OutboxEventType.UNIT_LISTING_PUBLISHED,
      };
    });
  }

  /**
   * Update an already-published unit's marketplace projection.
   */
  async updatePublishedUnit(
    organizationId: string,
    unitId: string,
    changes?: { price?: number; description?: string },
  ) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    return db.$transaction(async (tx) => {
      const unit = await tx.unit.findUnique({ where: { id: unitId } });
      if (!unit)
        throw new NotFoundException('Unit not found in tenant database');
      if (!unit.isPublished && !unit.marketplaceListingId) {
        throw new BadRequestException(
          'Unit is not published to the marketplace',
        );
      }

      const full = await tx.unit.findUnique({
        where: { id: unitId },
        include: {
          property: {
            select: {
              name: true,
              address: true,
              area: true,
              district: true,
              latitude: true,
              longitude: true,
            },
          },
          rooms: {
            orderBy: { sortOrder: 'asc' },
            include: { media: { orderBy: { sortOrder: 'asc' } } },
          },
        },
      });
      if (!full)
        throw new NotFoundException('Unit not found in tenant database');

      await this.outbox.appendInTransaction(
        tx as any,
        OutboxEventType.UNIT_LISTING_UPDATED,
        unitId,
        {
          organizationId,
          unitId,
          targetListingId: unit.marketplaceListingId,
          title: `${full.property.name} — Unit ${full.name}`,
          description: changes?.description,
          price: changes?.price ?? 0,
          purpose: 'RENT',
          assetType: 'APARTMENT',
          bedrooms: full.bedrooms,
          bathrooms: full.bathrooms,
          floor: full.floor,
          areaSqFt: full.areaSqFt,
          address: full.property.address,
          area: full.property.area,
          district: full.property.district,
          latitude: full.property.latitude,
          longitude: full.property.longitude,
          rooms: full.rooms.map((r) => ({
            name: r.name,
            type: r.type as string,
            lengthFt: r.lengthFt,
            widthFt: r.widthFt,
            description: r.description,
            sortOrder: r.sortOrder,
            media: r.media.map((m) => ({ url: m.url, caption: m.caption ?? undefined })),
          })),
        },
      );

      return {
        queued: true,
        unitId,
        eventType: OutboxEventType.UNIT_LISTING_UPDATED,
      };
    });
  }

  /**
   * Pause/unpublish the unit's marketplace listing.
   */
  async unpublishUnitFromMarketplace(organizationId: string, unitId: string) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    return db.$transaction(async (tx) => {
      const unit = await tx.unit.findUnique({ where: { id: unitId } });
      if (!unit)
        throw new NotFoundException('Unit not found in tenant database');

      if (!unit.isPublished && !unit.marketplaceListingId) {
        return { queued: false, unitId, reason: 'NOT_PUBLISHED' };
      }

      await tx.unit.update({
        where: { id: unitId },
        data: { isPublished: false, status: UnitStatus.AVAILABLE },
      });
      await this.outbox.appendInTransaction(
        tx as any,
        OutboxEventType.UNIT_LISTING_UNPUBLISHED,
        unitId,
        {
          organizationId,
          unitId,
          targetListingId: unit.marketplaceListingId,
        },
      );

      this.logger.log(
        `⏸️  Unpublish queued for unit ${unitId} (Org: ${organizationId})`,
      );
      return {
        queued: true,
        unitId,
        eventType: OutboxEventType.UNIT_LISTING_UNPUBLISHED,
      };
    });
  }

  /**
   * Mark the unit's listing as RENTED (e.g. after lease activation).
   */
  async markUnitRented(organizationId: string, unitId: string) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    return db.$transaction(async (tx) => {
      const unit = await tx.unit.findUnique({ where: { id: unitId } });
      if (!unit)
        throw new NotFoundException('Unit not found in tenant database');

      await tx.unit.update({
        where: { id: unitId },
        data: { isPublished: false, status: UnitStatus.OCCUPIED },
      });
      await this.outbox.appendInTransaction(
        tx as any,
        OutboxEventType.UNIT_LISTING_MARKED_RENTED,
        unitId,
        { organizationId, unitId, targetListingId: unit.marketplaceListingId },
      );

      return {
        queued: true,
        unitId,
        eventType: OutboxEventType.UNIT_LISTING_MARKED_RENTED,
      };
    });
  }
}
