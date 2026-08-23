-- CreateEnum
CREATE TYPE "CheckoutPaymentMethod" AS ENUM ('COD');

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phoneOriginal" TEXT NOT NULL,
    "phoneNormalized" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerAddress" (
    "id" TEXT NOT NULL,
    "label" TEXT,
    "recipientName" TEXT NOT NULL,
    "phoneOriginal" TEXT NOT NULL,
    "phoneNormalized" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "detailedAddress" TEXT NOT NULL,
    "landmark" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "customerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeliveryZone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deliveryFee" INTEGER NOT NULL,
    "freeDeliveryThreshold" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DeliveryZone_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeliveryZoneDistrict" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DeliveryZoneDistrict_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CheckoutDraft" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phoneOriginal" TEXT NOT NULL,
    "phoneNormalized" TEXT NOT NULL,
    "email" TEXT,
    "district" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "detailedAddress" TEXT NOT NULL,
    "landmark" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "marketingConsentAt" TIMESTAMP(3),
    "termsAccepted" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT,
    "medium" TEXT,
    "campaign" TEXT,
    "paymentMethod" "CheckoutPaymentMethod" NOT NULL DEFAULT 'COD',
    "subtotal" INTEGER NOT NULL,
    "discountTotal" INTEGER NOT NULL DEFAULT 0,
    "deliveryFee" INTEGER NOT NULL,
    "paymentCharge" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "cartId" TEXT NOT NULL,
    "deliveryZoneId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CheckoutDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Customer_phoneNormalized_idx" ON "Customer"("phoneNormalized");
CREATE INDEX "Customer_email_idx" ON "Customer"("email");
CREATE INDEX "CustomerAddress_customerId_isDefault_idx" ON "CustomerAddress"("customerId", "isDefault");
CREATE INDEX "CustomerAddress_district_area_idx" ON "CustomerAddress"("district", "area");
CREATE INDEX "DeliveryZone_isActive_sortOrder_name_idx" ON "DeliveryZone"("isActive", "sortOrder", "name");
CREATE UNIQUE INDEX "DeliveryZoneDistrict_normalizedName_key" ON "DeliveryZoneDistrict"("normalizedName");
CREATE INDEX "DeliveryZoneDistrict_zoneId_name_idx" ON "DeliveryZoneDistrict"("zoneId", "name");
CREATE UNIQUE INDEX "CheckoutDraft_cartId_key" ON "CheckoutDraft"("cartId");
CREATE INDEX "CheckoutDraft_phoneNormalized_updatedAt_idx" ON "CheckoutDraft"("phoneNormalized", "updatedAt");
CREATE INDEX "CheckoutDraft_expiresAt_idx" ON "CheckoutDraft"("expiresAt");
CREATE INDEX "CheckoutDraft_deliveryZoneId_idx" ON "CheckoutDraft"("deliveryZoneId");

-- AddForeignKey
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryZoneDistrict" ADD CONSTRAINT "DeliveryZoneDistrict_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "DeliveryZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CheckoutDraft" ADD CONSTRAINT "CheckoutDraft_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CheckoutDraft" ADD CONSTRAINT "CheckoutDraft_deliveryZoneId_fkey" FOREIGN KEY ("deliveryZoneId") REFERENCES "DeliveryZone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
