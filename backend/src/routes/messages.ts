import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";

// RF11 — intervenção manual na inbox (envio direto, fora do flow automático)
export async function messageRoutes(app: FastifyInstance) {
  app.post("/contacts/:id/messages", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = z.object({ content: z.string().min(1) }).parse(req.body);

    // TODO (Wave 2): chamar o serviço de envio real via Instagram Messaging API
    const message = await prisma.message.create({
      data: { contactId: id, direction: "outbound", content: body.content },
    });

    return reply.status(201).send(message);
  });
}
