import { getPrisma } from "@dmflow/db";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { env } from "./env";
import { parseMetaPayload } from "./engine/parse-meta-payload";
import { resolveEvent } from "./engine/resolve-event";

const prisma = getPrisma();
const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

// RNF02 — consome a fila publicada pelo backend em /webhooks/instagram
const worker = new Worker(
  "instagram-events",
  async (job) => {
    const { eventId } = job.data as { eventId: string };
    const raw = await prisma.rawEvent.findUniqueOrThrow({ where: { id: eventId } });

    const events = parseMetaPayload(raw.payload);
    for (const event of events) {
      await resolveEvent(event);
    }

    await prisma.rawEvent.update({ where: { id: eventId }, data: { processed: true } });
  },
  { connection, concurrency: 5 },
);

worker.on("failed", (job, err) => {
  console.error(`[worker] evento ${job?.id} falhou:`, err.message);
});

console.log("DMFlow worker rodando — aguardando eventos na fila instagram-events");
