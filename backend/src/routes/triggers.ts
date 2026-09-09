import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const createSchema = z.object({
  postId: z.string(),
  keyword: z.string().optional(),
  flowId: z.string().uuid(),
});

// RF09 — CRUD de triggers (post/reel -> palavra-chave -> flow)
export async function triggerRoutes(app: FastifyInstance) {
  app.get("/triggers", async () => {
    return prisma.postTrigger.findMany({ include: { flow: true }, orderBy: { createdAt: "desc" } });
  });

  app.post("/triggers", async (req, reply) => {
    const body = createSchema.parse(req.body);
    const trigger = await prisma.postTrigger.create({ data: body });
    return reply.status(201).send(trigger);
  });

  app.patch("/triggers/:id", async (req) => {
    const { id } = req.params as { id: string };
    const body = z
      .object({ active: z.boolean().optional(), keyword: z.string().nullable().optional() })
      .parse(req.body);
    return prisma.postTrigger.update({ where: { id }, data: body });
  });

  app.delete("/triggers/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.postTrigger.delete({ where: { id } });
    return reply.status(204).send();
  });
}
