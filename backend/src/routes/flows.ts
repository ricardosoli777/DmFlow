import type { Prisma } from "@dmflow/db";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireRole } from "../lib/auth";

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

export const flowDefinitionSchema = z
  .object({
    nodes: z.array(flowNodeSchema.passthrough()).min(1, "O fluxo precisa ter pelo menos um node"),
    start: z.string().min(1, "Escolha um node inicial"),
  })
  .superRefine((definition, ctx) => {
    const ids = new Set<string>();
    for (const [index, node] of definition.nodes.entries()) {
      if (ids.has(node.id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["nodes", index, "id"], message: "ID de node duplicado" });
      }
      ids.add(node.id);
    }
    if (!ids.has(definition.start)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["start"], message: "O node inicial não existe" });
    }

    const nextByNode = new Map<string, string[]>();
    for (const [index, node] of definition.nodes.entries()) {
      const raw = node as Record<string, unknown>;
      const targets = [raw.next, raw.thenNext, raw.elseNext];
      const options = Array.isArray(raw.options) ? raw.options : [];
      for (const option of options) {
        if (option && typeof option === "object") targets.push((option as Record<string, unknown>).next);
      }
      const validTargets = targets.filter((target): target is string => typeof target === "string" && target.length > 0);
      nextByNode.set(node.id, validTargets);
      for (const target of validTargets) {
        if (!ids.has(target)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["nodes", index],
            message: `Node aponta para destino inexistente: ${target}`,
          });
        }
      }
    }

    // Fluxos v1 são finitos: ciclos escondem automações que nunca acabam e
    // podem gerar envios repetidos. O editor deve usar delay/condição para
    // modelar ramificações, não loops (RF21).
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (id: string) => {
      if (visiting.has(id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["nodes"], message: "O fluxo contém um ciclo" });
        return;
      }
      if (visited.has(id)) return;
      visiting.add(id);
      for (const target of nextByNode.get(id) ?? []) if (ids.has(target)) visit(target);
      visiting.delete(id);
      visited.add(id);
    };
    visit(definition.start);
  });

const saveSchema = z.object({
  name: z.string().min(1),
  definition: flowDefinitionSchema,
});

// RF04, RF10 — o grafo salvo aqui é exatamente o que o worker executa.
export async function flowRoutes(app: FastifyInstance) {
  app.get("/flows", async (req) => {
    return prisma.flow.findMany({ where: { workspaceId: req.workspaceId }, orderBy: { updatedAt: "desc" } });
  });

  app.get("/flows/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const flow = await prisma.flow.findUnique({ where: { id } });
    if (!flow || flow.workspaceId !== req.workspaceId) return reply.status(404).send({ error: "not found" });
    return flow;
  });

  app.post("/flows", { preHandler: requireRole("OWNER", "ADMIN") }, async (req, reply) => {
    const body = saveSchema.parse(req.body);
    const flow = await prisma.flow.create({
      data: { workspaceId: req.workspaceId, name: body.name, definition: body.definition as Prisma.InputJsonValue },
    });
    return reply.status(201).send(flow);
  });

  app.put("/flows/:id", { preHandler: requireRole("OWNER", "ADMIN") }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = saveSchema.parse(req.body);

    const existing = await prisma.flow.findUnique({ where: { id } });
    if (!existing || existing.workspaceId !== req.workspaceId) return reply.status(404).send({ error: "not found" });

    return prisma.flow.update({
      where: { id },
      data: {
        name: body.name,
        definition: body.definition as Prisma.InputJsonValue,
        version: { increment: 1 },
      },
    });
  });

  app.delete("/flows/:id", { preHandler: requireRole("OWNER", "ADMIN") }, async (req, reply) => {
    const { id } = req.params as { id: string };

    const existing = await prisma.flow.findUnique({ where: { id } });
    if (!existing || existing.workspaceId !== req.workspaceId) return reply.status(404).send({ error: "not found" });

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
