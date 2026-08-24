-- ──────────────────────────────────────────────────────────────
-- FERIO MARKETPLACE — 003: Paid promotions (§23) + room-by-room
-- detail (§24)
-- ──────────────────────────────────────────────────────────────

-- §23 Paid Listing Promotions (Advertiser → Ferio ledger)
CREATE TYPE "PromotionType" AS ENUM ('FEATURED', 'URGENT', 'TOP_SEARCH');
CREATE TYPE "PromotionStatus" AS ENUM ('PENDING_PAYMENT', 'ACTIVE', 'EXPIRED', 'CANCELLED');

ALTER TABLE "PropertyListing" ADD COLUMN "promotionTier" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PropertyListing" ADD COLUMN "promotionBadges" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "PropertyListing" ADD COLUMN "promotedUntil" TIMESTAMP(3);
CREATE INDEX "PropertyListing_promotionTier_idx" ON "PropertyListing"("promotionTier");

CREATE TABLE "ListingPromotion" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "type" "PromotionType" NOT NULL,
    "status" "PromotionStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "amountBdt" DOUBLE PRECISION NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "paidVia" TEXT,
    "paymentReference" TEXT,
    "paidAt" TIMESTAMP(3),
    "decidedBy" TEXT,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingPromotion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ListingPromotion_listingId_idx" ON "ListingPromotion"("listingId");
CREATE INDEX "ListingPromotion_status_idx" ON "ListingPromotion"("status");
CREATE INDEX "ListingPromotion_expiresAt_idx" ON "ListingPromotion"("expiresAt");

ALTER TABLE "ListingPromotion" ADD CONSTRAINT "ListingPromotion_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "PropertyListing"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- §24 Room-by-room listing detail
CREATE TYPE "RoomType" AS ENUM (
  'BEDROOM', 'MASTER_BEDROOM', 'BATHROOM', 'KITCHEN', 'LIVING_ROOM',
  'DINING_ROOM', 'BALCONY', 'SERVANT_ROOM', 'STORAGE', 'GARAGE', 'OTHER'
);

CREATE TABLE "ListingRoom" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "RoomType" NOT NULL DEFAULT 'OTHER',
    "lengthFt" DOUBLE PRECISION,
    "widthFt" DOUBLE PRECISION,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingRoom_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ListingRoom_listingId_idx" ON "ListingRoom"("listingId");

ALTER TABLE "ListingRoom" ADD CONSTRAINT "ListingRoom_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "PropertyListing"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ListingRoomMedia" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingRoomMedia_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ListingRoomMedia_roomId_idx" ON "ListingRoomMedia"("roomId");

ALTER TABLE "ListingRoomMedia" ADD CONSTRAINT "ListingRoomMedia_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "ListingRoom"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
