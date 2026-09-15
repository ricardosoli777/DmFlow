-- CreateTable
CREATE TABLE "tracked_links" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "destinationUrl" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracked_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "link_clicks" (
    "id" TEXT NOT NULL,
    "trackedLinkId" TEXT NOT NULL,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "link_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tracked_links_code_key" ON "tracked_links"("code");

-- AddForeignKey
ALTER TABLE "link_clicks" ADD CONSTRAINT "link_clicks_trackedLinkId_fkey" FOREIGN KEY ("trackedLinkId") REFERENCES "tracked_links"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

