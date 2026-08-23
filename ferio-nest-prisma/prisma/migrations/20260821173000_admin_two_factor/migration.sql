ALTER TABLE "User"
ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "twoFactorSecretEncrypted" TEXT,
ADD COLUMN "twoFactorPendingEncrypted" TEXT,
ADD COLUMN "twoFactorRecoveryCodeHashes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
