import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../env";
import { requireAuth, requireRole } from "../lib/auth";
import { prisma } from "../lib/prisma";

const connectResponse = z.object({ authUrl: z.string().url() });

async function zernio<T>(path: string, init?: RequestInit): Promise<T> {
  if (!env.ZERNIO_API_KEY) throw new Error("Zernio não configurado no servidor");
  const response = await fetch(`https://zernio.com/api/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${env.ZERNIO_API_KEY}`, Accept: "application/json", ...(init?.headers ?? {}) },
  });
  const body = await response.json() as T & { error?: string; message?: string };
  if (!response.ok) throw new Error(body.message ?? body.error ?? `Zernio HTTP ${response.status}`);
  return body;
}

export async function zernioRoutes(app: FastifyInstance) {
  app.get("/zernio-connection", { preHandler: requireAuth }, async (req) => {
    const connection = await prisma.zernioConnection.findUnique({ where: { workspaceId: req.workspaceId } });
    return connection ? { connected: true, accountId: connection.accountId, username: connection.username, profileId: connection.profileId } : { connected: false };
  });

  app.get("/oauth/zernio/start", { preHandler: [requireAuth, requireRole("OWNER", "ADMIN")] }, async (req, reply) => {
    if (!env.ZERNIO_API_KEY) return reply.status(503).send({ error: "Zernio não configurado no servidor" });
    const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: req.workspaceId } });
    let connection = await prisma.zernioConnection.findUnique({ where: { workspaceId: req.workspaceId } });
    let profileId = connection?.profileId;
    if (!profileId) {
      const listed = await zernio<{ profiles?: Array<{ _id: string; name: string }> }>("/profiles");
      const existing = listed.profiles?.find((profile) => profile.name === `DMFlow — ${workspace.name}`);
      if (existing) profileId = existing._id;
      else {
        const created = await zernio<{ profile: { _id: string } }>("/profiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: `DMFlow — ${workspace.name}` }) });
        profileId = created.profile._id;
      }
    }
    const state = app.jwt.sign({ workspaceId: req.workspaceId, userId: req.userId, profileId }, { expiresIn: "10m" });
    const redirect = `${env.PUBLIC_API_URL}/oauth/zernio/callback?state=${encodeURIComponent(state)}`;
    const params = new URLSearchParams({ profileId, redirect_url: redirect, loginMethod: "facebook_login" });
    const result = await zernio<{ data?: { authUrl: string }; authUrl?: string }>(`/connect/instagram?${params}`);
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