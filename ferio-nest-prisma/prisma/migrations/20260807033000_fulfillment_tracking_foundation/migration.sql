ALTER TYPE "OrderFulfillmentStatus" ADD VALUE IF NOT EXISTS 'PICKING';
ALTER TYPE "OrderFulfillmentStatus" ADD VALUE IF NOT EXISTS 'PACKED';
ALTER TYPE "OrderFulfillmentStatus" ADD VALUE IF NOT EXISTS 'QUALITY_CHECKED';
ALTER TYPE "OrderFulfillmentStatus" ADD VALUE IF NOT EXISTS 'READY_FOR_HANDOVER';
ALTER TYPE "OrderFulfillmentStatus" ADD VALUE IF NOT EXISTS 'HANDED_OVER';

CREATE TYPE "FulfillmentExceptionType" AS ENUM ('SHORTAGE', 'SUBSTITUTION', 'OTHER');
CREATE TYPE "FulfillmentExceptionStatus" AS ENUM ('OPEN', 'RESOLVED');

CREATE TABLE "FulfillmentHistory" (
  "id" TEXT NOT NULL,
  "oldStatus" "OrderFulfillmentStatus",
  "newStatus" "OrderFulfillmentStatus" NOT NULL,
  "source" "OrderHistorySource" NOT NULL,
  "actorId" TEXT,
  "note" TEXT,
  "orderId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FulfillmentHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FulfillmentException" (
  "id" TEXT NOT NULL,
  "type" "FulfillmentExceptionType" NOT NULL,
  "status" "FulfillmentExceptionStatus" NOT NULL DEFAULT 'OPEN',
  "quantity" INTEGER,
  "description" TEXT NOT NULL,
  "resolution" TEXT,
  "actorId" TEXT NOT NULL,
  "resolvedByActorId" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "orderId" TEXT NOT NULL,
  "orderItemId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FulfillmentException_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FulfillmentHistory_orderId_createdAt_idx" ON "FulfillmentHistory"("orderId", "createdAt");
CREATE INDEX "FulfillmentHistory_actorId_createdAt_idx" ON "FulfillmentHistory"("actorId", "createdAt");
CREATE INDEX "FulfillmentException_orderId_status_createdAt_idx" ON "FulfillmentException"("orderId", "status", "createdAt");
CREATE INDEX "FulfillmentException_orderItemId_idx" ON "FulfillmentException"("orderItemId");
CREATE INDEX "FulfillmentException_actorId_createdAt_idx" ON "FulfillmentException"("actorId", "createdAt");

ALTER TABLE "FulfillmentHistory" ADD CONSTRAINT "FulfillmentHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FulfillmentException" ADD CONSTRAINT "FulfillmentException_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FulfillmentException" ADD CONSTRAINT "FulfillmentException_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
