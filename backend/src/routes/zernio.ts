import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { decryptCredential, encryptCredential } from "@dmflow/db";
import { env } from "../env";
import { requireAuth, requireRole } from "../lib/auth";
import { prisma } from "../lib/prisma";

const connectResponse = z.object({ authUrl: z.string().url() });
type ZernioAccount = { _id: string; platform: string; username?: string; profileId?: string | { _id: string } };

function instagramAccount(account: ZernioAccount) {
  const profileId = typeof account.profileId === "string" ? account.profileId : account.profileId?._id;
  return { accountId: account._id, profileId, username: account.username ?? "", platform: account.platform };
}

class ZernioHttpError extends Error {
  constructor(readonly status: number) {
    super(`Zernio HTTP ${status}`);
  }
}

async function workspaceApiKey(workspaceId: string): Promise<string> {
  const stored = await prisma.zernioApiKey.findUnique({ where: { workspaceId } });
  return stored ? decryptCredential(stored.apiKey) : env.ZERNIO_API_KEY;
}

async function zernio<T>(apiKey: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`https://zernio.com/api/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json", ...(init?.headers ?? {}) },
  });
  if (!response.ok) throw new ZernioHttpError(response.status);
  return response.json() as Promise<T>;
}

export async function checkZernioConnection(workspaceId: string, accountId: string): Promise<{ connected: boolean; username?: string; error?: string }> {
  try {
    const apiKey = await workspaceApiKey(workspaceId);
    if (!apiKey) return { connected: false, error: "Chave de API do Zernio não configurada" };
    const available = await zernio<{ accounts?: ZernioAccount[] }>(apiKey, "/accounts", { signal: AbortSignal.timeout(10_000) });
    const account = available.accounts?.find((item) => item._id === accountId && item.platform === "instagram");
    return account
      ? { connected: true, username: account.username }
      : { connected: false, error: "Conta Instagram não encontrada no Zernio" };
  } catch {
    return { connected: false, error: "Não foi possível validar a conexão com o Zernio" };
  }
}

export async function zernioRoutes(app: FastifyInstance) {
  app.get("/zernio-api-key", { preHandler: requireAuth }, async (req) => {
    const stored = await prisma.zernioApiKey.findUnique({ where: { workspaceId: req.workspaceId }, select: { workspaceId: true } });
    return {
      configured: Boolean(stored || env.ZERNIO_API_KEY),
      canManage: req.role === "OWNER" || req.role === "ADMIN",
    };
  });

  app.put("/zernio-api-key", { preHandler: [requireAuth, requireRole("OWNER", "ADMIN")] }, async (req, reply) => {
    const { apiKey } = z.object({ apiKey: z.string().trim().min(1) }).parse(req.body);
    try {
      await zernio(apiKey, "/accounts");
    } catch (error) {
      const invalid = error instanceof ZernioHttpError && (error.status === 401 || error.status === 403);
      return reply.status(invalid ? 400 : 502).send({ error: invalid ? "Chave Zernio inválida ou sem acesso" : "Não foi possível validar a chave no Zernio" });
    }
    const encrypted = encryptCredential(apiKey);
    await prisma.zernioApiKey.upsert({
      where: { workspaceId: req.workspaceId },
      update: { apiKey: encrypted },
      create: { workspaceId: req.workspaceId, apiKey: encrypted },
    });
    return { configured: true, connected: true };
  });

  app.post("/zernio-api-key/test", { preHandler: [requireAuth, requireRole("OWNER", "ADMIN")] }, async (req) => {
    const apiKey = await workspaceApiKey(req.workspaceId);
    if (!apiKey) return { configured: false, connected: false };
    try {
      await zernio(apiKey, "/accounts");
      return { configured: true, connected: true };
    } catch {
      return { configured: true, connected: false };
    }
  });

  app.get("/zernio-connection", { preHandler: requireAuth }, async (req) => {
    const connection = await prisma.zernioConnection.findUnique({ where: { workspaceId: req.workspaceId } });
    return connection ? { connected: true, accountId: connection.accountId, username: connection.username, profileId: connection.profileId } : { connected: false };
  });

  app.get("/zernio-accounts", { preHandler: [requireAuth, requireRole("OWNER", "ADMIN")] }, async (req, reply) => {
    const apiKey = await workspaceApiKey(req.workspaceId);
    if (!apiKey) return reply.status(503).send({ error: "Configure a chave de API do Zernio em Configurações" });
    const available = await zernio<{ accounts?: ZernioAccount[] }>(apiKey, "/accounts");
    const current = await prisma.zernioConnection.findUnique({ where: { workspaceId: req.workspaceId } });
    return {
      accounts: (available.accounts ?? []).filter((account) => account.platform === "instagram").map(instagramAccount),
      connectedAccountId: current?.accountId ?? null,
    };
  });

  app.post("/zernio-accounts/select", { preHandler: [requireAuth, requireRole("OWNER", "ADMIN")] }, async (req, reply) => {
    const apiKey = await workspaceApiKey(req.workspaceId);
    if (!apiKey) return reply.status(503).send({ error: "Configure a chave de API do Zernio em Configurações" });
    const body = z.object({ accountId: z.string().min(1), instagramAccountId: z.string().min(1) }).parse(req.body);
    const targetAccount = await prisma.instagramAccount.findFirst({ where: { id: body.instagramAccountId, workspaceId: req.workspaceId } });
    if (!targetAccount) return reply.status(404).send({ error: "Conta Instagram do DMFlow não encontrada" });
    const available = await zernio<{ accounts?: ZernioAccount[] }>(apiKey, "/accounts");
    const account = (available.accounts ?? []).find((item) => item._id === body.accountId && item.platform === "instagram");
    if (!account) return reply.status(404).send({ error: "Conta Instagram não encontrada no Zernio" });
    const selected = instagramAccount(account);
    if (!selected.profileId) return reply.status(422).send({ error: "Essa conta do Zernio não possui um perfil válido" });
    await prisma.zernioConnection.upsert({
      where: { workspaceId: req.workspaceId },
      update: { profileId: selected.profileId, accountId: selected.accountId, instagramAccountId: body.instagramAccountId, username: selected.username },
      create: { workspaceId: req.workspaceId, profileId: selected.profileId, accountId: selected.accountId, instagramAccountId: body.instagramAccountId, username: selected.username },
    });
    return { connected: true, accountId: selected.accountId, username: selected.username };
  });

  app.get("/oauth/zernio/start", { preHandler: [requireAuth, requireRole("OWNER", "ADMIN")] }, async (req, reply) => {
    const apiKey = await workspaceApiKey(req.workspaceId);
    if (!apiKey) return reply.status(503).send({ error: "Configure a chave de API do Zernio em Configurações" });
    const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: req.workspaceId } });
    const available = await zernio<{ accounts?: ZernioAccount[] }>(apiKey, "/accounts");
    const instagramAccounts = (available.accounts ?? []).filter((account) => account.platform === "instagram");
    let connection = await prisma.zernioConnection.findUnique({ where: { workspaceId: req.workspaceId } });
    let profileId = connection?.profileId;
    if (!profileId) {
      const listed = await zernio<{ profiles?: Array<{ _id: string; name: string }> }>(apiKey, "/profiles");
      const existing = listed.profiles?.find((profile) => profile.name === `DMFlow — ${workspace.name}`);
      if (existing) profileId = existing._id;
      else {
        const created = await zernio<{ profile: { _id: string } }>(apiKey, "/profiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: `DMFlow — ${workspace.name}` }) });
        profileId = created.profile._id;
      }
    }
    const state = app.jwt.sign({ workspaceId: req.workspaceId, userId: req.userId, profileId }, { expiresIn: "10m" });
    const redirect = `${env.PUBLIC_API_URL}/oauth/zernio/callback?state=${encodeURIComponent(state)}`;
    const params = new URLSearchParams({ profileId, redirect_url: redirect });
    const result = await zernio<{ data?: { authUrl: string }; authUrl?: string }>(apiKey, `/connect/instagram?${params}`);
    const authUrl = result.authUrl ?? result.data?.authUrl;
    if (!authUrl) return reply.status(502).send({ error: "Zernio não retornou URL de conexão" });
    return connectResponse.parse({ authUrl });
  });

  app.get("/oauth/zernio/callback", async (req, reply) => {
    const q = req.query as { state?: string; connected?: string; accountId?: string; profileId?: string; username?: string; error?: string };
    const redirect = (ok: boolean) => reply.code(302).header("location", `${env.PUBLIC_APP_URL}/settings?zernio=${ok ? "success" : "error"}`).send();
    if (q.error || !q.state || q.connected !== "instagram" || !q.accountId || !q.profileId) return redirect(false);
    try {
      const state = app.jwt.verify(q.state) as { workspaceId: string; profileId: string };
      if (state.profileId !== q.profileId) return redirect(false);
      await prisma.zernioConnection.upsert({ where: { workspaceId: state.workspaceId }, update: { profileId: q.profileId, accountId: q.accountId, username: q.username ?? "" }, create: { workspaceId: state.workspaceId, profileId: q.profileId, accountId: q.accountId, username: q.username ?? "" } });
      return redirect(true);
    } catch { return redirect(false); }
  });
}
