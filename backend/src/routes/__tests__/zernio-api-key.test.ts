import Fastify from "fastify";
import { decryptCredential, encryptCredential } from "@dmflow/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findKey: vi.fn(),
  upsertKey: vi.fn(),
  findConnection: vi.fn(),
}));

vi.mock("../../lib/prisma", () => ({
  prisma: {
    zernioApiKey: { findUnique: mocks.findKey, upsert: mocks.upsertKey },
    zernioConnection: { findUnique: mocks.findConnection },
  },
}));

vi.mock("../../env", () => ({ env: { ZERNIO_API_KEY: "" } }));

vi.mock("../../lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/auth")>();
  return {
    ...actual,
    requireAuth: async (req: { workspaceId: string; role: string; userId: string; headers: Record<string, unknown> }) => {
      req.workspaceId = String(req.headers["x-workspace-id"] ?? "workspace-1");
      req.role = String(req.headers["x-test-role"] ?? "OWNER");
      req.userId = "user-1";
    },
  };
});

import { checkZernioConnection, zernioRoutes } from "../zernio";

const encryptionKey = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";
const previousKey = process.env.META_CREDENTIALS_ENCRYPTION_KEY;

beforeEach(() => {
  process.env.META_CREDENTIALS_ENCRYPTION_KEY = encryptionKey;
  mocks.findKey.mockReset().mockResolvedValue(null);
  mocks.upsertKey.mockReset().mockResolvedValue({});
  mocks.findConnection.mockReset().mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (previousKey === undefined) delete process.env.META_CREDENTIALS_ENCRYPTION_KEY;
  else process.env.META_CREDENTIALS_ENCRYPTION_KEY = previousKey;
});

async function app() {
  const server = Fastify();
  await server.register(zernioRoutes);
  return server;
}

describe("Zernio API key", () => {
  it("does not expose the saved key and denies members write access", async () => {
    mocks.findKey.mockResolvedValue({ workspaceId: "workspace-1" });
    const server = await app();
    try {
      const status = await server.inject({ method: "GET", url: "/zernio-api-key", headers: { "x-test-role": "MEMBER" } });
      expect(status.json()).toEqual({ configured: true, canManage: false });

      const update = await server.inject({ method: "PUT", url: "/zernio-api-key", headers: { "x-test-role": "MEMBER" }, payload: { apiKey: "secret-key" } });
      expect(update.statusCode).toBe(403);
      expect(mocks.upsertKey).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it("validates before saving and stores only ciphertext for the current workspace", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ accounts: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const server = await app();
    try {
      const response = await server.inject({ method: "PUT", url: "/zernio-api-key", headers: { "x-workspace-id": "workspace-2" }, payload: { apiKey: "secret-key" } });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ configured: true, connected: true });
      const stored = mocks.upsertKey.mock.calls[0][0];
      expect(stored.where).toEqual({ workspaceId: "workspace-2" });
      expect(stored.create.apiKey).toMatch(/^enc:v1:/);
      expect(decryptCredential(stored.create.apiKey)).toBe("secret-key");
      expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer secret-key");
    } finally {
      await server.close();
    }
  });

  it("rejects an invalid key without replacing the stored one", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 401 })));
    const server = await app();
    try {
      const response = await server.inject({ method: "PUT", url: "/zernio-api-key", payload: { apiKey: "bad-key" } });
      expect(response.statusCode).toBe(400);
      expect(response.body).not.toContain("bad-key");
      expect(mocks.upsertKey).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it("uses the saved workspace key when listing Zernio accounts", async () => {
    mocks.findKey.mockResolvedValue({ apiKey: encryptCredential("stored-key") });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ accounts: [] }), { status: 200 })));
    const server = await app();
    try {
      const response = await server.inject({ method: "GET", url: "/zernio-accounts", headers: { "x-workspace-id": "workspace-2" } });
      expect(response.statusCode).toBe(200);
      expect(mocks.findKey).toHaveBeenCalledWith({ where: { workspaceId: "workspace-2" } });
      expect((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].headers.Authorization).toBe("Bearer stored-key");
    } finally {
      await server.close();
    }
  });

  it("validates that the linked Instagram account is still available in Zernio", async () => {
    mocks.findKey.mockResolvedValue({ apiKey: encryptCredential("stored-key") });
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response(JSON.stringify({
      accounts: [{ _id: "zernio-account", platform: "instagram", username: "example" }],
    }), { status: 200 })));

    await expect(checkZernioConnection("workspace-1", "zernio-account")).resolves.toEqual({ connected: true, username: "example" });
    await expect(checkZernioConnection("workspace-1", "other-account")).resolves.toEqual({
      connected: false,
      error: "Conta Instagram não encontrada no Zernio",
    });
  });
});
