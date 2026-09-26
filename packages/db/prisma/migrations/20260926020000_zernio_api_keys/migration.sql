CREATE TABLE "zernio_api_keys" (
  "workspaceId" TEXT NOT NULL,
  "apiKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "zernio_api_keys_pkey" PRIMARY KEY ("workspaceId")
);

ALTER TABLE "zernio_api_keys" ADD CONSTRAINT "zernio_api_keys_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
