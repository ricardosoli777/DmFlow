import type { Prisma } from "@dmflow/db";
import { getPrisma } from "@dmflow/db";
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
    include: { flow: true, contact: true },
  });

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
