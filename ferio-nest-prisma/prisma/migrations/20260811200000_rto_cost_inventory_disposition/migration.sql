CREATE TYPE "RtoCaseStatus" AS ENUM ('AWAITING_RECEIPT', 'INSPECTED');
CREATE TYPE "RtoReason" AS ENUM ('CUSTOMER_UNREACHABLE', 'CUSTOMER_REFUSED', 'ADDRESS_ISSUE', 'DELIVERY_ATTEMPTS_EXHAUSTED', 'COURIER_ISSUE', 'DAMAGED_IN_TRANSIT', 'OTHER');

CREATE TABLE "RtoCase" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "status" "RtoCaseStatus" NOT NULL DEFAULT 'AWAITING_RECEIPT',
    "reason" "RtoReason",
    "reasonNote" TEXT,
    "courierReason" TEXT,
    "outboundCourierCost" INTEGER NOT NULL DEFAULT 0,
    "returnCourierCost" INTEGER NOT NULL DEFAULT 0,
    "otherCost" INTEGER NOT NULL DEFAULT 0,
    "totalCost" INTEGER NOT NULL DEFAULT 0,
    "courierReturnedAt" TIMESTAMP(3) NOT NULL,
    "inspectedAt" TIMESTAMP(3),
    "inspectedByActorId" TEXT,
    "shipmentId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RtoCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RtoItem" (
    "id" TEXT NOT NULL,
    "expectedQuantity" INTEGER NOT NULL,
    "receivedQuantity" INTEGER,
    "sellableQuantity" INTEGER,
    "damagedQuantity" INTEGER,
    "lostQuantity" INTEGER,
    "note" TEXT,
    "rtoCaseId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RtoItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RtoCase_reference_key" ON "RtoCase"("reference");
CREATE UNIQUE INDEX "RtoCase_shipmentId_key" ON "RtoCase"("shipmentId");
CREATE INDEX "RtoCase_status_courierReturnedAt_idx" ON "RtoCase"("status", "courierReturnedAt");
CREATE INDEX "RtoCase_reason_createdAt_idx" ON "RtoCase"("reason", "createdAt");
CREATE INDEX "RtoCase_orderId_idx" ON "RtoCase"("orderId");
CREATE UNIQUE INDEX "RtoItem_reservationId_key" ON "RtoItem"("reservationId");
CREATE INDEX "RtoItem_rtoCaseId_idx" ON "RtoItem"("rtoCaseId");
CREATE INDEX "RtoItem_orderItemId_idx" ON "RtoItem"("orderItemId");

ALTER TABLE "RtoCase" ADD CONSTRAINT "RtoCase_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RtoCase" ADD CONSTRAINT "RtoCase_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RtoItem" ADD CONSTRAINT "RtoItem_rtoCaseId_fkey" FOREIGN KEY ("rtoCaseId") REFERENCES "RtoCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RtoItem" ADD CONSTRAINT "RtoItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RtoItem" ADD CONSTRAINT "RtoItem_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "InventoryReservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
