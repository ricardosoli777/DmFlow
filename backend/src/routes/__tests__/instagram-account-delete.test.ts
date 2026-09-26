import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findAccount: vi.fn(),
  deleteAccount: vi.fn(),
  deleteZernioLink: vi.fn(),
  findZernioLink: vi.fn(),
  removeZernioWebhook: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@dmflow/db", () => ({
  getInstagramAccount: vi.fn(),
  listInstagramAccounts: vi.fn(),
  saveInstagramAccount: vi.fn(),
}));
vi.mock("../../lib/auth", () => ({ requireRole: () => async () => {} }));
vi.mock("../../lib/zernio-webhook", () => ({ removeZernioWebhook: mocks.removeZernioWebhook }));
vi.mock("../../lib/prisma", () => ({
  prisma: {
    instagramAccount: { findUnique: mocks.findAccount, delete: mocks.deleteAccount },
    zernioConnection: { findUnique: mocks.findZernioLink, deleteMany: mocks.deleteZernioLink },
    $transaction: mocks.transaction,
  },
}));

import { instagramAccountRoutes } from "../instagram-accounts";

describe("Instagram account removal", () => {
  it("removes the associated Zernio link in the same transaction", async () => {
    mocks.findAccount.mockResolvedValue({ id: "instagram-1", workspaceId: "workspace-1" });
    mocks.findZernioLink.mockResolvedValue({ id: "link-1" });
    mocks.removeZernioWebhook.mockResolvedValue(undefined);
    mocks.deleteZernioLink.mockResolvedValue({ count: 1 });
    mocks.deleteAccount.mockResolvedValue({ id: "instagram-1" });
    mocks.transaction.mockImplementation(async (operations: Promise<unknown>[]) => Promise.all(operations));
    const server = Fastify();
    server.addHook("preHandler", async (req) => { req.workspaceId = "workspace-1"; });
    await server.register(instagramAccountRoutes);
    try {
      const response = await server.inject({ method: "DELETE", url: "/instagram-accounts/instagram-1" });
      expect(response.statusCode).toBe(204);
      expect(mocks.deleteZernioLink).toHaveBeenCalledWith({ where: { workspaceId: "workspace-1", instagramAccountId: "instagram-1" } });
      expect(mocks.removeZernioWebhook).toHaveBeenCalledWith("link-1");
      expect(mocks.deleteAccount).toHaveBeenCalledWith({ where: { id: "instagram-1" } });
      expect(mocks.transaction).toHaveBeenCalledOnce();
    } finally {
      await server.close();
    }
  });
});
