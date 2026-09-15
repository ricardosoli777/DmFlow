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

// Retoma um flow_run pausado (node "delay" real, ou rate limit — Wave 6)
// depois do tempo agendado. Produzida e consumida pelo próprio worker (ver
// executor.ts e index.ts).
export const flowResumeQueue = new Queue("flow-resume", { connection, defaultJobOptions: deliveryDefaults });
