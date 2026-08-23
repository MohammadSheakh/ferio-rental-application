ALTER TYPE "OrderShipmentStatus" ADD VALUE IF NOT EXISTS 'CREATED';
ALTER TYPE "OrderShipmentStatus" ADD VALUE IF NOT EXISTS 'PICKED_UP';
ALTER TYPE "OrderShipmentStatus" ADD VALUE IF NOT EXISTS 'AT_HUB';
ALTER TYPE "OrderShipmentStatus" ADD VALUE IF NOT EXISTS 'OUT_FOR_DELIVERY';
ALTER TYPE "OrderShipmentStatus" ADD VALUE IF NOT EXISTS 'DELIVERY_FAILED';
ALTER TYPE "OrderShipmentStatus" ADD VALUE IF NOT EXISTS 'RETURN_IN_PROGRESS';
ALTER TYPE "OrderShipmentStatus" ADD VALUE IF NOT EXISTS 'RETURNED';
ALTER TYPE "OrderShipmentStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "OrderShipmentStatus" ADD VALUE IF NOT EXISTS 'UNKNOWN';

CREATE TYPE "ShipmentProviderCode" AS ENUM ('PATHAO', 'STEADFAST', 'REDX', 'ECOURIER', 'PAPERFLY', 'CARRYBEE');

ALTER TABLE "OrderItem" ADD COLUMN "weightGrams" INTEGER NOT NULL DEFAULT 500;
ALTER TABLE "OrderItem" ALTER COLUMN "weightGrams" DROP DEFAULT;

CREATE TABLE "ShipmentProvider" (
    "id" TEXT NOT NULL,
    "code" "ShipmentProviderCode" NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShipmentProvider_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "status" "OrderShipmentStatus" NOT NULL DEFAULT 'READY',
    "externalShipmentId" TEXT,
    "trackingNumber" TEXT,
    "trackingUrl" TEXT,
    "labelUrl" TEXT,
    "weightGrams" INTEGER NOT NULL,
    "codAmount" INTEGER NOT NULL,
    "shippingCharge" INTEGER,
    "requestPayload" JSONB NOT NULL,
    "responsePayload" JSONB,
    "lastRawStatus" TEXT,
    "exceptionReason" TEXT,
    "createdByActorId" TEXT NOT NULL,
    "pickedUpAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "orderId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShipmentEvent" (
    "id" TEXT NOT NULL,
    "deduplicationKey" TEXT NOT NULL,
    "providerEventId" TEXT,
    "rawStatus" TEXT NOT NULL,
    "normalizedStatus" "OrderShipmentStatus" NOT NULL,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "isOutOfOrder" BOOLEAN NOT NULL DEFAULT false,
    "ignoredReason" TEXT,
    "shipmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShipmentEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShipmentWebhookLog" (
    "id" TEXT NOT NULL,
    "providerCode" "ShipmentProviderCode" NOT NULL,
    "deduplicationKey" TEXT NOT NULL,
    "headers" JSONB NOT NULL,
    "body" JSONB NOT NULL,
    "authValid" BOOLEAN NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processingError" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    CONSTRAINT "ShipmentWebhookLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShipmentProvider_code_key" ON "ShipmentProvider"("code");
CREATE INDEX "ShipmentProvider_isActive_name_idx" ON "ShipmentProvider"("isActive", "name");
CREATE UNIQUE INDEX "Shipment_orderId_key" ON "Shipment"("orderId");
CREATE INDEX "Shipment_providerId_status_createdAt_idx" ON "Shipment"("providerId", "status", "createdAt");
CREATE INDEX "Shipment_trackingNumber_idx" ON "Shipment"("trackingNumber");
CREATE INDEX "Shipment_externalShipmentId_idx" ON "Shipment"("externalShipmentId");
CREATE UNIQUE INDEX "ShipmentEvent_deduplicationKey_key" ON "ShipmentEvent"("deduplicationKey");
CREATE INDEX "ShipmentEvent_shipmentId_occurredAt_idx" ON "ShipmentEvent"("shipmentId", "occurredAt");
CREATE INDEX "ShipmentEvent_normalizedStatus_occurredAt_idx" ON "ShipmentEvent"("normalizedStatus", "occurredAt");
CREATE UNIQUE INDEX "ShipmentWebhookLog_deduplicationKey_key" ON "ShipmentWebhookLog"("deduplicationKey");
CREATE INDEX "ShipmentWebhookLog_providerCode_receivedAt_idx" ON "ShipmentWebhookLog"("providerCode", "receivedAt");
CREATE INDEX "ShipmentWebhookLog_processed_receivedAt_idx" ON "ShipmentWebhookLog"("processed", "receivedAt");

ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ShipmentProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShipmentEvent" ADD CONSTRAINT "ShipmentEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
