ALTER TYPE "CourierSettlementImportStatus" ADD VALUE 'SUPERSEDED';

ALTER TABLE "CourierSettlementImport"
ADD COLUMN "supersedesImportId" TEXT,
ADD COLUMN "resolvedAt" TIMESTAMP(3),
ADD COLUMN "correctionClaimHash" TEXT,
ADD COLUMN "correctionClaimedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "CourierSettlementImport_supersedesImportId_key" ON "CourierSettlementImport"("supersedesImportId");

ALTER TABLE "CourierSettlementImport" ADD CONSTRAINT "CourierSettlementImport_supersedesImportId_fkey" FOREIGN KEY ("supersedesImportId") REFERENCES "CourierSettlementImport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
