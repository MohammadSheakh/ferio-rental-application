ALTER TABLE "CommerceSettings"
ADD COLUMN "purchaseActivityEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "purchaseHistoryEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "purchaseActivityShowDistrict" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "purchaseActivityShowArea" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "purchaseActivityDurationMs" INTEGER NOT NULL DEFAULT 4000,
ADD COLUMN "purchaseActivityIntervalSeconds" INTEGER NOT NULL DEFAULT 12,
ADD COLUMN "purchaseActivityMaxAgeDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN "purchaseActivityExcludedProductIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "CheckoutDraft"
ADD COLUMN "purchaseActivityConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "purchaseActivityConsentAt" TIMESTAMP(3);

ALTER TABLE "Order"
ADD COLUMN "purchaseActivityConsent" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Order_purchaseActivityConsent_status_createdAt_idx"
ON "Order"("purchaseActivityConsent", "status", "createdAt");
