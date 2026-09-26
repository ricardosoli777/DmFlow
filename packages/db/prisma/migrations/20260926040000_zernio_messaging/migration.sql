ALTER TABLE "zernio_connections" ADD COLUMN "webhookId" TEXT;
ALTER TABLE "zernio_connections" ADD COLUMN "webhookSecret" TEXT;
ALTER TABLE "contacts" ADD COLUMN "zernioConversationId" TEXT;
DROP INDEX IF EXISTS "contacts_workspaceId_igsid_key";
CREATE UNIQUE INDEX "contacts_instagramAccountId_igsid_key" ON "contacts"("instagramAccountId", "igsid");
ALTER TABLE "posts_triggers" ADD COLUMN "instagramAccountId" TEXT;
CREATE INDEX "posts_triggers_instagramAccountId_idx" ON "posts_triggers"("instagramAccountId");
