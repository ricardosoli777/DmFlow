import { Queue } from "bullmq";
import IORedis from "ioredis";
import { env } from "../env";

export const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

// Retoma um flow_run pausado (node "delay" real, ou rate limit — Wave 6)
// depois do tempo agendado. Produzida e consumida pelo próprio worker (ver
// executor.ts e index.ts).
export const flowResumeQueue = new Queue("flow-resume", { connection });
