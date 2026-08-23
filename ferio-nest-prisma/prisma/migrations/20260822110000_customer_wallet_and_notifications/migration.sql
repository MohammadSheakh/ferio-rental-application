ALTER TYPE "CheckoutPaymentMethod" ADD VALUE IF NOT EXISTS 'WALLET';

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'commerce';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'order';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'payment';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'wallet';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'warranty';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'service';

ALTER TYPE "TTransactionFor" ADD VALUE IF NOT EXISTS 'WalletTopUp';
ALTER TYPE "TTransactionFor" ADD VALUE IF NOT EXISTS 'OrderPurchase';
ALTER TYPE "TTransactionFor" ADD VALUE IF NOT EXISTS 'OrderRefund';
ALTER TYPE "TTransactionFor" ADD VALUE IF NOT EXISTS 'AdminAdjustment';

ALTER TABLE "Wallet"
  ALTER COLUMN "amount" SET DEFAULT 0,
  ALTER COLUMN "totalBalance" SET DEFAULT 0,
  ALTER COLUMN "currency" SET DEFAULT 'bdt',
  ALTER COLUMN "status" SET DEFAULT 'active',
  ALTER COLUMN "isDeleted" SET DEFAULT false;

UPDATE "Wallet"
SET
  "amount" = COALESCE("amount", 0),
  "totalBalance" = COALESCE("totalBalance", COALESCE("amount", 0)),
  "currency" = COALESCE("currency", 'bdt'),
  "isDeleted" = COALESCE("isDeleted", false);

ALTER TABLE "Wallet"
  ALTER COLUMN "amount" SET NOT NULL,
  ALTER COLUMN "totalBalance" SET NOT NULL,
  ALTER COLUMN "currency" SET NOT NULL,
  ALTER COLUMN "isDeleted" SET NOT NULL;

ALTER TABLE "Notification" ADD COLUMN "deduplicationKey" TEXT;
CREATE UNIQUE INDEX "Notification_deduplicationKey_key" ON "Notification"("deduplicationKey");

ALTER TABLE "WalletTransactionHistory"
  ADD COLUMN "topUpId" TEXT,
  ADD COLUMN "orderId" TEXT,
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "WalletTransactionHistory" ALTER COLUMN "isDeleted" SET DEFAULT false;
UPDATE "WalletTransactionHistory" SET "isDeleted" = false WHERE "isDeleted" IS NULL;
ALTER TABLE "WalletTransactionHistory" ALTER COLUMN "isDeleted" SET NOT NULL;

CREATE UNIQUE INDEX "WalletTransactionHistory_idempotencyKey_key" ON "WalletTransactionHistory"("idempotencyKey");
CREATE INDEX "WalletTransactionHistory_userId_createdAt_idx" ON "WalletTransactionHistory"("userId", "createdAt");
CREATE INDEX "WalletTransactionHistory_walletId_createdAt_idx" ON "WalletTransactionHistory"("walletId", "createdAt");
CREATE INDEX "WalletTransactionHistory_orderId_createdAt_idx" ON "WalletTransactionHistory"("orderId", "createdAt");
CREATE INDEX "WalletTransactionHistory_topUpId_createdAt_idx" ON "WalletTransactionHistory"("topUpId", "createdAt");

CREATE TYPE "WalletTopUpProvider" AS ENUM ('BKASH', 'NAGAD', 'ROCKET', 'BANK_TRANSFER');
CREATE TYPE "WalletTopUpStatus" AS ENUM ('PENDING_REVIEW', 'COMPLETED', 'REJECTED', 'CANCELLED');

CREATE TABLE "WalletTopUp" (
  "id" TEXT NOT NULL,
  "provider" "WalletTopUpProvider" NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" "TCurrency" NOT NULL DEFAULT 'bdt',
  "status" "WalletTopUpStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "customerReference" TEXT NOT NULL,
  "customerNote" TEXT,
  "reviewNote" TEXT,
  "reviewedById" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "completedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "userId" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WalletTopUp_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WalletTopUp_idempotencyKey_key" ON "WalletTopUp"("idempotencyKey");
CREATE INDEX "WalletTopUp_userId_createdAt_idx" ON "WalletTopUp"("userId", "createdAt");
CREATE INDEX "WalletTopUp_walletId_createdAt_idx" ON "WalletTopUp"("walletId", "createdAt");
CREATE INDEX "WalletTopUp_status_createdAt_idx" ON "WalletTopUp"("status", "createdAt");
CREATE INDEX "WalletTopUp_provider_customerReference_idx" ON "WalletTopUp"("provider", "customerReference");

ALTER TABLE "WalletTopUp" ADD CONSTRAINT "WalletTopUp_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WalletTopUp" ADD CONSTRAINT "WalletTopUp_walletId_fkey"
  FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WalletTransactionHistory" ADD CONSTRAINT "WalletTransactionHistory_topUpId_fkey"
  FOREIGN KEY ("topUpId") REFERENCES "WalletTopUp"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WalletTransactionHistory" ADD CONSTRAINT "WalletTransactionHistory_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
