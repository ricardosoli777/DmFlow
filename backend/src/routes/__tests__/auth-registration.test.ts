import Fastify from "fastify";
import jwt from "@fastify/jwt";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUser: vi.fn(),
  findUserByEmail: vi.fn(),
  upsertUser: vi.fn(),
  createLink: vi.fn(),
  findLink: vi.fn(),
  consumeLink: vi.fn(),
  findMembership: vi.fn(),
  createWorkspace: vi.fn(),
  createMembership: vi.fn(),
  findMemberships: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("../../lib/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.findUser, findFirst: mocks.findUserByEmail, upsert: mocks.upsertUser },
    magicLinkToken: { create: mocks.createLink, findUnique: mocks.findLink, updateMany: mocks.consumeLink },
    workspaceMember: { findFirst: mocks.findMembership, create: mocks.createMembership, findMany: mocks.findMemberships },
    workspace: { create: mocks.createWorkspace },
  },
}));
vi.mock("../../env", () => ({ env: { PUBLIC_APP_URL: "http://localhost:3000" } }));
vi.mock("../../lib/email", () => ({ sendTransactionalEmail: mocks.sendEmail, magicLinkEmailHtml: (url: string) => url }));

import { authRoutes } from "../auth";

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.findUserByEmail.mockResolvedValue(null);
  mocks.createLink.mockResolvedValue({});
  mocks.sendEmail.mockResolvedValue(undefined);
  mocks.consumeLink.mockResolvedValue({ count: 1 });
  mocks.findMembership.mockResolvedValue({ id: "member-1" });
  mocks.findMemberships.mockResolvedValue([{ workspaceId: "workspace-1", workspace: { name: "Equipe" }, role: "MEMBER" }]);
});

async function createApp() {
  const app = Fastify();
  await app.register(jwt, { secret: "test-secret-123456789" });
  await app.register(authRoutes);
  return app;
}

describe("cadastro separado do login", () => {
  it("não envia link de login nem cria usuário para e-mail sem cadastro", async () => {
    mocks.findUserByEmail.mockResolvedValue(null);
    const app = await createApp();
    try {
      const response = await app.inject({ method: "POST", url: "/auth/magic-link", payload: { email: "novo@example.com" } });
      expect(response.json()).toEqual({ status: "registration_required" });
      expect(mocks.createLink).not.toHaveBeenCalled();
      expect(mocks.upsertUser).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("envia link de cadastro distinto para e-mail novo", async () => {
    mocks.findUserByEmail.mockResolvedValue(null);
    const app = await createApp();
    try {
      const response = await app.inject({ method: "POST", url: "/auth/register", payload: { email: "Novo@Example.com" } });
      expect(response.json()).toEqual({ status: "sent" });
      expect(mocks.createLink).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ email: "novo@example.com", purpose: "REGISTER" }) }));
      expect(mocks.sendEmail.mock.calls[0][2]).toContain("flow=register");
    } finally {
      await app.close();
    }
  });

  it("envia link de login para conta existente preservando o e-mail cadastrado", async () => {
    mocks.findUserByEmail.mockResolvedValue({ id: "user-1", email: "Pessoa@Example.com" });
    const app = await createApp();
    try {
      const response = await app.inject({ method: "POST", url: "/auth/magic-link", payload: { email: "pessoa@example.com" } });
      expect(response.json()).toEqual({ status: "sent" });
      expect(mocks.createLink).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ email: "Pessoa@Example.com", purpose: "LOGIN" }) }));
    } finally {
      await app.close();
    }
  });

  it("não inicia novo cadastro para conta existente", async () => {
    mocks.findUserByEmail.mockResolvedValue({ id: "user-1", email: "pessoa@example.com" });
    const app = await createApp();
    try {
      const response = await app.inject({ method: "POST", url: "/auth/register", payload: { email: "pessoa@example.com" } });
      expect(response.json()).toEqual({ status: "already_registered" });
      expect(mocks.createLink).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("não cria usuário ao verificar um link de login antigo sem conta", async () => {
    mocks.findLink.mockResolvedValue({ email: "novo@example.com", purpose: "LOGIN", usedAt: null, expiresAt: new Date(Date.now() + 60_000) });
    mocks.findUser.mockResolvedValue(null);
    const app = await createApp();
    try {
      const response = await app.inject({ method: "GET", url: "/auth/magic-link/verify?token=old-link" });
      expect(response.statusCode).toBe(400);
      expect(mocks.consumeLink).not.toHaveBeenCalled();
      expect(mocks.upsertUser).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("cria usuário ao verificar um link de cadastro", async () => {
    mocks.findLink.mockResolvedValue({ email: "novo@example.com", purpose: "REGISTER", usedAt: null, expiresAt: new Date(Date.now() + 60_000) });
    mocks.findUser.mockResolvedValue(null);
    mocks.upsertUser.mockResolvedValue({ id: "user-1", email: "novo@example.com" });
    const app = await createApp();
    try {
      const response = await app.inject({ method: "GET", url: "/auth/magic-link/verify?token=register-link&flow=register" });
      expect(response.statusCode).toBe(200);
      expect(mocks.upsertUser).toHaveBeenCalledOnce();
      expect(response.json()).toHaveProperty("token");
    } finally {
      await app.close();
    }
  });

  it("não aceita link de cadastro na verificação de login", async () => {
    mocks.findLink.mockResolvedValue({ email: "novo@example.com", purpose: "REGISTER", usedAt: null, expiresAt: new Date(Date.now() + 60_000) });
    const app = await createApp();
    try {
      const response = await app.inject({ method: "GET", url: "/auth/magic-link/verify?token=register-link" });
      expect(response.statusCode).toBe(400);
      expect(mocks.consumeLink).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});
