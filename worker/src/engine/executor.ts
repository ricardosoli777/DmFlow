import { getPrisma } from "@dmflow/db";
import type { FlowNode } from "./node-handlers";
import { nodeHandlers } from "./node-handlers";

const prisma = getPrisma();

// RF04 — máquina de estados: executa o node atual do flow_run e avança.
export async function advanceFlowRun(flowRunId: string): Promise<void> {
  const run = await prisma.flowRun.findUniqueOrThrow({
    where: { id: flowRunId },
    include: { flow: true, contact: true },
  });

  const definition = run.flow.definition as unknown as { nodes: FlowNode[] };
  let currentNodeId: string | null = run.currentNode;

  while (currentNodeId) {
    const node = definition.nodes.find((n) => n.id === currentNodeId);
    if (!node) break;

    const handler = nodeHandlers[node.type];
    const result = await handler(node, run, run.contact);

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
