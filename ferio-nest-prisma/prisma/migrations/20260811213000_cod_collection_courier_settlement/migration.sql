CREATE TYPE "CodCollectionStatus" AS ENUM ('EXPECTED', 'SETTLED', 'VARIANCE', 'DISPUTED');
CREATE TYPE "CourierSettlementStatus" AS ENUM ('MATCHED', 'VARIANCE', 'DISPUTED');
CREATE TYPE "CourierSettlementItemStatus" AS ENUM ('MATCHED', 'VARIANCE', 'DISPUTED');

CREATE TABLE "CodCollection" (
    "id" TEXT NOT NULL,
    "status" "CodCollectionStatus" NOT NULL DEFAULT 'EXPECTED',
    "currency" TEXT NOT NULL DEFAULT 'BDT',
    "expectedAmount" INTEGER NOT NULL,
    "collectedAmount" INTEGER,
    "collectionVariance" INTEGER,
    "expectedAt" TIMESTAMP(3) NOT NULL,
    "settledAt" TIMESTAMP(3),
    "shipmentId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CodCollection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourierSettlement" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "idempotencyKeyHash" TEXT NOT NULL,
    "providerSettlementReference" TEXT NOT NULL,
    "bankReference" TEXT NOT NULL,
    "status" "CourierSettlementStatus" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BDT',
    "grossCollected" INTEGER NOT NULL,
    "courierFees" INTEGER NOT NULL,
    "otherDeductions" INTEGER NOT NULL,
    "expectedRemittance" INTEGER NOT NULL,
    "remittedAmount" INTEGER NOT NULL,
    "variance" INTEGER NOT NULL,
    "settledAt" TIMESTAMP(3) NOT NULL,
    "recordedByActorId" TEXT NOT NULL,
    "note" TEXT,
    "providerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CourierSettlement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourierSettlementItem" (
    "id" TEXT NOT NULL,
    "status" "CourierSettlementItemStatus" NOT NULL,
    "expectedCodAmount" INTEGER NOT NULL,
    "collectedAmount" INTEGER NOT NULL,
    "courierFee" INTEGER NOT NULL,
    "otherDeduction" INTEGER NOT NULL,
    "expectedRemittance" INTEGER NOT NULL,
    "collectionVariance" INTEGER NOT NULL,
    "note" TEXT,
    "settlementId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "codCollectionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourierSettlementItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CodCollection_shipmentId_key" ON "CodCollection"("shipmentId");
CREATE UNIQUE INDEX "CodCollection_orderId_key" ON "CodCollection"("orderId");
CREATE INDEX "CodCollection_status_expectedAt_idx" ON "CodCollection"("status", "expectedAt");
CREATE INDEX "CodCollection_settledAt_idx" ON "CodCollection"("settledAt");
CREATE UNIQUE INDEX "CourierSettlement_reference_key" ON "CourierSettlement"("reference");
CREATE UNIQUE INDEX "CourierSettlement_idempotencyKeyHash_key" ON "CourierSettlement"("idempotencyKeyHash");
CREATE UNIQUE INDEX "CourierSettlement_providerId_providerSettlementReference_key" ON "CourierSettlement"("providerId", "providerSettlementReference");
CREATE INDEX "CourierSettlement_status_settledAt_idx" ON "CourierSettlement"("status", "settledAt");
CREATE INDEX "CourierSettlement_providerId_settledAt_idx" ON "CourierSettlement"("providerId", "settledAt");
CREATE INDEX "CourierSettlement_bankReference_idx" ON "CourierSettlement"("bankReference");
CREATE UNIQUE INDEX "CourierSettlementItem_shipmentId_key" ON "CourierSettlementItem"("shipmentId");
CREATE UNIQUE INDEX "CourierSettlementItem_codCollectionId_key" ON "CourierSettlementItem"("codCollectionId");
CREATE INDEX "CourierSettlementItem_settlementId_idx" ON "CourierSettlementItem"("settlementId");
CREATE INDEX "CourierSettlementItem_status_createdAt_idx" ON "CourierSettlementItem"("status", "createdAt");

ALTER TABLE "CodCollection" ADD CONSTRAINT "CodCollection_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CodCollection" ADD CONSTRAINT "CodCollection_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CourierSettlement" ADD CONSTRAINT "CourierSettlement_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ShipmentProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CourierSettlementItem" ADD CONSTRAINT "CourierSettlementItem_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "CourierSettlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CourierSettlementItem" ADD CONSTRAINT "CourierSettlementItem_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CourierSettlementItem" ADD CONSTRAINT "CourierSettlementItem_codCollectionId_fkey" FOREIGN KEY ("codCollectionId") REFERENCES "CodCollection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
