import { Queue } from "bullmq";
import IORedis from "ioredis";
import { env } from "../env";

export const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
const deliveryDefaults = {
  attempts: 5,
  backoff: { type: "exponential" as const, delay: 1_000 },
  removeOnComplete: 1_000,
  removeOnFail: false,
};

// Eventos brutos do Instagram (comentários, mensagens, postbacks) — RF01, RNF02
export const instagramEventsQueue = new Queue("instagram-events", { connection, defaultJobOptions: deliveryDefaults });

// Envio manual pela Inbox (RF11) — nunca síncrono (RNF02), o worker consome
// e chama a Instagram Messaging API de verdade (ver worker/src/index.ts).
export const manualSendQueue = new Queue("manual-sends", { connection, defaultJobOptions: deliveryDefaults });

