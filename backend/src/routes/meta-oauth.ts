import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../env";
import { requireRole } from "../lib/auth";
import { getInstagramAccount, saveInstagramAccount } from "@dmflow/db";

const stateSchema = z.object({ workspaceId: z.string(), userId: z.string(), accountId: z.string(), exp: z.number() });
const pageSchema = z.object({ id: z.string(), name: z.string().optional(), access_token: z.string().optional(), instagram_business_account: z.object({ id: z.string(), username: z.string().optional() }).optional() });

export async function metaOAuthStartRoutes(app: FastifyInstance) {
  app.get("/oauth/meta/start", { preHandler: requireRole("OWNER", "ADMIN") }, async (req, reply) => {
    if (!env.META_OAUTH_APP_ID || !env.META_OAUTH_APP_SECRET || !env.META_OAUTH_REDIRECT_URI) {
      return reply.status(503).send({ error: "OAuth Meta não configurado no servidor" });
    }
    const accountId = (req.query as { accountId?: string }).accountId;
    const account = accountId ? await getInstagramAccount(accountId) : null;
    if (!account || account.workspaceId !== req.workspaceId) return reply.status(400).send({ error: "Conta Instagram inválida" });
    const state = app.jwt.sign({ workspaceId: req.workspaceId, userId: req.userId, accountId }, { expiresIn: "10m" });
    const params = new URLSearchParams({
      client_id: env.META_OAUTH_APP_ID,
      redirect_uri: env.META_OAUTH_REDIRECT_URI,
      state,
      response_type: "code",
      scope: "pages_show_list,pages_read_engagement,instagram_basic,instagram_manage_comments,instagram_manage_messages",
    });
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
      const token = await exchange(q.code, env.META_OAUTH_APP_ID, env.META_OAUTH_APP_SECRET, env.META_OAUTH_REDIRECT_URI!);
      const page = await resolvePage(token);
      if (!page.access_token || !page.instagram_business_account) throw new Error("A Página escolhida não retornou token ou conta Instagram Business");
      await saveInstagramAccount(state.workspaceId, state.accountId, {
        appId: env.META_OAUTH_APP_ID,
        appSecret: env.META_OAUTH_APP_SECRET,
        pageAccessToken: page.access_token,
        igUserId: page.instagram_business_account.id,
        igUsername: page.instagram_business_account.username ?? "",
        // OAuth não fornece o verify token do webhook; preserva o já configurado.
        verifyToken: account.verifyToken,
        graphApiVersion: "v21.0",
      });
      return redirect(true);
    } catch (err) { app.log.error({ err }, "Falha no OAuth Meta"); return redirect(false); }
  });
}

async function resolvePage(userToken: string) {
  // Configuração pessoal explícita: contorna a omissão ocasional de páginas
  // em /me/accounts, mas ainda valida o vínculo real com Instagram na Meta.
  if (env.META_OAUTH_PAGE_ID) {
    return graphPage(`/${env.META_OAUTH_PAGE_ID}?fields=id,name,access_token,instagram_business_account{id,username}`, userToken);
  }
  const pages = await graph<{ data?: unknown[] }>("/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}", userToken);
  const matches = (pages.data ?? []).map((page) => pageSchema.parse(page)).filter((page) => page.access_token && page.instagram_business_account);
  if (matches.length === 0) throw new Error("Nenhuma Página com Instagram Business foi autorizada. Configure META_OAUTH_PAGE_ID para uso pessoal.");
  if (matches.length > 1) throw new Error("Mais de uma Página disponível. Configure META_OAUTH_PAGE_ID para escolher a conta correta.");
  return matches[0];
}

async function exchange(code: string, appId: string, secret: string, redirectUri: string): Promise<string> {
  const params = new URLSearchParams({ client_id: appId, client_secret: secret, redirect_uri: redirectUri, code });
  const short = await graph<{ access_token?: string }>(`/oauth/access_token?${params}`, "");
  if (!short.access_token) throw new Error("Meta não retornou token");
  const longParams = new URLSearchParams({ grant_type: "fb_exchange_token", client_id: appId, client_secret: secret, fb_exchange_token: short.access_token });
  const long = await graph<{ access_token?: string }>(`/oauth/access_token?${longParams}`, "");
  if (!long.access_token) throw new Error("Não foi possível estender o token");
  return long.access_token;
}

async function graph<T>(path: string, token: string): Promise<T> {
  const joiner = path.includes("?") ? "&" : "?";
  const url = token ? `https://graph.facebook.com/v21.0${path}${joiner}access_token=${encodeURIComponent(token)}` : `https://graph.facebook.com/v21.0${path}`;
  const res = await fetch(url);
  const body = await res.json() as T & { error?: { message?: string } };
  if (!res.ok || body.error) throw new Error(body.error?.message ?? `Meta HTTP ${res.status}`);
  return body;
}

async function graphPage(path: string, token: string) {
  return pageSchema.parse(await graph<unknown>(path, token));
}
