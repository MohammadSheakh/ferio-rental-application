ALTER TYPE "ReturnCaseStatus" ADD VALUE IF NOT EXISTS 'INSPECTED';

CREATE TYPE "ReturnItemCondition" AS ENUM ('SEALED', 'UNUSED', 'OPENED', 'USED', 'DAMAGED', 'WRONG_ITEM', 'OTHER');
CREATE TYPE "ReturnInventoryDisposition" AS ENUM ('SELLABLE', 'DAMAGED', 'QUARANTINED', 'LOST');
CREATE TYPE "ReturnInspectionDecision" AS ENUM ('ACCEPT', 'PARTIAL_ACCEPT', 'REJECT');
CREATE TYPE "ReturnFinalResolution" AS ENUM ('REFUND', 'REPLACEMENT', 'EXCHANGE', 'REJECTED', 'OTHER');

ALTER TABLE "ReturnCase"
  ADD COLUMN "inspectionDecision" "ReturnInspectionDecision",
  ADD COLUMN "finalResolution" "ReturnFinalResolution",
  ADD COLUMN "inspectionNote" TEXT,
  ADD COLUMN "inspectedByActorId" TEXT,
  ADD COLUMN "receivedAt" TIMESTAMP(3),
  ADD COLUMN "inspectedAt" TIMESTAMP(3);

ALTER TABLE "ReturnItem"
  ADD COLUMN "receivedQuantity" INTEGER,
  ADD COLUMN "acceptedQuantity" INTEGER,
  ADD COLUMN "condition" "ReturnItemCondition",
  ADD COLUMN "inventoryDisposition" "ReturnInventoryDisposition",
  ADD COLUMN "inspectionNote" TEXT;

CREATE INDEX "ReturnCase_inspectedByActorId_inspectedAt_idx" ON "ReturnCase"("inspectedByActorId", "inspectedAt");
