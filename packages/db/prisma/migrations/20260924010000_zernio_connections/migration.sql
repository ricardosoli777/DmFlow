CREATE TABLE "zernio_connections" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "username" TEXT NOT NULL DEFAULT '',
  "platform" TEXT NOT NULL DEFAULT 'instagram',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "zernio_connections_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "zernio_connections_workspaceId_key" ON "zernio_connections"("workspaceId");
CREATE UNIQUE INDEX "zernio_connections_accountId_key" ON "zernio_connections"("accountId");
ALTER TABLE "zernio_connections" ADD CONSTRAINT "zernio_connections_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;