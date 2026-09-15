import { assertCredentialsEncryptionKey, getInstagramAccountByIgUserId, getPrisma } from "@dmflow/db";
import { Worker } from "bullmq";
import { advanceFlowRun } from "./engine/executor";
import { extractAccountIgUserId, parseMetaPayload } from "./engine/parse-meta-payload";
import { resolveEvent } from "./engine/resolve-event";
import { connection } from "./lib/queue";
import { checkSendRateLimit, sendDirectMessage } from "./services/instagram";

const prisma = getPrisma();
assertCredentialsEncryptionKey();

// RNF02 — consome a fila publicada pelo backend em /webhooks/instagram
const worker = new Worker(
  "instagram-events",
  async (job) => {
    const { eventId } = job.data as { eventId: string };
    const raw = await prisma.rawEvent.findUniqueOrThrow({ where: { id: eventId } });
    if (raw.processed) return;

    // RF17 — resolve a qual conta/workspace esse evento pertence a partir
    // do `entry[].id` do payload, ANTES de processar qualquer coisa — sem
    // isso não dá pra saber com credenciais de quem responder.
    const igUserId = extractAccountIgUserId(raw.payload);
    const account = igUserId ? await getInstagramAccountByIgUserId(igUserId) : null;

    if (!account) {
      console.warn(`[worker] evento ${eventId} de conta desconhecida (igUserId=${igUserId ?? "?"}) — ignorado`);
      await prisma.rawEvent.update({ where: { id: eventId }, data: { processed: true } });
      return;
    }

    if (!raw.workspaceId) {
      await prisma.rawEvent.update({ where: { id: eventId }, data: { workspaceId: account.workspaceId } });
    }

    const events = parseMetaPayload(raw.payload);
    for (const event of events) {
      await resolveEvent(event, account);
    }
    await prisma.rawEvent.update({ where: { id: eventId }, data: { processed: true } });
  },
  { connection, concurrency: 5 },
);

worker.on("failed", async (job, err) => {
  console.error(`[worker] evento ${job?.id} falhou:`, err.message);
  if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
  const { eventId } = job.data as { eventId: string };
  await prisma.rawEvent.update({ where: { id: eventId }, data: { processed: true } });
});

// RF11 — envio manual da Inbox (enfileirado por backend/src/routes/messages.ts).
// Reaproveita sendDirectMessage, que já cuida da janela de 24h (RNF01) e do
// log estruturado em messages_log (RNF08) sozinho.
const manualSendWorker = new Worker(
  "manual-sends",
  async (job) => {
    const { contactId, text } = job.data as { contactId: string; text: string };
    const contact = await prisma.contact.findUniqueOrThrow({
      where: { id: contactId },
      include: { instagramAccount: true },
    });
    if (!contact.instagramAccount) {
      throw new Error(`Contato ${contactId} sem conta Instagram associada — não é possível enviar.`);
    }

    // RNF09 — envio manual também respeita o cap de 750/h; como é uma ação
    // pontual disparada por humano (não um lote automatizado), não reagenda
    // sozinho — só loga e a pessoa reenvia pela Inbox quando quiser.
    const rateLimit = await checkSendRateLimit(contact.instagramAccount);
    if (!rateLimit.allowed) {
      await prisma.message.create({
        data: {
          contactId,
          direction: "blocked",
          content: text,
          status: "rate_limited",
          reason: "cap de 750 envios/hora da Meta atingido — tente reenviar em instantes (RNF09)",
        },
      });
      return;
    }

    await sendDirectMessage(contact.instagramAccount, contact, text);
  },
  { connection, concurrency: 5 },
);

manualSendWorker.on("failed", (job, err) => {
  console.error(`[worker] envio manual ${job?.id} falhou:`, err.message);
});

// RF05 — retoma um flow_run pausado por um node "delay" real ou por rate
// limit (Wave 6), agendado em worker/src/lib/queue.ts (flowResumeQueue).
const flowResumeWorker = new Worker(
  "flow-resume",
  async (job) => {
    const { flowRunId } = job.data as { flowRunId: string };
    await prisma.flowRun.update({ where: { id: flowRunId }, data: { status: "running" } });
    await advanceFlowRun(flowRunId);
  },
  { connection, concurrency: 5 },
);

flowResumeWorker.on("failed", (job, err) => {
  console.error(`[worker] retomada de flow_run ${job?.id} falhou:`, err.message);
});

console.log(
  "DMFlow worker rodando — aguardando eventos nas filas instagram-events, manual-sends e flow-resume",
);
