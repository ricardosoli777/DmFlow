import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { manualSendQueue } from "../lib/queue";
import { requireRole } from "../lib/auth";

// RF11 — intervenção manual na inbox (envio direto, fora do flow automático).
// Nunca envia síncrono (RNF02): só enfileira, o worker chama a Instagram
// Messaging API de verdade e grava o messages_log (com status/reason —
// RNF08) via worker/src/services/instagram.ts.
export async function messageRoutes(app: FastifyInstance) {
  app.post("/contacts/:id/messages", { preHandler: requireRole("OWNER", "ADMIN") }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = z.object({ content: z.string().min(1) }).parse(req.body);

    const contact = await prisma.contact.findUnique({ where: { id } });
    if (!contact || contact.workspaceId !== req.workspaceId) return reply.status(404).send({ error: "not found" });

    if (contact.instagramAccountId && !contact.zernioConversationId) {
      const connection = await prisma.zernioConnection.findUnique({ where: { instagramAccountId: contact.instagramAccountId } });
      if (connection) return reply.status(409).send({ error: "A pessoa ainda não abriu uma conversa por DM. No Zernio, aguarde ela responder à primeira mensagem privada antes de enviar pela Inbox." });
    }

    await manualSendQueue.add("send", { contactId: id, text: body.content });
    return reply.status(202).send({ queued: true });
  });
}
