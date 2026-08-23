ALTER TYPE "UserRole" ADD VALUE 'staff';

CREATE TYPE "StaffAccessStatus" AS ENUM ('active', 'inactive');
CREATE TYPE "StaffAccessTokenPurpose" AS ENUM ('INVITE', 'RESET');

ALTER TABLE "User"
ADD COLUMN "staffAccessStatus" "StaffAccessStatus",
ADD COLUMN "staffPermissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "staffSessionVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "StaffAccessToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "purpose" "StaffAccessTokenPurpose" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "targetUserId" TEXT,
    "issuedByUserId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffAccessToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffAccessToken_tokenHash_key" ON "StaffAccessToken"("tokenHash");
CREATE INDEX "User_role_staffAccessStatus_isDeleted_idx" ON "User"("role", "staffAccessStatus", "isDeleted");
CREATE INDEX "StaffAccessToken_email_purpose_consumedAt_expiresAt_idx" ON "StaffAccessToken"("email", "purpose", "consumedAt", "expiresAt");
CREATE INDEX "StaffAccessToken_targetUserId_purpose_consumedAt_idx" ON "StaffAccessToken"("targetUserId", "purpose", "consumedAt");
CREATE INDEX "StaffAccessToken_issuedByUserId_createdAt_idx" ON "StaffAccessToken"("issuedByUserId", "createdAt");
