import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { decryptCredential, listAllInstagramAccounts } from "@dmflow/db";
import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { instagramEventsQueue } from "../lib/queue";

// RF01, RNF03, RNF04 — receber e validar eventos da Meta, nunca processar
// síncrono. RF17: público (sem auth, é a própria Meta chamando) e não sabe
// ainda a qual conta/workspace um evento pertence — isso só é resolvido
// depois, no worker, a partir do `entry[].id` do payload (ver
// worker/src/index.ts). Aqui só precisa confirmar que a chamada é
// autêntica, testando contra TODAS as contas conectadas.
export async function webhookRoutes(app: FastifyInstance) {
  app.post("/webhooks/zernio/:connectionId", async (req, reply) => {
    const { connectionId } = req.params as { connectionId: string };
    const connection = await prisma.zernioConnection.findUnique({ where: { id: connectionId } });
    const rawBody = (req as any).rawBody as Buffer | undefined;
    const signature = req.headers["x-zernio-signature"] as string | undefined;
    if (!connection?.webhookSecret || !connection.instagramAccountId || !rawBody || !signature) {
      return reply.status(401).send({ error: "invalid signature" });
    }
    const expected = createHmac("sha256", decryptCredential(connection.webhookSecret)).update(rawBody).digest("hex");
    const given = Buffer.from(signature, "utf8");
    const valid = given.length === expected.length && timingSafeEqual(given, Buffer.from(expected));
    if (!valid) return reply.status(401).send({ error: "invalid signature" });

    const payload = req.body as { id?: string; event?: string; account?: { accountId?: string; id?: string } };
    if (payload.event === "webhook.test") return reply.send({ received: true });
    if (payload.event !== "message.received" && payload.event !== "comment.received") return reply.send({ received: true, ignored: true });
    if ((payload.account?.accountId ?? payload.account?.id) !== connection.accountId || !payload.id) {
      return reply.status(400).send({ error: "account mismatch" });
    }
    const dedupeKey = `zernio:${payload.id}`;
    let event = await prisma.rawEvent.findUnique({ where: { dedupeKey } });
    if (!event) {
      try {
        event = await prisma.rawEvent.create({ data: { payload: payload as any, workspaceId: connection.workspaceId, dedupeKey } });
      } catch (error) {
        if ((error as { code?: string }).code !== "P2002") throw error;
        event = await prisma.rawEvent.findUniqueOrThrow({ where: { dedupeKey } });
      }
    }
    if (!event.processed) await instagramEventsQueue.add("process-event", { eventId: event.id }, { jobId: event.id });
    return reply.send({ received: true });
  });
  // Verificação inicial do webhook (challenge da Meta)
  app.get("/webhooks/instagram", async (req, reply) => {
    const query = req.query as Record<string, string>;
    const mode = query["hub.mode"];
    const token = query["hub.verify_token"];
    const challenge = query["hub.challenge"];

    const accounts = (await listAllInstagramAccounts()).filter((account) => account.verifyToken);
    const matches = mode === "subscribe" && accounts.some((a) => a.verifyToken === token);

    if (matches) return reply.status(200).send(challenge);
    return reply.status(403).send("Forbidden");
  });

  // Recebimento de eventos reais (comments, messages, messaging_postbacks)
  app.post("/webhooks/instagram", async (req, reply) => {
    const signature = req.headers["x-hub-signature-256"] as string | undefined;
    const rawBody = (req as any).rawBody as Buffer | undefined;
    if (!signature || !rawBody) return reply.status(401).send({ error: "invalid signature" });

    const accounts = (await listAllInstagramAccounts()).filter((account) => account.appSecret);
    const authentic = accounts.some((a) => isValidSignature(rawBody, signature, a.appSecret));
    if (!authentic) return reply.status(401).send({ error: "invalid signature" });

    const dedupeKey = createHash("sha256").update(rawBody).digest("hex");
    const existing = await prisma.rawEvent.findUnique({ where: { dedupeKey } });
    // Reentrega válida: responder sucesso sem recolocar o mesmo evento na
    // fila. Isso evita DMs e flow_runs duplicados (RF18).
    if (existing) {
      if (!existing.processed) {
        await instagramEventsQueue.add("process-event", { eventId: existing.id }, { jobId: existing.id });
      }
      return reply.status(200).send({ received: true, duplicate: true });
    }

    let event;
    try {
      event = await prisma.rawEvent.create({
        data: { payload: req.body as any, dedupeKey },
      });
    } catch (err) {
      // Duas requisições idênticas podem passar juntas pelo findUnique acima.
      // A constraint única é a autoridade final; a segunda também é uma
      // reentrega bem-sucedida, não um erro 500 para a Meta (RF18).
      if ((err as { code?: string }).code === "P2002") {
        const duplicate = await prisma.rawEvent.findUniqueOrThrow({ where: { dedupeKey } });
        if (!duplicate.processed) {
          await instagramEventsQueue.add("process-event", { eventId: duplicate.id }, { jobId: duplicate.id });
        }
        return reply.status(200).send({ received: true, duplicate: true });
      }
      throw err;
    }

    await instagramEventsQueue.add("process-event", { eventId: event.id }, { jobId: event.id });

    return reply.status(200).send({ received: true });
  });
}

function isValidSignature(rawBody: Buffer, signatureHeader: string, appSecret: string): boolean {
  const expected = "sha256=" + createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  return a.length === b.length && timingSafeEqual(a, b);
}
