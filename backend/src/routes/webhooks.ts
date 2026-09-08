import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { env } from "../env";
import { prisma } from "../lib/prisma";
import { instagramEventsQueue } from "../lib/queue";

// RF01, RNF03, RNF04 — receber e validar eventos da Meta, nunca processar síncrono.
export async function webhookRoutes(app: FastifyInstance) {
  // Verificação inicial do webhook (challenge da Meta)
  app.get("/webhooks/instagram", async (req, reply) => {
    const query = req.query as Record<string, string>;
    const mode = query["hub.mode"];
    const token = query["hub.verify_token"];
    const challenge = query["hub.challenge"];

    if (mode === "subscribe" && token === env.META_VERIFY_TOKEN) {
      return reply.status(200).send(challenge);
    }
    return reply.status(403).send("Forbidden");
  });

  // Recebimento de eventos reais (comments, messages, messaging_postbacks)
  app.post("/webhooks/instagram", async (req, reply) => {
    const signature = req.headers["x-hub-signature-256"] as string | undefined;
    const rawBody = (req as any).rawBody as Buffer | undefined;

    if (!signature || !rawBody || !isValidSignature(rawBody, signature)) {
      return reply.status(401).send({ error: "invalid signature" });
    }

    const event = await prisma.rawEvent.create({
      data: { payload: req.body as any },
    });

    await instagramEventsQueue.add("process-event", { eventId: event.id });

    return reply.status(200).send({ received: true });
  });
}

function isValidSignature(rawBody: Buffer, signatureHeader: string): boolean {
  const expected =
    "sha256=" + createHmac("sha256", env.META_APP_SECRET).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  return a.length === b.length && timingSafeEqual(a, b);
}
