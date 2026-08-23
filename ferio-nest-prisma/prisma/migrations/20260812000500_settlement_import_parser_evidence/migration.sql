ALTER TABLE "CourierSettlementImport"
ADD COLUMN "sourceFileName" TEXT,
ADD COLUMN "sourceFileChecksum" TEXT,
ADD COLUMN "parserVersion" TEXT,
ADD COLUMN "normalizedRowsChecksum" TEXT;

CREATE INDEX "CourierSettlementImport_providerId_sourceFileChecksum_idx" ON "CourierSettlementImport"("providerId", "sourceFileChecksum");
