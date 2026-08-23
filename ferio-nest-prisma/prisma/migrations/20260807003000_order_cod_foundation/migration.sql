-- CreateEnums
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_CONFIRMATION', 'CONFIRMED', 'CANCELLED', 'DELIVERED', 'COMPLETED');
CREATE TYPE "OrderPaymentStatus" AS ENUM ('UNPAID', 'PAID', 'FAILED', 'PARTIALLY_REFUNDED', 'REFUNDED');
CREATE TYPE "OrderFulfillmentStatus" AS ENUM ('UNFULFILLED', 'READY_FOR_FULFILLMENT', 'CANCELLED', 'FULFILLED');
CREATE TYPE "OrderShipmentStatus" AS ENUM ('NOT_CREATED', 'READY', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'RTO');
CREATE TYPE "OrderReturnStatus" AS ENUM ('NONE', 'REQUESTED', 'APPROVED', 'REJECTED', 'RECEIVED');
CREATE TYPE "OrderRefundStatus" AS ENUM ('NONE', 'PENDING', 'PARTIAL', 'REFUNDED', 'FAILED');
CREATE TYPE "CodVerificationStatus" AS ENUM ('REQUIRED', 'NOT_REQUIRED', 'VERIFIED', 'FAILED');
CREATE TYPE "OrderHistorySource" AS ENUM ('CUSTOMER', 'ADMIN', 'SYSTEM');
CREATE TYPE "InventoryReservationStatus" AS ENUM ('ACTIVE', 'RELEASED', 'CONSUMED', 'EXPIRED');
CREATE TYPE "CodVerificationMode" AS ENUM ('ALWAYS', 'ABOVE_AMOUNT', 'NEVER');

-- CreateTables
CREATE TABLE "CodVerificationPolicy" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "mode" "CodVerificationMode" NOT NULL DEFAULT 'ALWAYS',
    "amountThreshold" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CodVerificationPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "idempotencyKeyHash" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "paymentStatus" "OrderPaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "fulfillmentStatus" "OrderFulfillmentStatus" NOT NULL DEFAULT 'UNFULFILLED',
    "shipmentStatus" "OrderShipmentStatus" NOT NULL DEFAULT 'NOT_CREATED',
    "returnStatus" "OrderReturnStatus" NOT NULL DEFAULT 'NONE',
    "refundStatus" "OrderRefundStatus" NOT NULL DEFAULT 'NONE',
    "codVerification" "CodVerificationStatus" NOT NULL DEFAULT 'REQUIRED',
    "paymentMethod" "CheckoutPaymentMethod" NOT NULL DEFAULT 'COD',
    "currency" TEXT NOT NULL DEFAULT 'BDT',
    "subtotal" INTEGER NOT NULL,
    "discountTotal" INTEGER NOT NULL DEFAULT 0,
    "deliveryFee" INTEGER NOT NULL,
    "paymentCharge" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "source" TEXT,
    "medium" TEXT,
    "campaign" TEXT,
    "cancellationReason" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "customerId" TEXT NOT NULL,
    "checkoutDraftId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderAddress" (
    "id" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "phoneOriginal" TEXT NOT NULL,
    "phoneNormalized" TEXT NOT NULL,
    "email" TEXT,
    "district" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "detailedAddress" TEXT NOT NULL,
    "landmark" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "orderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderAddress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "productIdSnapshot" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "variantName" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "attributes" JSONB,
    "imageUrl" TEXT,
    "unitPrice" INTEGER NOT NULL,
    "discountTotal" INTEGER NOT NULL DEFAULT 0,
    "taxTotal" INTEGER NOT NULL DEFAULT 0,
    "quantity" INTEGER NOT NULL,
    "lineTotal" INTEGER NOT NULL,
    "orderId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderStatusHistory" (
    "id" TEXT NOT NULL,
    "oldStatus" "OrderStatus",
    "newStatus" "OrderStatus" NOT NULL,
    "source" "OrderHistorySource" NOT NULL,
    "actorId" TEXT,
    "note" TEXT,
    "orderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryReservation" (
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "InventoryReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "inventoryId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InventoryReservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE UNIQUE INDEX "Order_reference_key" ON "Order"("reference");
CREATE UNIQUE INDEX "Order_idempotencyKeyHash_key" ON "Order"("idempotencyKeyHash");
CREATE UNIQUE INDEX "Order_checkoutDraftId_key" ON "Order"("checkoutDraftId");
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");
CREATE INDEX "Order_paymentStatus_createdAt_idx" ON "Order"("paymentStatus", "createdAt");
CREATE INDEX "Order_customerId_createdAt_idx" ON "Order"("customerId", "createdAt");
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");
CREATE UNIQUE INDEX "OrderAddress_orderId_key" ON "OrderAddress"("orderId");
CREATE INDEX "OrderAddress_phoneNormalized_idx" ON "OrderAddress"("phoneNormalized");
CREATE INDEX "OrderAddress_district_area_idx" ON "OrderAddress"("district", "area");
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX "OrderItem_variantId_idx" ON "OrderItem"("variantId");
CREATE INDEX "OrderItem_sku_idx" ON "OrderItem"("sku");
CREATE INDEX "OrderStatusHistory_orderId_createdAt_idx" ON "OrderStatusHistory"("orderId", "createdAt");
CREATE INDEX "OrderStatusHistory_actorId_createdAt_idx" ON "OrderStatusHistory"("actorId", "createdAt");
CREATE UNIQUE INDEX "InventoryReservation_inventoryId_orderItemId_key" ON "InventoryReservation"("inventoryId", "orderItemId");
CREATE INDEX "InventoryReservation_status_expiresAt_idx" ON "InventoryReservation"("status", "expiresAt");
CREATE INDEX "InventoryReservation_orderItemId_idx" ON "InventoryReservation"("orderItemId");

-- AddForeignKeys
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_checkoutDraftId_fkey" FOREIGN KEY ("checkoutDraftId") REFERENCES "CheckoutDraft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderAddress" ADD CONSTRAINT "OrderAddress_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "InventoryStock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
