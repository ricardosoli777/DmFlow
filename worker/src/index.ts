import { getPrisma } from "@dmflow/db";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { env } from "./env";
import { resolveEvent, type InstagramEvent } from "./engine/resolve-event";

const prisma = getPrisma();
const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

// RNF02 — consome a fila publicada pelo backend em /webhooks/instagram
const worker = new Worker(
  "instagram-events",
  async (job) => {
    const { eventId } = job.data as { eventId: string };
    const raw = await prisma.rawEvent.findUniqueOrThrow({ where: { id: eventId } });

    const event = parsePayload(raw.payload);
    if (event) await resolveEvent(event);

    await prisma.rawEvent.update({ where: { id: eventId }, data: { processed: true } });
  },
  { connection, concurrency: 5 },
);

worker.on("failed", (job, err) => {
  console.error(`[worker] evento ${job?.id} falhou:`, err.message);
});

console.log("DMFlow worker rodando — aguardando eventos na fila instagram-events");

// Tradução do payload bruto da Meta pro shape interno do engine.
// Implementação completa (parsing real do webhook da Graph API) na Wave 2.
function parsePayload(payload: unknown): InstagramEvent | null {
  const p = payload as any;
  if (p?.commentId) {
    return {
      kind: "comment",
      postId: p.postId,
      commentId: p.commentId,
      fromIgsid: p.fromIgsid,
      fromName: p.fromName,
      text: p.text ?? "",
    };
  }
  if (p?.fromIgsid) {
    return { kind: p.isPostback ? "postback" : "message", fromIgsid: p.fromIgsid, text: p.text ?? "" };
  }
  return null;
}
