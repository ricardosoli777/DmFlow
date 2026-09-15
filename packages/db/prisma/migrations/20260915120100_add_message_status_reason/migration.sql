-- AlterTable
ALTER TABLE "messages_log" ADD COLUMN     "reason" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ok';

