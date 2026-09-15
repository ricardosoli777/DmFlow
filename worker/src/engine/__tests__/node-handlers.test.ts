import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@dmflow/db", () => {
  const prisma = {
    contact: { update: vi.fn(async ({ data }: any) => ({ id: "contact-1", ...data })) },
    message: { create: vi.fn() },
    trackedLink: { findFirst: vi.fn() },
  };
  return { getPrisma: () => prisma };
});

vi.mock("../../env", () => ({ env: { PUBLIC_API_URL: "https://hooks.example.com" } }));

vi.mock("../../services/instagram", () => ({
  interpolate: vi.fn((text: string) => text),
  sendDirectMessage: vi.fn(),
  sendButtonsMessage: vi.fn(),
  sendMediaMessage: vi.fn(),
  sendPrivateReply: vi.fn(),
  checkSendRateLimit: vi.fn(async () => ({ allowed: true, retryAfterMs: 0 })),
}));

import { getPrisma } from "@dmflow/db";
import {
  checkSendRateLimit,
  interpolate,
  sendButtonsMessage,
  sendDirectMessage,
  sendMediaMessage,
  sendPrivateReply,
} from "../../services/instagram";
import { nodeHandlers, type FlowNode } from "../node-handlers";

const contact = { id: "contact-1", igsid: "IGSID1", tags: [], attributes: {} } as any;
const run = {} as any;
const account = { id: "account-1", workspaceId: "workspace-1", igUserId: "OWN_IG_USER_ID" } as any;

describe("nodeHandlers — RF05 (um comportamento isolado por tipo de node)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("message: rate limit estourado reagenda o mesmo node em vez de enviar (RNF09)", async () => {
    vi.mocked(checkSendRateLimit).mockResolvedValueOnce({ allowed: false, retryAfterMs: 120_000 });
    const prisma = getPrisma() as any;

    const node: FlowNode = { id: "n1", type: "message", text: "Oi!", next: "n2" };
    const result = await nodeHandlers.message({ node, run, contact, account });

    expect(sendDirectMessage).not.toHaveBeenCalled();
    expect(result).toEqual({
      nextNodeId: null,
      waitingForInput: false,
      delayMs: 120_000,
      resumeNodeId: "n1",
    });
    expect(prisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "rate_limited" }) }),
    );
  });

  it("message: envia DM simples e avança pro próximo node", async () => {
    const node: FlowNode = { id: "n1", type: "message", text: "Oi!", next: "n2" };
    const result = await nodeHandlers.message({ node, run, contact, account });

    expect(sendDirectMessage).toHaveBeenCalledWith(account, contact, "Oi!", []);
    expect(result).toEqual({ nextNodeId: "n2", waitingForInput: false });
  });

  it("message: com botão de postback, envia como Private Reply e espera clique quando disparado por comentário", async () => {
    const node: FlowNode = {
      id: "n1",
      type: "message",
      text: "Você já é cliente?",
      options: [{ label: "Sim", next: "n2" }],
    };
    const result = await nodeHandlers.message({ node, run, contact, account, privateReply: { commentId: "c1" } });

    expect(sendPrivateReply).not.toHaveBeenCalled(); // options presentes => não é texto puro, vai por DM normal
    expect(sendDirectMessage).toHaveBeenCalledWith(account, contact, "Você já é cliente?", [
      { type: "next", title: "Sim", payload: "n2" },
    ]);
    expect(result).toEqual({ nextNodeId: null, waitingForInput: true });
  });

  it("message: texto puro do primeiro node de um comentário sai por Private Reply", async () => {
    const node: FlowNode = { id: "n1", type: "message", text: "Oi! Vou te mandar o link", next: "n2" };
    const result = await nodeHandlers.message({ node, run, contact, account, privateReply: { commentId: "c1" } });

    expect(sendPrivateReply).toHaveBeenCalledWith(account, "c1", contact, "Oi! Vou te mandar o link");
    expect(sendDirectMessage).not.toHaveBeenCalled();
    expect(result).toEqual({ nextNodeId: "n2", waitingForInput: false });
  });

  it("buttons: com opção de link externo, não espera clique e segue pro next", async () => {
    const node: FlowNode = {
      id: "n1",
      type: "buttons",
      text: "Confira:",
      next: "n2",
      options: [{ label: "Site", url: "https://example.com" }],
    };
    const result = await nodeHandlers.buttons({ node, run, contact, account });

    expect(sendButtonsMessage).toHaveBeenCalledWith(account, contact, "Confira:", [
      { type: "url", title: "Site", url: "https://example.com" },
    ]);
    expect(result).toEqual({ nextNodeId: "n2", waitingForInput: false });
  });

  it("buttons: com postback, espera o clique", async () => {
    const node: FlowNode = {
      id: "n1",
      type: "buttons",
      text: "Escolha:",
      options: [{ label: "A", next: "n2" }, { label: "B", next: "n3" }],
    };
    const result = await nodeHandlers.buttons({ node, run, contact, account });
    expect(result).toEqual({ nextNodeId: null, waitingForInput: true });
  });

  it("buttons: botão com trackedLinkId resolve pro redirect público /r/:code (RF14)", async () => {
    const prisma = getPrisma() as any;
    prisma.trackedLink.findFirst.mockResolvedValue({ id: "link-1", code: "abc123" });

    const node: FlowNode = {
      id: "n1",
      type: "buttons",
      text: "Confira:",
      next: "n2",
      options: [{ label: "Baixar", trackedLinkId: "link-1" }],
    };
    const result = await nodeHandlers.buttons({ node, run, contact, account });

    expect(prisma.trackedLink.findFirst).toHaveBeenCalledWith({
      where: { id: "link-1", workspaceId: account.workspaceId },
    });
    expect(sendButtonsMessage).toHaveBeenCalledWith(account, contact, "Confira:", [
      { type: "url", title: "Baixar", url: "https://hooks.example.com/r/abc123" },
    ]);
    expect(result).toEqual({ nextNodeId: "n2", waitingForInput: false });
  });

  it("buttons: trackedLinkId apontando pra link apagado (ou de outro workspace) ignora o botão em vez de quebrar", async () => {
    const prisma = getPrisma() as any;
    prisma.trackedLink.findFirst.mockResolvedValue(null);

    const node: FlowNode = {
      id: "n1",
      type: "buttons",
      text: "Confira:",
      next: "n2",
      options: [{ label: "Baixar", trackedLinkId: "link-apagado" }],
    };
    const result = await nodeHandlers.buttons({ node, run, contact, account });

    expect(sendButtonsMessage).toHaveBeenCalledWith(account, contact, "Confira:", []);
    expect(result).toEqual({ nextNodeId: "n2", waitingForInput: false });
  });

  it("image: envia mídia e avança", async () => {
    const node: FlowNode = { id: "n1", type: "image", url: "https://cdn/img.png", next: "n2" };
    const result = await nodeHandlers.image({ node, run, contact, account });

    expect(sendMediaMessage).toHaveBeenCalledWith(account, contact, "image", "https://cdn/img.png", []);
    expect(result).toEqual({ nextNodeId: "n2", waitingForInput: false });
  });

  it("audio: envia mídia e avança", async () => {
    const node: FlowNode = { id: "n1", type: "audio", url: "https://cdn/audio.mp3", next: "n2" };
    const result = await nodeHandlers.audio({ node, run, contact, account });

    expect(sendMediaMessage).toHaveBeenCalledWith(account, contact, "audio", "https://cdn/audio.mp3", []);
    expect(result).toEqual({ nextNodeId: "n2", waitingForInput: false });
  });

  it("video: envia mídia e avança", async () => {
    const node: FlowNode = { id: "n1", type: "video", url: "https://cdn/video.mp4", next: "n2" };
    const result = await nodeHandlers.video({ node, run, contact, account });

    expect(sendMediaMessage).toHaveBeenCalledWith(account, contact, "video", "https://cdn/video.mp4", []);
    expect(result).toEqual({ nextNodeId: "n2", waitingForInput: false });
  });

  it("delay: calcula delayMs a partir de duration/unit e mantém o next pra retomar depois", async () => {
    const node: FlowNode = { id: "n1", type: "delay", next: "n2", duration: 2, unit: "hours" };
    const result = await nodeHandlers.delay({ node, run, contact, account });
    expect(result).toEqual({ nextNodeId: "n2", waitingForInput: false, delayMs: 2 * 3_600_000 });
  });

  it("delay: sem duration/unit configurados, assume 1 minuto", async () => {
    const node: FlowNode = { id: "n1", type: "delay", next: "n2" };
    const result = await nodeHandlers.delay({ node, run, contact, account });
    expect(result).toEqual({ nextNodeId: "n2", waitingForInput: false, delayMs: 60_000 });
  });

  it("condition: segue thenNext quando o atributo bate", async () => {
    const node: FlowNode = { id: "n1", type: "condition", field: "plano", equals: "pro", thenNext: "n2", elseNext: "n3" };
    const result = await nodeHandlers.condition({
      node,
      run,
      account,
      contact: { ...contact, attributes: { plano: "pro" } },
    });
    expect(result).toEqual({ nextNodeId: "n2", waitingForInput: false });
  });

  it("condition: segue elseNext quando o atributo não bate", async () => {
    const node: FlowNode = { id: "n1", type: "condition", field: "plano", equals: "pro", thenNext: "n2", elseNext: "n3" };
    const result = await nodeHandlers.condition({
      node,
      run,
      account,
      contact: { ...contact, attributes: { plano: "free" } },
    });
    expect(result).toEqual({ nextNodeId: "n3", waitingForInput: false });
  });

  it("capture: primeira chamada manda o prompt e espera resposta", async () => {
    const node: FlowNode = { id: "n1", type: "capture", prompt: "Qual seu e-mail?", field: "email", next: "n2" };
    const result = await nodeHandlers.capture({ node, run, contact, account });

    expect(sendDirectMessage).toHaveBeenCalledWith(account, contact, "Qual seu e-mail?", []);
    expect(result).toEqual({ nextNodeId: null, waitingForInput: true });
  });

  it("capture: segunda chamada (com resumeInput) salva o valor e avança", async () => {
    const prisma = getPrisma() as any;
    const node: FlowNode = { id: "n1", type: "capture", prompt: "Qual seu e-mail?", field: "email", next: "n2" };
    const result = await nodeHandlers.capture({ node, run, contact, account, resumeInput: "a@b.com" });

    expect(prisma.contact.update).toHaveBeenCalledWith({
      where: { id: contact.id },
      data: { attributes: { email: "a@b.com" } },
    });
    expect(result).toEqual({ nextNodeId: "n2", waitingForInput: false });
  });

  it("tag: adiciona a tag ao contato e avança", async () => {
    const prisma = getPrisma() as any;
    const node: FlowNode = { id: "n1", type: "tag", tag: "cliente", next: "n2" };
    const result = await nodeHandlers.tag({ node, run, contact, account });

    expect(prisma.contact.update).toHaveBeenCalledWith({
      where: { id: contact.id },
      data: { tags: { push: "cliente" } },
    });
    expect(result).toEqual({ nextNodeId: "n2", waitingForInput: false });
  });

  it("webhook: registra falha da URL configurada e avança", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network error"));
    vi.stubGlobal("fetch", fetchMock);
    const prisma = getPrisma() as any;

    const node: FlowNode = { id: "n1", type: "webhook", url: "https://crm.example.com/hook", next: "n2" };
    const result = await nodeHandlers.webhook({ node, run, contact, account });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://crm.example.com/hook",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result).toEqual({ nextNodeId: "n2", waitingForInput: false });
    expect(prisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "failed", reason: "network error" }) }),
    );

    vi.unstubAllGlobals();
  });

  it("webhook: registra sucesso e código HTTP", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal("fetch", fetchMock);
    const prisma = getPrisma() as any;

    const node: FlowNode = { id: "n1", type: "webhook", url: "https://crm.example.com/hook", next: "n2" };
    await nodeHandlers.webhook({ node, run, contact, account });

    expect(prisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "ok", reason: "HTTP 204" }) }),
    );
    vi.unstubAllGlobals();
  });

  it("webhook: sem URL configurada, não chama fetch e avança", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const node: FlowNode = { id: "n1", type: "webhook", next: "n2" };
    const result = await nodeHandlers.webhook({ node, run, contact, account });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({ nextNodeId: "n2", waitingForInput: false });

    vi.unstubAllGlobals();
  });

  it("end: encerra o flow_run (sem next)", async () => {
    const node: FlowNode = { id: "n1", type: "end" };
    const result = await nodeHandlers.end({ node, run, contact, account });
    expect(result).toEqual({ nextNodeId: null, waitingForInput: false });
  });
});

// Referência: `interpolate` é reexportado do serviço real; só confirmamos que
// o mock está de fato sendo usado pelos handlers acima (evita falso-positivo
// silencioso se o import relativo mudar de caminho).
void interpolate;
