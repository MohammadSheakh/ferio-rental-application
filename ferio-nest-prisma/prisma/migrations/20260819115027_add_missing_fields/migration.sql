-- CreateEnum
CREATE TYPE "ProductRequestStatus" AS ENUM ('PENDING', 'COLLECTED', 'CONTACTED', 'DONE');

-- CreateEnum
CREATE TYPE "DeliveryMethod" AS ENUM ('HOME_DELIVERY', 'STORE_PICKUP');

-- CreateEnum
CREATE TYPE "StorePickupStatus" AS ENUM ('NOT_APPLICABLE', 'CHECKING_AVAILABILITY', 'AVAILABLE_IN_STORE', 'TRANSFER_REQUIRED', 'IN_TRANSFER', 'READY_FOR_PICKUP', 'SCHEDULED_BY_CUSTOMER', 'COMPLETED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "CheckoutPaymentMethod" ADD VALUE 'PAY_AT_STORE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ReconciliationFindingType" ADD VALUE 'PREPAID_PAYMENT_STATE_MISMATCH';
ALTER TYPE "ReconciliationFindingType" ADD VALUE 'PREPAID_UNVERIFIED_PAID_ORDER';
ALTER TYPE "ReconciliationFindingType" ADD VALUE 'PREPAID_AMOUNT_MISMATCH';

-- AlterEnum
ALTER TYPE "SettingsType" ADD VALUE 'heroShowcase';

-- DropIndex
DROP INDEX "Warehouse_isActive_name_idx";

-- AlterTable
ALTER TABLE "CheckoutDraft" ADD COLUMN     "deliveryMethod" "DeliveryMethod" NOT NULL DEFAULT 'HOME_DELIVERY',
ADD COLUMN     "pickupStoreId" TEXT,
ADD COLUMN     "preferredPickupDate" TIMESTAMP(3),
ADD COLUMN     "preferredPickupSlot" TEXT,
ADD COLUMN     "storePickupStatus" "StorePickupStatus" NOT NULL DEFAULT 'NOT_APPLICABLE';

-- AlterTable
ALTER TABLE "CommerceSettings" ADD COLUMN     "categorySideNavEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "categoryTopNavEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "customerPickupNotes" TEXT,
ADD COLUMN     "deliveryMethod" "DeliveryMethod" NOT NULL DEFAULT 'HOME_DELIVERY',
ADD COLUMN     "pickupScheduledAt" TIMESTAMP(3),
ADD COLUMN     "pickupStoreId" TEXT,
ADD COLUMN     "preferredPickupDate" TIMESTAMP(3),
ADD COLUMN     "preferredPickupSlot" TEXT,
ADD COLUMN     "storePickupOtp" TEXT,
ADD COLUMN     "storePickupStatus" "StorePickupStatus" NOT NULL DEFAULT 'NOT_APPLICABLE';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "brandId" TEXT;

-- AlterTable
ALTER TABLE "Warehouse" ADD COLUMN     "address" TEXT,
ADD COLUMN     "area" TEXT,
ADD COLUMN     "district" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "isStore" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "operatingDays" TEXT,
ADD COLUMN     "operatingHours" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "pickupInstructions" TEXT;

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductRequest" (
    "id" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "status" "ProductRequestStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Brand_name_key" ON "Brand"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_slug_key" ON "Brand"("slug");

-- CreateIndex
CREATE INDEX "Brand_isActive_name_idx" ON "Brand"("isActive", "name");

-- CreateIndex
CREATE INDEX "ProductRequest_status_createdAt_idx" ON "ProductRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ProductRequest_userId_createdAt_idx" ON "ProductRequest"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CheckoutDraft_pickupStoreId_idx" ON "CheckoutDraft"("pickupStoreId");

-- CreateIndex
CREATE INDEX "Order_pickupStoreId_idx" ON "Order"("pickupStoreId");

-- CreateIndex
CREATE INDEX "Order_deliveryMethod_storePickupStatus_idx" ON "Order"("deliveryMethod", "storePickupStatus");

-- CreateIndex
CREATE INDEX "Product_brandId_idx" ON "Product"("brandId");

-- CreateIndex
CREATE INDEX "Warehouse_isActive_isStore_name_idx" ON "Warehouse"("isActive", "isStore", "name");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRequest" ADD CONSTRAINT "ProductRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutDraft" ADD CONSTRAINT "CheckoutDraft_pickupStoreId_fkey" FOREIGN KEY ("pickupStoreId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_pickupStoreId_fkey" FOREIGN KEY ("pickupStoreId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
