ALTER TABLE "zernio_api_keys" ADD COLUMN "secondaryApiKey" TEXT;

ALTER TABLE "zernio_connections" ADD COLUMN "keySlot" TEXT NOT NULL DEFAULT 'primary';
DROP INDEX "zernio_connections_workspaceId_key";
CREATE UNIQUE INDEX "zernio_connections_workspaceId_keySlot_key" ON "zernio_connections"("workspaceId", "keySlot");
