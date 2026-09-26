import { createHmac } from "node:crypto";
import Fastify from "fastify";
import { encryptCredential } from "@dmflow/db";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connection: vi.fn(), event: vi.fn(), create: vi.fn(), enqueue: vi.fn(),
}));
vi.mock("../../lib/prisma", () => ({ prisma: {
  zernioConnection: { findUnique: mocks.connection },
  rawEvent: { findUnique: mocks.event, create: mocks.create },
} }));
vi.mock("../../lib/queue", () => ({ instagramEventsQueue: { add: mocks.enqueue } }));
vi.mock("@dmflow/db", async (importOriginal) => ({ ...await importOriginal<typeof import("@dmflow/db")>(), listAllInstagramAccounts: vi.fn() }));

import { webhookRoutes } from "../webhooks";

const encryptionKey = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";

beforeEach(() => {
  process.env.META_CREDENTIALS_ENCRYPTION_KEY = encryptionKey;
  mocks.connection.mockReset().mockResolvedValue({ id: "link-1", accountId: "account-1", workspaceId: "workspace-1", instagramAccountId: "instagram-1", webhookSecret: encryptCredential("webhook-secret") });
  mocks.event.mockReset().mockResolvedValue(null);
  mocks.create.mockReset().mockResolvedValue({ id: "event-1", processed: false });
  mocks.enqueue.mockReset().mockResolvedValue({});
});

async function server() {
  const app = Fastify();
  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (req, body, done) => {
    (req as any).rawBody = body;
    done(null, JSON.parse(body.toString()));
  });
  await app.register(webhookRoutes);
  return app;
}

describe("Zernio webhook", () => {
  it("rejeita assinatura inválida sem enfileirar", async () => {
    const app = await server();
    try {
      const response = await app.inject({ method: "POST", url: "/webhooks/zernio/link-1", headers: { "x-zernio-signature": "wrong" }, payload: { id: "z1", event: "message.received" } });
      expect(response.statusCode).toBe(401);
      expect(mocks.create).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });

  it("aceita evento assinado da conta correta e deduplica pelo ID do Zernio", async () => {
    const app = await server();
    try {
      const payload = JSON.stringify({ id: "z1", event: "message.received", account: { accountId: "account-1" } });
      const signature = createHmac("sha256", "webhook-secret").update(payload).digest("hex");
      const response = await app.inject({ method: "POST", url: "/webhooks/zernio/link-1", headers: { "content-type": "application/json", "x-zernio-signature": signature }, payload });
      expect(response.statusCode).toBe(200);
      expect(mocks.create).toHaveBeenCalledWith({ data: expect.objectContaining({ workspaceId: "workspace-1", dedupeKey: "zernio:z1" }) });
      expect(mocks.enqueue).toHaveBeenCalledWith("process-event", { eventId: "event-1" }, { jobId: "event-1" });
    } finally { await app.close(); }
  });
});
