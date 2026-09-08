import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";

// RF06, RF07 — listagem/filtro de contatos por tag, dados capturados no flow
export async function contactRoutes(app: FastifyInstance) {
  app.get("/contacts", async (req) => {
    const query = z.object({ tag: z.string().optional() }).parse(req.query);
    return prisma.contact.findMany({
      where: query.tag ? { tags: { has: query.tag } } : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  });

  app.get("/contacts/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const contact = await prisma.contact.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: "asc" } }, flowRuns: true },
    });
    if (!contact) return reply.status(404).send({ error: "not found" });
    return contact;
  });
}
