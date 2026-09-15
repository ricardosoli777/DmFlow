import type { InstagramAccount, Prisma } from "@dmflow/db";
import { getPrisma } from "@dmflow/db";
import { advanceFlowRun } from "./executor";
import type { ButtonOption, FlowNode } from "./node-handlers";
import { checkFollowStatus, fetchInstagramProfile, interpolate, sendPublicCommentReply } from "../services/instagram";

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
// cru, e marca a abertura da janela de 24h de mensagens. RF17: `account` já
// vem resolvida (worker/src/index.ts, a partir do `entry[].id` do payload) —
// é ela que dá o workspace de tudo daqui pra baixo.
export async function resolveEvent(event: InstagramEvent, account: InstagramAccount): Promise<void> {
  // Comentário do próprio dono da conta (ex: teste manual) nunca deve virar
  // contato nem disparar flow — a Meta recusaria a DM de qualquer forma, mas
  // filtrar aqui evita ruído em contacts/flow_runs e uma chamada de API que
  // sempre falharia.
  if (event.kind === "comment" && event.fromIgsid === account.igUserId) return;

  let contact = await prisma.contact.upsert({
    where: { workspaceId_igsid: { workspaceId: account.workspaceId, igsid: event.fromIgsid } },
    update: { lastInboundAt: new Date(), instagramAccountId: account.id },
    create: {
      workspaceId: account.workspaceId,
      instagramAccountId: account.id,
      igsid: event.fromIgsid,
      name: "fromName" in event ? event.fromName : undefined,
      lastInboundAt: new Date(),
    },
  });

  // Contato sem nome/username salvo (típico de quem chegou só por DM, já que
  // o webhook de `messages` não manda o nome junto) — busca na Graph API pra
  // {{name}} funcionar igual funciona pra quem veio de comentário.
  if (!contact.name && !contact.username) {
    const profile = await fetchInstagramProfile(account, contact.igsid);
    if (profile?.name || profile?.username) {
      contact = await prisma.contact.update({
        where: { id: contact.id },
        data: { name: profile.name, username: profile.username, avatarUrl: profile.profilePic },
      });
    }
  }

  if (event.kind === "comment") {
    const trigger = await findCommentTrigger(account.workspaceId, event.postId, event.text);
    // Guarda o comentário mesmo sem match, pra aparecer no histórico/dashboard
    // ("o que a pessoa falou") — não dispara nada, só registro (RF02).
    await prisma.message.create({ data: { contactId: contact.id, direction: "inbound", content: event.text } });
    if (!trigger) return; // RF02: comentário sem match, ignora

    if (trigger.publicReplyText) {
      // "Growth tool" tipo ManyChat: responde publicamente no comentário
      // (prova social) antes de seguir com a automação em privado. Erro aqui
      // não deve travar o fluxo — só loga.
      await sendPublicCommentReply(account, event.commentId, interpolate(trigger.publicReplyText, contact)).catch(
        (err) => console.error(`[worker] resposta pública do trigger ${trigger.id} falhou:`, (err as Error).message),
      );
    }

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
      await tryStartFromDmKeyword(account.workspaceId, contact.id, event.text);
    }
    return;
  }

  if (event.kind === "postback") {
    await advanceToButtonTarget(account, run.id, event.text);
    return;
  }

  await advanceFlowRun(run.id, { capturedText: event.text });
}

// RF02 — trigger de comentário: com palavra-chave, dispara se o comentário
// CONTIVER a palavra (não precisa ser idêntico); sem palavra-chave, dispara
// em qualquer comentário do post. Se houver os dois tipos configurados pro
// mesmo post, a palavra-chave específica tem prioridade sobre o "qualquer".
async function findCommentTrigger(
  workspaceId: string,
  postId: string,
  text: string,
): Promise<{ id: string; flowId: string; publicReplyText: string | null } | null> {
  const candidates = await prisma.postTrigger.findMany({
    where: { workspaceId, type: "comment", postId, active: true },
  });

  const byKeyword = candidates.find(
    (t) => t.keyword && text.toLowerCase().includes(t.keyword.toLowerCase()),
  );
  if (byKeyword) return byKeyword;

  return candidates.find((t) => !t.keyword) ?? null;
}

// RF (novo) — trigger de "DM com palavra-chave": dispara um flow pra quem manda
// DM direta contendo a palavra, sem precisar ter comentado em nenhum post.
async function tryStartFromDmKeyword(workspaceId: string, contactId: string, text: string): Promise<void> {
  const candidates = await prisma.postTrigger.findMany({
    where: { workspaceId, type: "dm_keyword", active: true, keyword: { not: null } },
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

// RF15 — follow gate: se o botão clicado exige seguir a conta, só avança
// quando `checkFollowStatus` confirma. Do contrário reenvia o mesmo prompt
// (não avança currentNode) pra dar outra chance, igual documentado no
// OpenReply — nunca trava um seguidor de verdade (fail-open no service).
async function advanceToButtonTarget(account: InstagramAccount, flowRunId: string, payload: string): Promise<void> {
  const run = await prisma.flowRun.findUniqueOrThrow({
    where: { id: flowRunId },
    include: { flow: true, contact: true },
  });
  const definition = run.flow.definition as unknown as { nodes: FlowNode[] };
  const currentNode = definition.nodes.find((n) => n.id === run.currentNode);
  const options = (currentNode?.options as ButtonOption[] | undefined) ?? [];
  const clicked = options.find((o) => o.next === payload);

  if (clicked?.followGate && !(await checkFollowStatus(account, run.contact.igsid))) {
    await prisma.message.create({
      data: {
        contactId: run.contact.id,
        direction: "blocked",
        content: `[follow gate] node ${currentNode?.id ?? run.currentNode}`,
        status: "follow_gate_pending",
        reason: "contato ainda não segue a conta — reenviando o prompt (RF15)",
      },
    });
    // payload do postback é o id do node de destino, definido no node "buttons"
    // (ver frontend/components/flow-editor — cada botão carrega seu next node).
    await prisma.flowRun.update({ where: { id: flowRunId }, data: { status: "running" } });
    await advanceFlowRun(flowRunId); // reexecuta o node atual (não avançou currentNode) — reenvia o CTA
    return;
  }

  await prisma.flowRun.update({ where: { id: flowRunId }, data: { currentNode: payload, status: "running" } });
  await advanceFlowRun(flowRunId);
}
