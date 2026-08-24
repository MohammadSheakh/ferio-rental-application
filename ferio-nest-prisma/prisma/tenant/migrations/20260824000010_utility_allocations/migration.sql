-- ──────────────────────────────────────────────────────────────
-- Tenant schema — 0010: Utility allocation math (§ Weeks 17–18)
-- ──────────────────────────────────────────────────────────────

-- Building-scope utility accounts need a property anchor so shared
-- bills can be allocated across all units of that property.
ALTER TABLE "UtilityAccount" ADD COLUMN "propertyId" TEXT;
CREATE INDEX "UtilityAccount_propertyId_idx" ON "UtilityAccount"("propertyId");
ALTER TABLE "UtilityAccount" ADD CONSTRAINT "UtilityAccount_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Per-unit shares computed by the allocation engine (exact rounding:
-- Σ amounts == bill totalAmount always).
CREATE TABLE "UtilityAllocation" (
    "id" TEXT NOT NULL,
    "utilityBillId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "amountBdt" DOUBLE PRECISION NOT NULL,
    "basis" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UtilityAllocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UtilityAllocation_bill_unit_key"
  ON "UtilityAllocation"("utilityBillId", "unitId");
CREATE INDEX "UtilityAllocation_utilityBillId_idx" ON "UtilityAllocation"("utilityBillId");

ALTER TABLE "UtilityAllocation" ADD CONSTRAINT "UtilityAllocation_utilityBillId_fkey"
  FOREIGN KEY ("utilityBillId") REFERENCES "UtilityBill"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UtilityAllocation" ADD CONSTRAINT "UtilityAllocation_unitId_fkey"
  FOREIGN KEY ("unitId") REFERENCES "Unit"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Duplicate-prevention guard for meter readings: one reading per meter
-- per calendar day-of-entry is allowed; repeated same-period entries
-- are rejected at service level using this index for fast lookups.
CREATE INDEX "MeterReading_meter_readingDate_idx" ON "MeterReading"("meterId", "readingDate");
