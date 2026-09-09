import type { Prisma } from "@dmflow/db";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const flowNodeSchema = z.object({
  id: z.string(),
  type: z.enum([
    "message",
    "buttons",
    "image",
    "audio",
    "video",
    "delay",
    "condition",
    "capture",
    "tag",
    "webhook",
    "end",
  ]),
});

const flowDefinitionSchema = z.object({
  nodes: z.array(flowNodeSchema.passthrough()),
  start: z.string(),
});

const saveSchema = z.object({
  name: z.string().min(1),
  definition: flowDefinitionSchema,
});

// RF04, RF10 — o grafo salvo aqui é exatamente o que o worker executa.
export async function flowRoutes(app: FastifyInstance) {
  app.get("/flows", async () => {
    return prisma.flow.findMany({ orderBy: { updatedAt: "desc" } });
  });

  app.get("/flows/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const flow = await prisma.flow.findUnique({ where: { id } });
    if (!flow) return reply.status(404).send({ error: "not found" });
    return flow;
  });

  app.post("/flows", async (req, reply) => {
    const body = saveSchema.parse(req.body);
    const flow = await prisma.flow.create({
      data: { name: body.name, definition: body.definition as Prisma.InputJsonValue },
    });
    return reply.status(201).send(flow);
  });

  app.put("/flows/:id", async (req) => {
    const { id } = req.params as { id: string };
    const body = saveSchema.parse(req.body);
    return prisma.flow.update({
      where: { id },
      data: {
        name: body.name,
        definition: body.definition as Prisma.InputJsonValue,
        version: { increment: 1 },
      },
    });
  });

  app.delete("/flows/:id", async (req, reply) => {
    const { id } = req.params as { id: string };

    const triggerCount = await prisma.postTrigger.count({ where: { flowId: id } });
    if (triggerCount > 0) {
      return reply.status(409).send({
        error: `Este fluxo está em uso por ${triggerCount} automação(ões) — exclua ou reatribua os triggers em "Triggers" antes de excluir o fluxo.`,
      });
    }

    // histórico de execuções desse fluxo não faz sentido sem o fluxo — some junto
    await prisma.$transaction([
      prisma.flowRun.deleteMany({ where: { flowId: id } }),
      prisma.flow.delete({ where: { id } }),
    ]);

    return reply.status(204).send();
  });
}
