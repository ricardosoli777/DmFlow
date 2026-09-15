import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@dmflow/db", () => {
  const prisma = { flowRun: { findUniqueOrThrow: vi.fn(), update: vi.fn() } };
  return { getPrisma: () => prisma };
});

vi.mock("../../lib/queue", () => ({ flowResumeQueue: { add: vi.fn() } }));

vi.mock("../node-handlers", () => ({
  nodeHandlers: { delay: vi.fn(), message: vi.fn(), end: vi.fn() },
}));

import { getPrisma } from "@dmflow/db";
import { flowResumeQueue } from "../../lib/queue";
import { nodeHandlers } from "../node-handlers";
import { advanceFlowRun } from "../executor";

function mockRun(currentNode: string) {
  const prisma = getPrisma() as any;
  prisma.flowRun.findUniqueOrThrow.mockResolvedValue({
    id: "run-1",
    currentNode,
    context: {},
    contact: { id: "contact-1", igsid: "IGSID1", instagramAccount: { id: "account-1", igUserId: "OWN_IG_USER_ID" } },
    flow: {
      definition: {
        start: "n1",
        nodes: [
          { id: "n1", type: "delay" },
          { id: "n2", type: "message" },
          { id: "n3", type: "end" },
        ],
      },
    },
  });
  return prisma;
}

describe("advanceFlowRun — pausa/retomada agendada (RF05, node delay)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("node delay: marca o flow_run como 'scheduled' no próximo node e agenda a retomada, sem executar o próximo node agora", async () => {
    const prisma = mockRun("n1");
    vi.mocked(nodeHandlers.delay).mockResolvedValue({ nextNodeId: "n2", waitingForInput: false, delayMs: 60_000 });

    await advanceFlowRun("run-1");

    expect(prisma.flowRun.update).toHaveBeenCalledWith({
      where: { id: "run-1" },
      data: { currentNode: "n2", status: "scheduled" },
    });
    expect(flowResumeQueue.add).toHaveBeenCalledWith("resume", { flowRunId: "run-1" }, { delay: 60_000 });
    expect(nodeHandlers.message).not.toHaveBeenCalled();
  });

  it("resumeNodeId (ex: retry de rate limit) tem prioridade sobre nextNodeId", async () => {
    const prisma = mockRun("n2");
    vi.mocked(nodeHandlers.message).mockResolvedValue({
      nextNodeId: null,
      waitingForInput: false,
      delayMs: 3_600_000,
      resumeNodeId: "n2",
    });

    await advanceFlowRun("run-1");

    expect(prisma.flowRun.update).toHaveBeenCalledWith({
      where: { id: "run-1" },
      data: { currentNode: "n2", status: "scheduled" },
    });
    expect(flowResumeQueue.add).toHaveBeenCalledWith("resume", { flowRunId: "run-1" }, { delay: 3_600_000 });
  });

  it("delayMs sem nextNodeId nem resumeNodeId: encerra o flow_run em vez de travar pra sempre", async () => {
    const prisma = mockRun("n1");
    vi.mocked(nodeHandlers.delay).mockResolvedValue({ nextNodeId: null, waitingForInput: false, delayMs: 5_000 });

    await advanceFlowRun("run-1");

    expect(prisma.flowRun.update).toHaveBeenCalledWith({
      where: { id: "run-1" },
      data: { currentNode: "n1", status: "done" },
    });
    expect(flowResumeQueue.add).not.toHaveBeenCalled();
  });

  it("node sem delayMs continua o loop normalmente até o end", async () => {
    const prisma = mockRun("n2");
    vi.mocked(nodeHandlers.message).mockResolvedValue({ nextNodeId: "n3", waitingForInput: false });
    vi.mocked(nodeHandlers.end).mockResolvedValue({ nextNodeId: null, waitingForInput: false });

    await advanceFlowRun("run-1");

    expect(flowResumeQueue.add).not.toHaveBeenCalled();
    expect(prisma.flowRun.update).toHaveBeenLastCalledWith({
      where: { id: "run-1" },
      data: { currentNode: "n3", status: "done" },
    });
  });
});
