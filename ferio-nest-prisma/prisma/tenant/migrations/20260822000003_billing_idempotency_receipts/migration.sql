-- ──────────────────────────────────────────────────────────────
-- Tenant schema — 0003: Billing idempotency + payment receipts
-- (§Week 15 / §Week 19 hardening)
-- ──────────────────────────────────────────────────────────────

-- Idempotent monthly invoice generation
ALTER TABLE "Invoice" ADD COLUMN "periodKey" TEXT;

-- Backfill from existing periods so the unique index can be applied.
UPDATE "Invoice"
SET "periodKey" = TO_CHAR("periodStart", 'YYYY-MM')
WHERE "periodKey" IS NULL;

CREATE UNIQUE INDEX "Invoice_billingAccountId_periodKey_key"
  ON "Invoice"("billingAccountId", "periodKey");

-- Payment verification receipts + reversal tracking
ALTER TABLE "Payment" ADD COLUMN "receiptNumber" TEXT;
ALTER TABLE "Payment" ADD COLUMN "rejectionReason" TEXT;
ALTER TABLE "Payment" ADD COLUMN "reversedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Payment_receiptNumber_key" ON "Payment"("receiptNumber");
