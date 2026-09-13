import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { instagramEventsQueue } from "../lib/queue";

const createSchema = z
  .object({
    type: z.enum(["comment", "dm_keyword"]).default("comment"),
    postId: z.string().optional(),
    keyword: z.string().optional(),
    flowId: z.string().uuid(),
  })
  .refine((body) => body.type !== "comment" || !!body.postId, {
    message: "postId é obrigatório pra trigger de comentário",
    path: ["postId"],
  })
  .refine((body) => body.type !== "dm_keyword" || !!body.keyword, {
    message: "keyword é obrigatória pra trigger de DM",
    path: ["keyword"],
  });

const updateSchema = z.object({
  active: z.boolean().optional(),
  keyword: z.string().nullable().optional(),
  postId: z.string().nullable().optional(),
  flowId: z.string().uuid().optional(),
});

// RF09 — CRUD de triggers (comentário em post/reel ou DM com palavra-chave -> flow)
export async function triggerRoutes(app: FastifyInstance) {
  app.get("/triggers", async () => {
    return prisma.postTrigger.findMany({ include: { flow: true }, orderBy: { createdAt: "desc" } });
  });

  app.get("/triggers/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const trigger = await prisma.postTrigger.findUnique({
      where: { id },
      include: { flow: true, flowRuns: { orderBy: { createdAt: "desc" }, take: 20, include: { contact: true } } },
    });
    if (!trigger) return reply.status(404).send({ error: "not found" });
    return trigger;
  });

  app.post("/triggers", async (req, reply) => {
    const body = createSchema.parse(req.body);
    const trigger = await prisma.postTrigger.create({
      data: { type: body.type, postId: body.postId, keyword: body.keyword, flowId: body.flowId },
    });
    return reply.status(201).send(trigger);
  });

  app.patch("/triggers/:id", async (req) => {
    const { id } = req.params as { id: string };
    const body = updateSchema.parse(req.body);
    return prisma.postTrigger.update({ where: { id }, data: body });
  });

  app.delete("/triggers/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.postTrigger.delete({ where: { id } });
    return reply.status(204).send();
  });

  // Dispara um evento sintético pelo mesmo pipeline real (webhook -> fila ->
  // worker), sem precisar de comentário/DM de verdade — só pra confirmar que
  // o trigger + flow estão funcionando de ponta a ponta.
  app.post("/triggers/:id/test", async (req, reply) => {
    const { id } = req.params as { id: string };
    const trigger = await prisma.postTrigger.findUnique({ where: { id } });
    if (!trigger) return reply.status(404).send({ error: "not found" });

    const testIgsid = `test-${trigger.id}-${Date.now()}`;
    const payload =
      trigger.type === "comment"
        ? {
            entry: [
              {
                changes: [
                  {
                    field: "comments",
                    value: {
                      id: `test-comment-${Date.now()}`,
                      media: { id: trigger.postId },
                      from: { id: testIgsid, username: "teste_dmflow" },
                      text: trigger.keyword ?? "teste",
                    },
                  },
                ],
              },
            ],
          }
        : {
            entry: [
              {
                messaging: [
                  { sender: { id: testIgsid }, message: { text: trigger.keyword ?? "teste" } },
                ],
              },
            ],
          };

    const event = await prisma.rawEvent.create({ data: { payload } });
    await instagramEventsQueue.add("process-event", { eventId: event.id });

    return reply.status(202).send({ testContactIgsid: testIgsid, eventId: event.id });
  });
}
