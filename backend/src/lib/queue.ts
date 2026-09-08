import { Queue } from "bullmq";
import IORedis from "ioredis";
import { env } from "../env";

export const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

// Eventos brutos do Instagram (comentários, mensagens, postbacks) — RF01, RNF02
export const instagramEventsQueue = new Queue("instagram-events", { connection });
