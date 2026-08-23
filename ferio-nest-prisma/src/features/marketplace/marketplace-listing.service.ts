import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, DocumentVisibility } from '@prisma/marketplace-client';
import { MarketplacePrismaService } from '../../infrastructure/marketplace/marketplace-prisma.service';
import {
  CreateListingDto,
  UpdateListingDto,
  AddListingMediaDto,
  AddListingDocumentDto,
  SearchListingsDto,
  MapSearchDto,
} from './dto/marketplace-listing.dto';
import { ListingStatus } from '@prisma/marketplace-client';

/** Shape of rows returned by geospatial raw queries. */
interface GeoSearchRow {
  id: string;
  title: string;
  price: number;
  purpose: string;
  assetType: string;
  latitude: number | null;
  longitude: number | null;
  area: string | null;
  district: string | null;
  coverImageUrl: string | null;
  isIdentityVerified: boolean;
  verificationBadge: string | null;
  sellerDisplayName: string | null;
  sellerAccountType: string | null;
  createdAt: Date;
  distanceKm: number | null;
}

@Injectable()
export class MarketplaceListingService {
  /**
   * When true, new and edited listings enter PENDING_REVIEW and only a
   * platform moderator can move them to ACTIVE (§7 / §13 moderation).
   */
  private readonly moderationEnabled =
    process.env.MARKETPLACE_MODERATION_ENABLED !== 'false';

  constructor(private readonly marketplacePrisma: MarketplacePrismaService) {}

  async createListing(sellerAccountId: string, dto: CreateListingDto) {
    const account = await this.marketplacePrisma.marketplaceAccount.findUnique({
      where: { id: sellerAccountId },
    });

    if (!account) {
      throw new NotFoundException('Marketplace seller account not found');
    }

    return this.marketplacePrisma.propertyListing.create({
      data: {
        sellerId: account.id,
        purpose: dto.purpose,
        assetType: dto.assetType,
        sellerType: dto.sellerType || (account.accountType as any),
        title: dto.title,
        description: dto.description,
        price: dto.price,
        priceNegotiable: dto.priceNegotiable ?? false,
        rentFrequency: dto.rentFrequency,
        availableFrom: dto.availableFrom ? new Date(dto.availableFrom) : null,
        bedrooms: dto.bedrooms,
        bathrooms: dto.bathrooms,
        floor: dto.floor,
        totalFloors: dto.totalFloors,
        areaSqFt: dto.areaSqFt,
        landSizeKatha: dto.landSizeKatha,
        parking: dto.parking,
        furnishing: dto.furnishing,
        amenities: dto.amenities || [],
        address: dto.address,
        area: dto.area,
        district: dto.district,
        division: dto.division,
        latitude: dto.latitude,
        longitude: dto.longitude,
        status: this.moderationEnabled
          ? ListingStatus.PENDING_REVIEW
          : ListingStatus.ACTIVE,
        publishedAt: this.moderationEnabled ? null : new Date(),
        ...(dto.expiresAt ? { expiresAt: new Date(dto.expiresAt) } : {}),
      },
      include: {
        seller: {
          select: {
            displayName: true,
            phone: true,
            email: true,
            isIdentityVerified: true,
          },
        },
        media: true,
      },
    });
  }

  /**
   * Owner-only listing edit. When moderation is enabled, an ACTIVE
   * listing that changes content re-enters PENDING_REVIEW.
   */
  async updateListing(listingId: string, sellerAccountId: string, dto: UpdateListingDto) {
    const listing = await this.getListingById(listingId);
    if (listing.sellerId !== sellerAccountId) {
      throw new ForbiddenException('You do not own this listing');
    }
    if ([ListingStatus.RENTED, ListingStatus.SOLD, ListingStatus.ARCHIVED].map(String).includes(String(listing.status))) {
      throw new BadRequestException(`Cannot edit a listing in ${listing.status} state`);
    }

    const data: Prisma.PropertyListingUpdateInput = {};
    const copy = (
      keys: Array<[keyof UpdateListingDto, string]>,
      transform?: (v: unknown) => unknown,
    ) => {
      for (const [key, field] of keys) {
        if ((dto as any)[key] !== undefined) {
          (data as any)[field] = transform ? transform((dto as any)[key]) : (dto as any)[key];
        }
      }
    };

    copy([
      ['title', 'title'],
      ['description', 'description'],
      ['priceNegotiable', 'priceNegotiable'],
      ['rentFrequency', 'rentFrequency'],
      ['bedrooms', 'bedrooms'],
      ['bathrooms', 'bathrooms'],
      ['floor', 'floor'],
      ['totalFloors', 'totalFloors'],
      ['areaSqFt', 'areaSqFt'],
      ['landSizeKatha', 'landSizeKatha'],
      ['parking', 'parking'],
      ['furnishing', 'furnishing'],
      ['amenities', 'amenities'],
      ['address', 'address'],
      ['area', 'area'],
      ['neighbourhood', 'neighbourhood'],
      ['district', 'district'],
      ['division', 'division'],
      ['postalCode', 'postalCode'],
      ['latitude', 'latitude'],
      ['longitude', 'longitude'],
    ]);
    if (dto.price !== undefined) data.price = dto.price;
    if (dto.availableFrom !== undefined) data.availableFrom = new Date(dto.availableFrom);

    const needsReview =
      this.moderationEnabled && listing.status === ListingStatus.ACTIVE;
    if (needsReview) {
      data.status = ListingStatus.PENDING_REVIEW;
      data.publishedAt = null;
    }

    return this.marketplacePrisma.propertyListing.update({
      where: { id: listingId },
      data,
    });
  }

  /**
   * Public detail with sale-document visibility enforcement (§13):
   *   PUBLIC           → everyone
   *   VERIFIED_USERS   → identity-verified viewers
   *   INTERESTED_BUYERS→ viewers who already inquired on this listing (+seller)
   *   PRIVATE          → seller only
   *   ADMIN_ONLY       → platform moderators only
   */
  async getListingById(
    id: string,
    viewer?: { accountId?: string; isAdmin?: boolean },
  ) {
    const listing = await this.marketplacePrisma.propertyListing.findUnique({
      where: { id },
      include: {
        seller: {
          select: {
            id: true,
            displayName: true,
            phone: true,
            email: true,
            accountType: true,
            isIdentityVerified: true,
            verificationBadge: true,
            avatarUrl: true,
          },
        },
        media: { orderBy: { order: 'asc' } },
        documents: true,
      },
    });

    if (!listing) {
      throw new NotFoundException('Property listing not found');
    }

    // Non-public listings stay hidden from the public detail route.
    const isSeller = !!viewer?.accountId && viewer.accountId === listing.sellerId;
    if (
      !viewer?.isAdmin &&
      !isSeller &&
      ![ListingStatus.ACTIVE, ListingStatus.RENTED, ListingStatus.SOLD]
        .map(String)
        .includes(String(listing.status))
    ) {
      throw new NotFoundException('Property listing not found');
    }

    let viewerIsVerified = false;
    let viewerHasInquired = false;
    if (viewer?.accountId && !isSeller) {
      const account = await this.marketplacePrisma.marketplaceAccount.findUnique({
        where: { id: viewer.accountId },
        select: { isIdentityVerified: true },
      });
      viewerIsVerified = !!account?.isIdentityVerified;

      const inquiry = await this.marketplacePrisma.inquiry.findFirst({
        where: { listingId: id, senderId: viewer.accountId },
        select: { id: true },
      });
      viewerHasInquired = !!inquiry;
    }

    const visibleDocuments = listing.documents.filter((doc) => {
      if (viewer?.isAdmin) return doc.visibility !== DocumentVisibility.PRIVATE || isSeller;
      if (isSeller) return true;
      switch (doc.visibility) {
        case DocumentVisibility.PUBLIC:
          return true;
        case DocumentVisibility.VERIFIED_USERS:
          return viewerIsVerified;
        case DocumentVisibility.INTERESTED_BUYERS:
          return viewerHasInquired;
        default:
          return false; // PRIVATE / ADMIN_ONLY
      }
    });

    return { ...listing, documents: visibleDocuments };
  }

  async addMedia(
    listingId: string,
    sellerAccountId: string,
    dto: AddListingMediaDto,
  ) {
    const listing = await this.getListingById(listingId);
    if (listing.sellerId !== sellerAccountId) {
      throw new ForbiddenException('You do not own this listing');
    }

    return this.marketplacePrisma.listingMedia.create({
      data: {
        listingId,
        url: dto.url,
        type: dto.type || 'IMAGE',
        order: dto.order || 0,
        isCover: dto.isCover ?? false,
        caption: dto.caption,
      },
    });
  }

  async addDocument(
    listingId: string,
    sellerAccountId: string,
    dto: AddListingDocumentDto,
  ) {
    const listing = await this.getListingById(listingId);
    if (listing.sellerId !== sellerAccountId) {
      throw new ForbiddenException('You do not own this listing');
    }

    return this.marketplacePrisma.listingDocument.create({
      data: {
        listingId,
        name: dto.name,
        fileUrl: dto.fileUrl,
        docType: dto.docType,
        visibility: dto.visibility || 'VERIFIED_USERS',
      },
    });
  }

  /**
   * Search public listings.
   *
   * Two execution paths:
   * - Geospatial filters (radius / bounds / nearest) → parameterized
   *   PostGIS raw SQL leveraging the GiST index.
   * - Plain filters → type-safe Prisma query.
   */
  async searchListings(dto: SearchListingsDto) {
    const hasGeo =
      (dto.lat !== undefined && dto.lng !== undefined) ||
      (dto.minLat !== undefined &&
        dto.maxLat !== undefined &&
        dto.minLng !== undefined &&
        dto.maxLng !== undefined);

    if (hasGeo || dto.sortBy === 'nearest') {
      return this.geoSearch(dto);
    }
    return this.plainSearch(dto);
  }

  private async plainSearch(dto: SearchListingsDto) {
    const page = dto.page || 1;
    const limit = Math.min(dto.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.PropertyListingWhereInput = {
      status: ListingStatus.ACTIVE,
    };

    if (dto.purpose) where.purpose = dto.purpose;
    if (dto.assetType) where.assetType = dto.assetType;
    if (dto.area) where.area = { contains: dto.area, mode: 'insensitive' };
    if (dto.district)
      where.district = { contains: dto.district, mode: 'insensitive' };
    if (dto.bedrooms) where.bedrooms = { gte: dto.bedrooms };

    if (dto.minPrice !== undefined || dto.maxPrice !== undefined) {
      where.price = {};
      if (dto.minPrice !== undefined) where.price.gte = dto.minPrice;
      if (dto.maxPrice !== undefined) where.price.lte = dto.maxPrice;
    }

    const orderBy: Prisma.PropertyListingOrderByWithRelationInput =
      dto.sortBy === 'price_asc'
        ? { price: 'asc' }
        : dto.sortBy === 'price_desc'
          ? { price: 'desc' }
          : { createdAt: 'desc' };

    const [items, total] = await Promise.all([
      this.marketplacePrisma.propertyListing.findMany({
        where,
        include: {
          seller: {
            select: {
              displayName: true,
              accountType: true,
              isIdentityVerified: true,
              verificationBadge: true,
            },
          },
          media: { where: { isCover: true }, take: 1 },
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.marketplacePrisma.propertyListing.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Compose the shared WHERE clause for geospatial queries.
   * All values are passed as bind parameters — no string interpolation.
   */
  private buildGeoWhere(
    filters: Pick<
      SearchListingsDto & MapSearchDto,
      'purpose' | 'assetType' | 'area' | 'district' | 'minPrice' | 'maxPrice'
    >,
  ): Prisma.Sql[] {
    const conditions: Prisma.Sql[] = [
      Prisma.sql`"status" = ${ListingStatus.ACTIVE}`,
      Prisma.sql`"location" IS NOT NULL`,
    ];

    if (filters.purpose)
      conditions.push(Prisma.sql`"purpose" = ${filters.purpose}`);
    if (filters.assetType)
      conditions.push(Prisma.sql`"assetType" = ${filters.assetType}`);
    if (filters.area)
      conditions.push(Prisma.sql`"area" ILIKE ${`%${filters.area}%`}`);
    if (filters.district)
      conditions.push(Prisma.sql`"district" ILIKE ${`%${filters.district}%`}`);
    if (filters.minPrice !== undefined)
      conditions.push(Prisma.sql`"price" >= ${filters.minPrice}`);
    if (filters.maxPrice !== undefined)
      conditions.push(Prisma.sql`"price" <= ${filters.maxPrice}`);

    return conditions;
  }

  private async geoSearch(dto: SearchListingsDto) {
    if (
      dto.sortBy === 'nearest' &&
      (dto.lat === undefined || dto.lng === undefined)
    ) {
      throw new BadRequestException('sortBy=nearest requires lat and lng');
    }
    if (
      (dto.lat !== undefined) !== (dto.lng !== undefined) ||
      (dto.radiusKm !== undefined &&
        (dto.lat === undefined || dto.lng === undefined))
    ) {
      throw new BadRequestException('Radius search requires both lat and lng');
    }
    if (dto.minLat !== undefined && dto.minLat >= (dto.maxLat ?? -Infinity)) {
      throw new BadRequestException('minLat must be less than maxLat');
    }

    const page = dto.page || 1;
    const limit = Math.min(dto.limit || 20, 100);
    const offset = (page - 1) * limit;

    const conditions = this.buildGeoWhere(dto);

    // Radius constraint (geography cast → true meter distance on spheroid)
    if (dto.lat !== undefined && dto.lng !== undefined && dto.radiusKm) {
      conditions.push(
        Prisma.sql`ST_DWithin(
          "location"::geography,
          ST_SetSRID(ST_MakePoint(${dto.lng}, ${dto.lat}), 4326)::geography,
          ${dto.radiusKm * 1000}
        )`,
      );
    }

    // Viewport bounds constraint (index-accelerated && operator)
    if (
      dto.minLat !== undefined &&
      dto.maxLat !== undefined &&
      dto.minLng !== undefined &&
      dto.maxLng !== undefined
    ) {
      conditions.push(
        Prisma.sql`"location" && ST_MakeEnvelope(${dto.minLng}, ${dto.minLat}, ${dto.maxLng}, ${dto.maxLat}, 4326)`,
      );
    }

    const whereSql = Prisma.join(conditions, ' AND ');

    const distanceSelect =
      dto.lat !== undefined && dto.lng !== undefined
        ? Prisma.sql`, ST_Distance(
            "location"::geography,
            ST_SetSRID(ST_MakePoint(${dto.lng}, ${dto.lat}), 4326)::geography
          ) / 1000 AS "distanceKm"`
        : Prisma.sql`, NULL::float AS "distanceKm"`;

    const orderBySql =
      dto.sortBy === 'nearest' && dto.lat !== undefined && dto.lng !== undefined
        ? Prisma.sql`ORDER BY "location" <-> ST_SetSRID(ST_MakePoint(${dto.lng}, ${dto.lat}), 4326)`
        : dto.sortBy === 'price_asc'
          ? Prisma.sql`ORDER BY "price" ASC`
          : dto.sortBy === 'price_desc'
            ? Prisma.sql`ORDER BY "price" DESC`
            : Prisma.sql`ORDER BY "createdAt" DESC`;

    const baseSelect = Prisma.sql`
      SELECT l."id", l."title", l."price", l."purpose", l."assetType",
             l."latitude", l."longitude", l."area", l."district",
             cover.url AS "coverImageUrl",
             a."isIdentityVerified", a."verificationBadge",
             a."displayName" AS "sellerDisplayName", a."accountType" AS "sellerAccountType",
             l."createdAt"${distanceSelect}
      FROM "PropertyListing" l
      LEFT JOIN "ListingMedia" cover ON cover."listingId" = l."id" AND cover."isCover" = true
      JOIN "MarketplaceAccount" a ON a."id" = l."sellerId"
      WHERE ${whereSql}
    `;

    const countResult = await this.marketplacePrisma.$queryRaw<
      [{ count: bigint }]
    >(
      Prisma.sql`SELECT COUNT(*)::bigint AS count FROM "PropertyListing" l WHERE ${whereSql}`,
    );
    const total = Number(countResult[0]?.count ?? 0);

    const rows = await this.marketplacePrisma.$queryRaw<GeoSearchRow[]>(
      Prisma.sql`${baseSelect} ${orderBySql} LIMIT ${limit} OFFSET ${offset}`,
    );

    return {
      items: rows.map((r) => this.mapGeoRow(r)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Lightweight marker contract for OpenStreetMap viewport rendering.
   * Returns only what a map pin needs — no heavy joins or documents.
   */
  async mapSearch(dto: MapSearchDto) {
    if (dto.minLat >= dto.maxLat || dto.minLng >= dto.maxLng) {
      throw new BadRequestException('Invalid map bounds');
    }

    const limit = Math.min(dto.limit || 500, 2000);
    const conditions = this.buildGeoWhere(dto);
    conditions.push(
      Prisma.sql`"location" && ST_MakeEnvelope(${dto.minLng}, ${dto.minLat}, ${dto.maxLng}, ${dto.maxLat}, 4326)`,
    );

    const rows = await this.marketplacePrisma.$queryRaw<
      Array<{
        id: string;
        title: string;
        price: number;
        purpose: string;
        latitude: number;
        longitude: number;
      }>
    >(Prisma.sql`
      SELECT l."id", l."title", l."price", l."purpose",
             l."latitude", l."longitude"
      FROM "PropertyListing" l
      WHERE ${Prisma.join(conditions, ' AND ')}
      ORDER BY l."createdAt" DESC
      LIMIT ${limit}
    `);

    return {
      markers: rows,
      meta: {
        count: rows.length,
        truncated: rows.length >= limit,
        bounds: {
          minLat: dto.minLat,
          maxLat: dto.maxLat,
          minLng: dto.minLng,
          maxLng: dto.maxLng,
        },
      },
    };
  }

  /** Normalize a raw geo row into the public listing-card contract. */
  private mapGeoRow(r: GeoSearchRow) {
    return {
      id: r.id,
      title: r.title,
      price: r.price,
      purpose: r.purpose,
      assetType: r.assetType,
      latitude: r.latitude,
      longitude: r.longitude,
      area: r.area,
      district: r.district,
      coverImageUrl: r.coverImageUrl,
      distanceKm: r.distanceKm !== null ? Number(r.distanceKm) : null,
      seller: {
        displayName: r.sellerDisplayName,
        accountType: r.sellerAccountType,
        isIdentityVerified: r.isIdentityVerified,
        verificationBadge: r.verificationBadge,
      },
      createdAt: r.createdAt,
    };
  }

  async updateStatus(
    listingId: string,
    sellerAccountId: string,
    status: ListingStatus,
  ) {
    const listing = await this.getListingById(listingId);
    if (listing.sellerId !== sellerAccountId) {
      throw new ForbiddenException('You do not own this listing');
    }

    return this.marketplacePrisma.propertyListing.update({
      where: { id: listingId },
      data: { status },
    });
  }
}
