CREATE TYPE "CourierSettlementImportSource" AS ENUM ('API', 'CSV', 'MANUAL_JSON');
CREATE TYPE "CourierSettlementImportStatus" AS ENUM ('APPLIED', 'NEEDS_REVIEW');
CREATE TYPE "CourierSettlementImportRowStatus" AS ENUM ('APPLIED', 'UNMATCHED', 'INELIGIBLE', 'ALREADY_SETTLED', 'DUPLICATE');

CREATE TABLE "CourierSettlementImport" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "idempotencyKeyHash" TEXT NOT NULL,
    "providerReportReference" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "source" "CourierSettlementImportSource" NOT NULL,
    "status" "CourierSettlementImportStatus" NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "appliedCount" INTEGER NOT NULL,
    "exceptionCount" INTEGER NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "recordedByActorId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "settlementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourierSettlementImport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourierSettlementImportRow" (
    "id" TEXT NOT NULL,
    "providerRowReference" TEXT NOT NULL,
    "deduplicationKey" TEXT,
    "rowHash" TEXT NOT NULL,
    "trackingNumber" TEXT NOT NULL,
    "status" "CourierSettlementImportRowStatus" NOT NULL,
    "reason" TEXT,
    "collectedAmount" INTEGER NOT NULL,
    "courierFee" INTEGER NOT NULL,
    "otherDeduction" INTEGER NOT NULL,
    "matchedShipmentId" TEXT,
    "matchedCollectionId" TEXT,
    "duplicateOfRowId" TEXT,
    "rawPayload" JSONB NOT NULL,
    "importId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourierSettlementImportRow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CourierSettlementImport_reference_key" ON "CourierSettlementImport"("reference");
CREATE UNIQUE INDEX "CourierSettlementImport_idempotencyKeyHash_key" ON "CourierSettlementImport"("idempotencyKeyHash");
CREATE UNIQUE INDEX "CourierSettlementImport_settlementId_key" ON "CourierSettlementImport"("settlementId");
CREATE UNIQUE INDEX "CourierSettlementImport_providerId_providerReportReference_key" ON "CourierSettlementImport"("providerId", "providerReportReference");
CREATE UNIQUE INDEX "CourierSettlementImport_providerId_sourceHash_key" ON "CourierSettlementImport"("providerId", "sourceHash");
CREATE INDEX "CourierSettlementImport_status_createdAt_idx" ON "CourierSettlementImport"("status", "createdAt");
CREATE INDEX "CourierSettlementImport_providerId_createdAt_idx" ON "CourierSettlementImport"("providerId", "createdAt");
CREATE UNIQUE INDEX "CourierSettlementImportRow_deduplicationKey_key" ON "CourierSettlementImportRow"("deduplicationKey");
CREATE UNIQUE INDEX "CourierSettlementImportRow_importId_providerRowReference_key" ON "CourierSettlementImportRow"("importId", "providerRowReference");
CREATE INDEX "CourierSettlementImportRow_status_createdAt_idx" ON "CourierSettlementImportRow"("status", "createdAt");
CREATE INDEX "CourierSettlementImportRow_trackingNumber_idx" ON "CourierSettlementImportRow"("trackingNumber");
CREATE INDEX "CourierSettlementImportRow_matchedShipmentId_idx" ON "CourierSettlementImportRow"("matchedShipmentId");

ALTER TABLE "CourierSettlementImport" ADD CONSTRAINT "CourierSettlementImport_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ShipmentProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CourierSettlementImport" ADD CONSTRAINT "CourierSettlementImport_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "CourierSettlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CourierSettlementImportRow" ADD CONSTRAINT "CourierSettlementImportRow_importId_fkey" FOREIGN KEY ("importId") REFERENCES "CourierSettlementImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
