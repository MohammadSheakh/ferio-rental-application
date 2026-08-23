/*
  Warnings:

  - The values [business,child] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `uploadedByUserId` on the `Attachment` table. All the data in the column will be lost.
  - You are about to drop the `TaskReminder` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_AttachmentToMessage` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('admin', 'user');
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "public"."UserRole_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "Attachment" DROP CONSTRAINT "Attachment_uploadedByUserId_fkey";

-- DropForeignKey
ALTER TABLE "TaskReminder" DROP CONSTRAINT "TaskReminder_createdByUserId_fkey";

-- DropForeignKey
ALTER TABLE "TaskReminder" DROP CONSTRAINT "TaskReminder_userId_fkey";

-- DropForeignKey
ALTER TABLE "_AttachmentToMessage" DROP CONSTRAINT "_AttachmentToMessage_A_fkey";

-- DropForeignKey
ALTER TABLE "_AttachmentToMessage" DROP CONSTRAINT "_AttachmentToMessage_B_fkey";

-- DropIndex
DROP INDEX "Attachment_uploadedByUserId_isDeleted_idx";

-- AlterTable
ALTER TABLE "Attachment" DROP COLUMN "uploadedByUserId",
ADD COLUMN     "messageId" TEXT;

-- AlterTable
ALTER TABLE "CommerceSettings" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- DropTable
DROP TABLE "TaskReminder";

-- DropTable
DROP TABLE "_AttachmentToMessage";

-- DropEnum
DROP TYPE "TaskReminderFrequency";

-- DropEnum
DROP TYPE "TaskReminderStatus";

-- DropEnum
DROP TYPE "TaskReminderTrigger";

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
