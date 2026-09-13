import { getMetaSettings } from "@dmflow/db";
import type { FastifyInstance } from "fastify";
import { instagramEventsQueue } from "../lib/queue";
import { prisma } from "../lib/prisma";
import { checkInstagramConnection } from "./settings";

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

  // Contatos recentes com "de onde vieram" (trigger/post) e a última mensagem —
  // sem isso a visão geral não dizia quem é a pessoa nem o que ela falou.
  app.get("/metrics/recent-contacts", async () => {
    const contacts = await prisma.contact.findMany({
      orderBy: { lastInboundAt: "desc" },
      take: 20,
      include: {
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
        flowRuns: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { trigger: true, flow: { select: { name: true } } },
        },
      },
    });

    return contacts.map((c) => {
      const lastRun = c.flowRuns[0];
      const lastMessage = c.messages[0];
      return {
        id: c.id,
        name: c.name,
        username: c.username,
        igsid: c.igsid,
        lastInboundAt: c.lastInboundAt,
        lastMessage: lastMessage?.content ?? null,
        origin: lastRun
          ? {
              flowName: lastRun.flow.name,
              triggerType: lastRun.trigger?.type ?? null,
              triggerKeyword: lastRun.trigger?.keyword ?? null,
              postId: lastRun.trigger?.postId ?? null,
            }
          : null,
      };
    });
  });

  // Saúde do pipeline pra saber, sem depender de comentário/DM real, se webhook
  // -> fila -> worker -> Meta estão todos operando (pedido recorrente: "nunca
  // sei se os triggers estão funcionando").
  app.get("/metrics/health", async () => {
    const recentSince = new Date(Date.now() - 10 * 60_000); // últimos 10min

    const [lastEvent, pendingEvents, jobCounts, settings] = await Promise.all([
      prisma.rawEvent.findFirst({ orderBy: { createdAt: "desc" } }),
      // só conta evento parado se for RECENTE — um evento antigo que falhou
      // de vez (ex: janela de 24h fechada) fica marcado como processado pelo
      // worker mesmo em erro, então não deveria travar esse contador; isso
      // aqui é defesa extra caso algo fique preso por outro motivo.
      prisma.rawEvent.count({ where: { processed: false, createdAt: { lt: recentSince } } }),
      instagramEventsQueue.getJobCounts("waiting", "active", "failed", "completed"),
      getMetaSettings(),
    ]);

    const metaStatus = await checkInstagramConnection(
      settings.pageAccessToken,
      settings.igUserId,
      settings.graphApiVersion,
    );

    return {
      lastEventAt: lastEvent?.createdAt ?? null,
      lastEventProcessed: lastEvent?.processed ?? null,
      // fila travada há mais de 10min é sinal de worker parado
      workerLikelyDown: pendingEvents > 0,
      pendingEvents,
      queue: jobCounts,
      meta: metaStatus,
    };
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
