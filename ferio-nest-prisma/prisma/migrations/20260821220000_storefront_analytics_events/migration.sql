CREATE TYPE "StorefrontAnalyticsEventType" AS ENUM ('PRODUCT_VIEW', 'SEARCH', 'FILTER', 'ADD_TO_CART');

CREATE TABLE "StorefrontAnalyticsEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" "StorefrontAnalyticsEventType" NOT NULL,
    "eventVersion" INTEGER NOT NULL DEFAULT 1,
    "source" TEXT NOT NULL DEFAULT 'CUSTOMER_WEB',
    "visitorHash" TEXT NOT NULL,
    "productId" TEXT,
    "variantId" TEXT,
    "searchTerm" TEXT,
    "filters" JSONB,
    "quantity" INTEGER,
    "path" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorefrontAnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StorefrontAnalyticsEvent_eventId_key" ON "StorefrontAnalyticsEvent"("eventId");
CREATE INDEX "StorefrontAnalyticsEvent_type_createdAt_idx" ON "StorefrontAnalyticsEvent"("type", "createdAt");
CREATE INDEX "StorefrontAnalyticsEvent_productId_type_createdAt_idx" ON "StorefrontAnalyticsEvent"("productId", "type", "createdAt");
CREATE INDEX "StorefrontAnalyticsEvent_visitorHash_createdAt_idx" ON "StorefrontAnalyticsEvent"("visitorHash", "createdAt");
