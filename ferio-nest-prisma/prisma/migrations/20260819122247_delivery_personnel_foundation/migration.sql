-- CreateEnum
CREATE TYPE "DeliveryVehicleType" AS ENUM ('BIKE', 'BICYCLE', 'E_BIKE', 'WALK');

-- CreateEnum
CREATE TYPE "DeliveryPersonnelStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'delivery_man';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "assignedDeliveryPersonnelId" TEXT;

-- CreateTable
CREATE TABLE "DeliveryPersonnel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phoneOriginal" TEXT NOT NULL,
    "phoneNormalized" TEXT NOT NULL,
    "email" TEXT,
    "nidNumber" TEXT,
    "vehicleType" "DeliveryVehicleType" NOT NULL DEFAULT 'BIKE',
    "operatingZone" TEXT,
    "drivingLicense" TEXT,
    "emergencyPhone" TEXT,
    "notes" TEXT,
    "status" "DeliveryPersonnelStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "currentLat" DOUBLE PRECISION,
    "currentLng" DOUBLE PRECISION,
    "lastLocationAt" TIMESTAMP(3),
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryPersonnel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryPersonnel_phoneNormalized_key" ON "DeliveryPersonnel"("phoneNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryPersonnel_email_key" ON "DeliveryPersonnel"("email");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryPersonnel_userId_key" ON "DeliveryPersonnel"("userId");

-- CreateIndex
CREATE INDEX "DeliveryPersonnel_status_createdAt_idx" ON "DeliveryPersonnel"("status", "createdAt");

-- CreateIndex
CREATE INDEX "DeliveryPersonnel_operatingZone_idx" ON "DeliveryPersonnel"("operatingZone");

-- CreateIndex
CREATE INDEX "DeliveryPersonnel_phoneNormalized_idx" ON "DeliveryPersonnel"("phoneNormalized");

-- CreateIndex
CREATE INDEX "Order_assignedDeliveryPersonnelId_status_idx" ON "Order"("assignedDeliveryPersonnelId", "status");

-- AddForeignKey
ALTER TABLE "DeliveryPersonnel" ADD CONSTRAINT "DeliveryPersonnel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_assignedDeliveryPersonnelId_fkey" FOREIGN KEY ("assignedDeliveryPersonnelId") REFERENCES "DeliveryPersonnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
