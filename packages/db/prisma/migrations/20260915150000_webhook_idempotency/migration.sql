-- RF18: Meta pode reenviar uma entrega válida. Eventos novos terão a hash
-- única do corpo bruto; eventos legados continuam com NULL.
ALTER TABLE "events_raw" ADD COLUMN "dedupeKey" TEXT;
CREATE UNIQUE INDEX "events_raw_dedupeKey_key" ON "events_raw"("dedupeKey");
