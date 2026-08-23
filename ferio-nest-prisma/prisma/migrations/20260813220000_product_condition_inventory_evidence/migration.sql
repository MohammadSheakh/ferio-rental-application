CREATE TYPE "ProductCondition" AS ENUM ('NEW', 'SECOND_HAND');
CREATE TYPE "ProductConditionGrade" AS ENUM ('LIKE_NEW', 'GOOD', 'FAIR');
CREATE TYPE "InventoryAdjustmentReason" AS ENUM ('STOCK_COUNT_CORRECTION', 'PURCHASE_RECEIPT', 'CUSTOMER_RETURN', 'DAMAGE_WRITE_OFF', 'OTHER');

ALTER TABLE "Product"
  ADD COLUMN "condition" "ProductCondition" NOT NULL DEFAULT 'NEW',
  ADD COLUMN "conditionGrade" "ProductConditionGrade",
  ADD COLUMN "conditionNote" TEXT;

ALTER TABLE "InventoryMovement"
  ADD COLUMN "adjustmentReason" "InventoryAdjustmentReason",
  ADD COLUMN "unitCost" INTEGER,
  ADD COLUMN "evidenceUrl" TEXT,
  ADD COLUMN "effectiveAt" TIMESTAMP(3);

ALTER TABLE "OrderItem"
  ADD COLUMN "productCondition" "ProductCondition" NOT NULL DEFAULT 'NEW',
  ADD COLUMN "conditionGrade" "ProductConditionGrade",
  ADD COLUMN "conditionNote" TEXT;
