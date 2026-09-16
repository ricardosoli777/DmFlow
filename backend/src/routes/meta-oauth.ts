import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../env";
import { requireRole } from "../lib/auth";
import { getInstagramAccount, saveInstagramAccount } from "@dmflow/db";

const stateSchema = z.object({ workspaceId: z.string(), userId: z.string(), accountId: z.string(), exp: z.number() });

export async function metaOAuthStartRoutes(app: FastifyInstance) {
  app.get("/oauth/meta/start", { preHandler: requireRole("OWNER", "ADMIN") }, async (req, reply) => {
    if (!env.META_OAUTH_APP_ID || !env.META_OAUTH_APP_SECRET) {
      return reply.status(503).send({ error: "OAuth Meta não configurado no servidor" });
    }
    const accountId = (req.query as { accountId?: string }).accountId;
    const account = accountId ? await getInstagramAccount(accountId) : null;
    if (!account || account.workspaceId !== req.workspaceId) return reply.status(400).send({ error: "Conta Instagram inválida" });
    const state = app.jwt.sign({ workspaceId: req.workspaceId, userId: req.userId, accountId }, { expiresIn: "10m" });
    const params = new URLSearchParams({ client_id: env.META_OAUTH_APP_ID, redirect_uri: env.META_OAUTH_REDIRECT_URI, state, response_type: "code", scope: "pages_show_list,pages_read_engagement,pages_manage_metadata,instagram_basic,instagram_manage_comments,instagram_manage_messages" });
    return { url: `https://www.facebook.com/v21.0/dialog/oauth?${params}` };
  });
}

export async function metaOAuthCallbackRoutes(app: FastifyInstance) {
  app.get("/oauth/meta/callback", async (req, reply) => {
    const q = req.query as { code?: string; state?: string; error?: string };
    const redirect = (ok: boolean) => reply.code(302).header("location", `${env.PUBLIC_APP_URL}/settings?oauth=${ok ? "success" : "error"}`).send();
    if (q.error || !q.code || !q.state) return redirect(false);
    let state: z.infer<typeof stateSchema>;
    try { state = stateSchema.parse(app.jwt.verify(q.state)); } catch { return redirect(false); }
    const account = await getInstagramAccount(state.accountId);
    if (!account || account.workspaceId !== state.workspaceId) return redirect(false);
    try {
      const token = await exchange(q.code, env.META_OAUTH_APP_ID, env.META_OAUTH_APP_SECRET, env.META_OAUTH_REDIRECT_URI);
      const pages = await graph<{ data?: Array<{ id: string; access_token: string; instagram_business_account?: { id: string } }> }>("/me/accounts?fields=id,access_token,instagram_business_account", token);
      const page = pages.data?.find((p) => p.instagram_business_account?.id && p.access_token);
      if (!page?.instagram_business_account) throw new Error("Nenhuma Página vinculada ao Instagram foi autorizada");
      await saveInstagramAccount(state.workspaceId, state.accountId, { appId: env.META_OAUTH_APP_ID, appSecret: env.META_OAUTH_APP_SECRET, pageAccessToken: page.access_token, igUserId: page.instagram_business_account.id, graphApiVersion: "v21.0" });
      return redirect(true);
    } catch (err) { app.log.error({ err }, "Falha no OAuth Meta"); return redirect(false); }
  });
}

async function exchange(code: string, appId: string, secret: string, redirectUri: string): Promise<string> {
  const p = new URLSearchParams({ client_id: appId, client_secret: secret, redirect_uri: redirectUri, code });
  const short = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?${p}`).then((r) => r.json()) as { access_token?: string; error?: { message?: string } };
  if (!short.access_token) throw new Error(short.error?.message ?? "Meta não retornou token");
  const longP = new URLSearchParams({ grant_type: "fb_exchange_token", client_id: appId, client_secret: secret, fb_exchange_token: short.access_token });
  const long = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?${longP}`).then((r) => r.json()) as { access_token?: string; error?: { message?: string } };
  if (!long.access_token) throw new Error(long.error?.message ?? "Não foi possível estender o token");
  return long.access_token;
}

async function graph<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`https://graph.facebook.com/v21.0${path}&access_token=${encodeURIComponent(token)}`);
  const body = await res.json() as T & { error?: { message?: string } };
  if (!res.ok || body.error) throw new Error(body.error?.message ?? `Meta HTTP ${res.status}`);
  return body;
}
