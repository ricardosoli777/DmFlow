import { getInstagramAccount, listInstagramAccounts, saveInstagramAccount } from "@dmflow/db";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireRole } from "../lib/auth";
import { prisma } from "../lib/prisma";

const updateSchema = z.object({
  appId: z.string().min(1).optional(),
  appSecret: z.string().min(1).optional(),
  verifyToken: z.string().min(1).optional(),
  pageAccessToken: z.string().min(1).optional(),
  igUserId: z.string().min(1).optional(),
  graphApiVersion: z.string().min(1).optional(),
});

// RF17 — várias contas Instagram por workspace (antes: uma linha global
// `Setting("instagram_connection")` só). Painel de conexão com status real
// (não só "token configurado"), por conta.
export async function instagramAccountRoutes(app: FastifyInstance) {
  app.get("/instagram-accounts", async (req) => {
    const accounts = await listInstagramAccounts(req.workspaceId);
    const withStatus = await Promise.all(
      accounts.map(async (a) => ({
        id: a.id,
        appId: a.appId,
        igUserId: a.igUserId.startsWith("pending-") ? "" : a.igUserId,
        igUsername: a.igUsername,
        graphApiVersion: a.graphApiVersion,
        hasAppSecret: Boolean(a.appSecret),
        hasVerifyToken: Boolean(a.verifyToken),
        hasPageAccessToken: Boolean(a.pageAccessToken),
        ...(await checkInstagramConnection(a.pageAccessToken, a.igUserId, a.graphApiVersion)),
      })),
    );
    return withStatus;
  });

  app.post("/instagram-accounts", { preHandler: requireRole("OWNER", "ADMIN") }, async (req, reply) => {
    const account = await saveInstagramAccount(req.workspaceId, null, {});
    return reply.status(201).send({ id: account.id });
  });

  app.put(
    "/instagram-accounts/:id",
    { preHandler: requireRole("OWNER", "ADMIN") },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const body = updateSchema.parse(req.body);

      const existing = await getInstagramAccount(id);
      if (!existing || existing.workspaceId !== req.workspaceId) return reply.status(404).send({ error: "not found" });

      // valida contra a API de verdade antes de salvar — não deixa gravar
      // credencial quebrada silenciosamente
      const merged = { ...existing, ...body };
      const status = await checkInstagramConnection(merged.pageAccessToken, merged.igUserId, merged.graphApiVersion);
      if (!status.connected) {
        return reply.status(400).send({ error: "Não consegui conectar com essas credenciais", detail: status.error });
      }

      const account = await saveInstagramAccount(req.workspaceId, id, body);
      return { ...status, id: account.id, igUserId: account.igUserId };
    },
  );

  app.delete(
    "/instagram-accounts/:id",
    { preHandler: requireRole("OWNER", "ADMIN") },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const existing = await prisma.instagramAccount.findUnique({ where: { id } });
      if (!existing || existing.workspaceId !== req.workspaceId) return reply.status(404).send({ error: "not found" });

      await prisma.instagramAccount.delete({ where: { id } });
      return reply.status(204).send();
    },
  );
}

export async function checkInstagramConnection(
  token: string,
  igUserId: string,
  version: string,
): Promise<{ connected: boolean; username?: string; error?: string }> {
  if (!token || !igUserId || igUserId.startsWith("pending-")) {
    return { connected: false, error: "Faltam credenciais (token ou IG User ID)" };
  }

  try {
    const res = await fetch(`https://graph.facebook.com/${version}/${igUserId}?fields=id,username&access_token=${encodeURIComponent(token)}`);
    const data = (await res.json()) as { username?: string; error?: { message?: string } };

    if (!res.ok || data.error) {
      return { connected: false, error: data.error?.message ?? `HTTP ${res.status}` };
    }

    return { connected: true, username: data.username };
  } catch (err) {
    return { connected: false, error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}
