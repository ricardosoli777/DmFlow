import { getPrisma, type Prisma } from "@dmflow/db";
import { advanceFlowRun } from "./executor";

const prisma = getPrisma();

type CommentEvent = {
  kind: "comment";
  postId: string;
  commentId: string;
  fromIgsid: string;
  fromName?: string;
  text: string;
};

type MessageEvent = {
  kind: "message" | "postback";
  fromIgsid: string;
  text: string;
};

export type InstagramEvent = CommentEvent | MessageEvent;

// RF01, RF02, RNF01 — decide qual trigger/flow_run corresponde a um evento
// cru, e marca a abertura da janela de 24h de mensagens.
export async function resolveEvent(event: InstagramEvent): Promise<void> {
  const contact = await prisma.contact.upsert({
    where: { igsid: event.fromIgsid },
    update: { lastInboundAt: new Date() },
    create: {
      igsid: event.fromIgsid,
      name: "fromName" in event ? event.fromName : undefined,
      lastInboundAt: new Date(),
    },
  });

  if (event.kind === "comment") {
    const trigger = await findCommentTrigger(event.postId, event.text);
    // Guarda o comentário mesmo sem match, pra aparecer no histórico/dashboard
    // ("o que a pessoa falou") — não dispara nada, só registro (RF02).
    await prisma.message.create({ data: { contactId: contact.id, direction: "inbound", content: event.text } });
    if (!trigger) return; // RF02: comentário sem match, ignora

    await startFlowRun(contact.id, trigger, {
      originCommentId: event.commentId,
      // `pendingPrivateReply` faz o primeiro node de texto puro (sem CTA)
      // sair via Private Reply em vez de DM direta — ver node-handlers.ts.
      pendingPrivateReply: true,
    });
    return;
  }

  // event.kind === "message" | "postback": avança um flow_run que estava "waiting"
  const run = await prisma.flowRun.findFirst({
    where: { contactId: contact.id, status: "waiting" },
    orderBy: { updatedAt: "desc" },
  });

  await prisma.message.create({ data: { contactId: contact.id, direction: "inbound", content: event.text } });

  if (!run) {
    // Sem flow_run ativo: talvez seja uma DM "fria" com palavra-chave de trigger.
    if (event.kind === "message") {
      await tryStartFromDmKeyword(contact.id, event.text);
    }
    return;
  }

  if (event.kind === "postback") {
    await advanceToButtonTarget(run.id, event.text);
    return;
  }

  await advanceFlowRun(run.id, { capturedText: event.text });
}

// RF02 — trigger de comentário: com palavra-chave, dispara se o comentário
// CONTIVER a palavra (não precisa ser idêntico); sem palavra-chave, dispara
// em qualquer comentário do post. Se houver os dois tipos configurados pro
// mesmo post, a palavra-chave específica tem prioridade sobre o "qualquer".
async function findCommentTrigger(
  postId: string,
  text: string,
): Promise<{ id: string; flowId: string } | null> {
  const candidates = await prisma.postTrigger.findMany({
    where: { type: "comment", postId, active: true },
  });

  const byKeyword = candidates.find(
    (t) => t.keyword && text.toLowerCase().includes(t.keyword.toLowerCase()),
  );
  if (byKeyword) return byKeyword;

  return candidates.find((t) => !t.keyword) ?? null;
}

// RF (novo) — trigger de "DM com palavra-chave": dispara um flow pra quem manda
// DM direta contendo a palavra, sem precisar ter comentado em nenhum post.
async function tryStartFromDmKeyword(contactId: string, text: string): Promise<void> {
  const candidates = await prisma.postTrigger.findMany({
    where: { type: "dm_keyword", active: true, keyword: { not: null } },
  });

  const trigger = candidates.find((t) => text.toLowerCase().includes((t.keyword ?? "").toLowerCase()));
  if (!trigger) return;

  await startFlowRun(contactId, trigger, {});
}

async function startFlowRun(
  contactId: string,
  trigger: { id: string; flowId: string },
  extraContext: Record<string, unknown>,
): Promise<void> {
  await prisma.postTrigger.update({ where: { id: trigger.id }, data: { hitCount: { increment: 1 } } });

  const flow = await prisma.flow.findUniqueOrThrow({ where: { id: trigger.flowId } });
  const definition = flow.definition as unknown as { start: string };

  const run = await prisma.flowRun.create({
    data: {
      contactId,
      flowId: flow.id,
      triggerId: trigger.id,
      currentNode: definition.start,
      status: "running",
      context: extraContext as Prisma.InputJsonValue,
    },
  });

  await advanceFlowRun(run.id);
}

async function advanceToButtonTarget(flowRunId: string, payload: string): Promise<void> {
  // payload do postback é o id do node de destino, definido no node "buttons"
  // (ver frontend/components/flow-editor — cada botão carrega seu next node).
  await prisma.flowRun.update({ where: { id: flowRunId }, data: { currentNode: payload, status: "running" } });
  await advanceFlowRun(flowRunId);
}
