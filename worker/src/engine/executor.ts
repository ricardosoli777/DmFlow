import type { Prisma } from "@dmflow/db";
import { getPrisma } from "@dmflow/db";
import { flowResumeQueue } from "../lib/queue";
import type { FlowNode } from "./node-handlers";
import { nodeHandlers } from "./node-handlers";

const prisma = getPrisma();

type ResumeOptions = {
  /** Resposta livre do usuário, quando o flow_run estava "waiting" num node capture. */
  capturedText?: string;
};

type RunContext = { originCommentId?: string; pendingPrivateReply?: boolean; [key: string]: unknown };

// RF04 — máquina de estados: executa o node atual do flow_run e avança.
// Quando o flow_run estava "waiting" (ex: node capture), `options.capturedText`
// carrega a resposta do usuário pro handler do node atual antes de seguir.
export async function advanceFlowRun(flowRunId: string, options: ResumeOptions = {}): Promise<void> {
  const run = await prisma.flowRun.findUniqueOrThrow({
    where: { id: flowRunId },
    include: { flow: true, contact: { include: { instagramAccount: true } } },
  });

  // RF17 — sem conta resolvida não tem como saber com quais credenciais
  // enviar; nunca deveria acontecer pra um flow_run criado depois desta wave
  // (resolve-event.ts sempre associa a conta na criação do contato), mas
  // falha alto e visível (worker.on("failed")) em vez de mandar pra
  // Graph API nenhuma silenciosamente.
  if (!run.contact.instagramAccount) {
    throw new Error(`Contato ${run.contact.id} sem conta Instagram associada — não é possível enviar mensagens.`);
  }
  const account = run.contact.instagramAccount;

  const definition = run.flow.definition as unknown as { nodes: FlowNode[] };
  let currentNodeId: string | null = run.currentNode;
  let resumeInput = options.capturedText;
  let isFirstIteration = true;

  // Se o flow_run nasceu de um comentário, a primeira mensagem precisa sair
  // como Private Reply (endpoint que abre a thread de DM) em vez de uma DM
  // comum — a Meta pode recusar a primeira DM se a conversa nunca foi
  // aberta. Só vale pro primeiro node processado nesta run, uma única vez.
  const context = (run.context ?? {}) as RunContext;
  const privateReplyPending = Boolean(context.pendingPrivateReply && context.originCommentId);

  while (currentNodeId) {
    const node = definition.nodes.find((n) => n.id === currentNodeId);
    if (!node) break;

    const handler = nodeHandlers[node.type];
    const result = await handler({
      node,
      run,
      contact: run.contact,
      account,
      resumeInput: isFirstIteration ? resumeInput : undefined,
      privateReply: isFirstIteration && privateReplyPending ? { commentId: context.originCommentId as string } : undefined,
    });

    if (isFirstIteration && privateReplyPending) {
      await prisma.flowRun.update({
        where: { id: run.id },
        data: { context: { ...context, pendingPrivateReply: false } as Prisma.InputJsonValue },
      });
    }

    isFirstIteration = false;

    if (result.delayMs !== undefined) {
      // Node "delay" real (ou rate limit — Wave 6): pausa aqui e agenda a
      // retomada via job atrasado do BullMQ em vez de continuar o loop —
      // "scheduled" evita colidir com o "waiting" que resolve-event.ts usa
      // pra resumir input de usuário (ver worker/src/lib/queue.ts).
      const resumeNodeId = result.resumeNodeId ?? result.nextNodeId;
      if (!resumeNodeId) {
        await prisma.flowRun.update({ where: { id: run.id }, data: { currentNode: node.id, status: "done" } });
        return;
      }
      await prisma.flowRun.update({
        where: { id: run.id },
        data: { currentNode: resumeNodeId, status: "scheduled" },
      });
      await flowResumeQueue.add("resume", { flowRunId: run.id }, { delay: result.delayMs });
      return;
    }

    if (result.waitingForInput) {
      await prisma.flowRun.update({
        where: { id: run.id },
        data: { currentNode: node.id, status: "waiting" },
      });
      return;
    }

    if (node.type === "end" || !result.nextNodeId) {
      await prisma.flowRun.update({
        where: { id: run.id },
        data: { currentNode: node.id, status: "done" },
      });
      return;
    }

    currentNodeId = result.nextNodeId;
    await prisma.flowRun.update({
      where: { id: run.id },
      data: { currentNode: currentNodeId, status: "running" },
    });
  }
}
