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
      include: {
        messages: { orderBy: { createdAt: "asc" } },
        flowRuns: { orderBy: { createdAt: "desc" }, include: { flow: true, trigger: true } },
      },
    });
    if (!contact) return reply.status(404).send({ error: "not found" });
    return contact;
  });

  app.patch("/contacts/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = z
      .object({
        name: z.string().nullable().optional(),
        username: z.string().nullable().optional(),
        tags: z.array(z.string()).optional(),
      })
      .parse(req.body);

    const exists = await prisma.contact.findUnique({ where: { id } });
    if (!exists) return reply.status(404).send({ error: "not found" });

    return prisma.contact.update({ where: { id }, data: body });
  });

  app.delete("/contacts/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const exists = await prisma.contact.findUnique({ where: { id } });
    if (!exists) return reply.status(404).send({ error: "not found" });

    // sem o contato, mensagens e flow_runs associados não fazem sentido — some junto
    await prisma.$transaction([
      prisma.message.deleteMany({ where: { contactId: id } }),
      prisma.flowRun.deleteMany({ where: { contactId: id } }),
      prisma.contact.delete({ where: { id } }),
    ]);

    return reply.status(204).send();
  });
}
