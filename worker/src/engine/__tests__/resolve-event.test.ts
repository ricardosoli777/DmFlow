import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@dmflow/db", () => {
  const prisma = {
    contact: { upsert: vi.fn(), update: vi.fn() },
    message: { create: vi.fn() },
    postTrigger: { findMany: vi.fn(), update: vi.fn() },
    flowRun: { findFirst: vi.fn(), findUniqueOrThrow: vi.fn(), create: vi.fn(), update: vi.fn() },
    flow: { findUniqueOrThrow: vi.fn() },
  };
  return { getPrisma: () => prisma };
});

vi.mock("../executor", () => ({ advanceFlowRun: vi.fn() }));

vi.mock("../../services/instagram", () => ({
  fetchInstagramProfile: vi.fn(async () => null),
  interpolate: vi.fn((text: string) => text),
  sendPublicCommentReply: vi.fn(),
  checkFollowStatus: vi.fn(async () => true),
}));

import { getPrisma } from "@dmflow/db";
import { checkFollowStatus } from "../../services/instagram";
import { resolveEvent } from "../resolve-event";

const account = { id: "account-1", workspaceId: "workspace-1", igUserId: "OWN_IG_USER_ID" } as any;

describe("resolveEvent — filtro de auto-comentário (RF13)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ignora comentário feito pela própria conta conectada, sem criar contact", async () => {
    const prisma = getPrisma() as any;

    await resolveEvent(
      {
        kind: "comment",
        postId: "post-1",
        commentId: "comment-1",
        fromIgsid: "OWN_IG_USER_ID",
        fromName: "minha_conta",
        text: "testando meu próprio post",
      },
      account,
    );

    expect(prisma.contact.upsert).not.toHaveBeenCalled();
    expect(prisma.postTrigger.findMany).not.toHaveBeenCalled();
  });

  it("processa normalmente um comentário de outra pessoa", async () => {
    const prisma = getPrisma() as any;
    prisma.contact.upsert.mockResolvedValue({
      id: "contact-1",
      igsid: "OTHER_IGSID",
      name: "Fulano",
      username: "fulano",
    });
    prisma.postTrigger.findMany.mockResolvedValue([]);

    await resolveEvent(
      {
        kind: "comment",
        postId: "post-1",
        commentId: "comment-2",
        fromIgsid: "OTHER_IGSID",
        fromName: "fulano",
        text: "quero o link",
      },
      account,
    );

    expect(prisma.contact.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.message.create).toHaveBeenCalledTimes(1);
  });
});

describe("advanceToButtonTarget — follow gate (RF15)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockWaitingRun(options: Array<{ label: string; next?: string; followGate?: boolean }>) {
    const prisma = getPrisma() as any;
    prisma.contact.upsert.mockResolvedValue({
      id: "contact-1",
      igsid: "OTHER_IGSID",
      name: "Fulano",
      username: "fulano",
    });
    prisma.flowRun.findFirst.mockResolvedValue({ id: "run-1", contactId: "contact-1", status: "waiting" });
    prisma.flowRun.findUniqueOrThrow.mockResolvedValue({
      id: "run-1",
      currentNode: "n1",
      contact: { id: "contact-1", igsid: "OTHER_IGSID" },
      flow: { definition: { nodes: [{ id: "n1", type: "buttons", options }] } },
    });
    return prisma;
  }

  it("botão com followGate e contato ainda não seguindo: reenvia o prompt sem avançar currentNode", async () => {
    vi.mocked(checkFollowStatus).mockResolvedValue(false);
    const prisma = mockWaitingRun([{ label: "Quero o link", next: "n2", followGate: true }]);

    await resolveEvent({ kind: "postback", fromIgsid: "OTHER_IGSID", text: "n2" }, account);

    expect(prisma.flowRun.update).toHaveBeenCalledWith({ where: { id: "run-1" }, data: { status: "running" } });
    expect(prisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "follow_gate_pending" }) }),
    );
  });

  it("botão com followGate e contato já seguindo: avança normalmente pro next", async () => {
    vi.mocked(checkFollowStatus).mockResolvedValue(true);
    const prisma = mockWaitingRun([{ label: "Quero o link", next: "n2", followGate: true }]);

    await resolveEvent({ kind: "postback", fromIgsid: "OTHER_IGSID", text: "n2" }, account);

    expect(prisma.flowRun.update).toHaveBeenCalledWith({
      where: { id: "run-1" },
      data: { currentNode: "n2", status: "running" },
    });
  });

  it("botão sem followGate avança direto, sem checar follow status", async () => {
    const prisma = mockWaitingRun([{ label: "Quero o link", next: "n2" }]);

    await resolveEvent({ kind: "postback", fromIgsid: "OTHER_IGSID", text: "n2" }, account);

    expect(checkFollowStatus).not.toHaveBeenCalled();
    expect(prisma.flowRun.update).toHaveBeenCalledWith({
      where: { id: "run-1" },
      data: { currentNode: "n2", status: "running" },
    });
  });
});
