import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listAccounts: vi.fn(),
  findConnection: vi.fn(),
  checkMeta: vi.fn(),
  checkZernio: vi.fn(),
}));

vi.mock("@dmflow/db", () => ({ listInstagramAccounts: mocks.listAccounts }));
vi.mock("../../lib/prisma", () => ({
  prisma: {
    rawEvent: { findFirst: vi.fn().mockResolvedValue(null), count: vi.fn().mockResolvedValue(0) },
    zernioConnection: { findMany: mocks.findConnection },
  },
}));
vi.mock("../../lib/queue", () => ({ instagramEventsQueue: { getJobCounts: vi.fn().mockResolvedValue({}) } }));
vi.mock("../instagram-accounts", () => ({ checkInstagramConnection: mocks.checkMeta }));
vi.mock("../zernio", () => ({ checkZernioConnection: mocks.checkZernio }));

import { metricsRoutes } from "../metrics";

beforeEach(() => {
  mocks.listAccounts.mockReset().mockResolvedValue([{
    id: "instagram-1",
    igUsername: "example",
    pageAccessToken: "",
    igUserId: "pending-1",
    graphApiVersion: "v21.0",
  }]);
  mocks.findConnection.mockReset().mockResolvedValue([]);
  mocks.checkMeta.mockReset().mockResolvedValue({ connected: false, error: "Faltam credenciais" });
  mocks.checkZernio.mockReset().mockResolvedValue({ connected: true, username: "example" });
});

async function health() {
  const server = Fastify();
  server.addHook("preHandler", async (req) => { req.workspaceId = "workspace-1"; });
  await server.register(metricsRoutes);
  try {
    const response = await server.inject({ method: "GET", url: "/metrics/health" });
    expect(response.statusCode).toBe(200);
    return response.json().accounts[0];
  } finally {
    await server.close();
  }
}

describe("dashboard connection health", () => {
  it("uses the Zernio API check for an account linked through Zernio", async () => {
    mocks.findConnection.mockResolvedValue([{ instagramAccountId: "instagram-1", accountId: "zernio-1", keySlot: "primary", username: "example" }]);
    expect(await health()).toEqual({
      id: "instagram-1",
      igUsername: "example",
      connectionMethod: "zernio",
      zernioKeySlot: "primary",
      connected: true,
      providerHealthy: true,
      username: "example",
    });
    expect(mocks.checkZernio).toHaveBeenCalledWith("workspace-1", "zernio-1", "primary");
    expect(mocks.checkMeta).not.toHaveBeenCalled();
  });

  it("keeps a linked account visible but flags a temporary Zernio validation failure", async () => {
    mocks.findConnection.mockResolvedValue([{ instagramAccountId: "instagram-1", accountId: "zernio-2", keySlot: "secondary", username: "example" }]);
    mocks.checkZernio.mockResolvedValue({ connected: false, error: "Não foi possível validar a conexão com o Zernio" });
    expect(await health()).toEqual({
      id: "instagram-1",
      igUsername: "example",
      connectionMethod: "zernio",
      zernioKeySlot: "secondary",
      connected: true,
      providerHealthy: false,
      username: "example",
      error: "Não foi possível validar a conexão com o Zernio",
    });
    expect(mocks.checkZernio).toHaveBeenCalledWith("workspace-1", "zernio-2", "secondary");
  });

  it("continues to check Meta for accounts without a Zernio link", async () => {
    expect(await health()).toEqual({
      id: "instagram-1",
      igUsername: "example",
      connectionMethod: "meta",
      connected: false,
      error: "Faltam credenciais",
    });
    expect(mocks.checkMeta).toHaveBeenCalled();
    expect(mocks.checkZernio).not.toHaveBeenCalled();
  });
});
