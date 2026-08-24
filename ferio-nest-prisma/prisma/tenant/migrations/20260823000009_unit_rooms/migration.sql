-- ──────────────────────────────────────────────────────────────
-- Tenant schema — 0009: Rich unit detail (§24 room-by-room)
-- ──────────────────────────────────────────────────────────────

CREATE TYPE "RoomType" AS ENUM (
  'BEDROOM', 'MASTER_BEDROOM', 'BATHROOM', 'KITCHEN', 'LIVING_ROOM',
  'DINING_ROOM', 'BALCONY', 'SERVANT_ROOM', 'STORAGE', 'GARAGE', 'OTHER'
);

CREATE TABLE "UnitRoom" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "RoomType" NOT NULL DEFAULT 'OTHER',
    "lengthFt" DOUBLE PRECISION,
    "widthFt" DOUBLE PRECISION,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitRoom_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UnitRoom_unitId_idx" ON "UnitRoom"("unitId");

ALTER TABLE "UnitRoom" ADD CONSTRAINT "UnitRoom_unitId_fkey"
  FOREIGN KEY ("unitId") REFERENCES "Unit"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "UnitRoomMedia" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnitRoomMedia_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UnitRoomMedia_roomId_idx" ON "UnitRoomMedia"("roomId");

ALTER TABLE "UnitRoomMedia" ADD CONSTRAINT "UnitRoomMedia_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "UnitRoom"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
