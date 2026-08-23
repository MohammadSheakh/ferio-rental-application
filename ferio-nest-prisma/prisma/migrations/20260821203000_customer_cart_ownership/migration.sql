ALTER TABLE "Cart" ADD COLUMN "userId" TEXT;
CREATE INDEX "Cart_userId_status_updatedAt_idx" ON "Cart"("userId", "status", "updatedAt");
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
