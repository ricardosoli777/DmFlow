import { Queue } from "bullmq";
import IORedis from "ioredis";
import { env } from "../env";

export const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

// Eventos brutos do Instagram (comentários, mensagens, postbacks) — RF01, RNF02
export const instagramEventsQueue = new Queue("instagram-events", { connection });

// Envio manual pela Inbox (RF11) — nunca síncrono (RNF02), o worker consome
// e chama a Instagram Messaging API de verdade (ver worker/src/index.ts).
export const manualSendQueue = new Queue("manual-sends", { connection });
