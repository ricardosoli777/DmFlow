import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";

// RF12 — métricas de funil pro dashboard
export async function metricsRoutes(app: FastifyInstance) {
  app.get("/metrics/overview", async () => {
    const [contacts, triggers, flowRuns, messagesOut] = await Promise.all([
      prisma.contact.count(),
      prisma.postTrigger.count({ where: { active: true } }),
      prisma.flowRun.count(),
      prisma.message.count({ where: { direction: "outbound" } }),
    ]);

    return { contacts, activeTriggers: triggers, flowRuns, messagesSent: messagesOut };
  });

  app.get("/metrics/funnel/:flowId", async (req) => {
    const { flowId } = req.params as { flowId: string };
    const runs = await prisma.flowRun.groupBy({
      by: ["currentNode", "status"],
      where: { flowId },
      _count: true,
    });
    return runs;
  });
}
