-- DropForeignKey
ALTER TABLE "contacts" DROP CONSTRAINT "contacts_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "flows" DROP CONSTRAINT "flows_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "posts_triggers" DROP CONSTRAINT "posts_triggers_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "tracked_links" DROP CONSTRAINT "tracked_links_workspaceId_fkey";

-- DropIndex
DROP INDEX "contacts_igsid_key";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "passwordHash";

-- AlterTable
ALTER TABLE "contacts" ALTER COLUMN "workspaceId" SET NOT NULL;

-- AlterTable
ALTER TABLE "flows" ALTER COLUMN "workspaceId" SET NOT NULL;

-- AlterTable
ALTER TABLE "posts_triggers" ALTER COLUMN "workspaceId" SET NOT NULL;

-- AlterTable
ALTER TABLE "tracked_links" ALTER COLUMN "workspaceId" SET NOT NULL;

-- DropTable
DROP TABLE "settings";

-- CreateIndex
CREATE UNIQUE INDEX "contacts_workspaceId_igsid_key" ON "contacts"("workspaceId", "igsid");

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flows" ADD CONSTRAINT "flows_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts_triggers" ADD CONSTRAINT "posts_triggers_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracked_links" ADD CONSTRAINT "tracked_links_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

