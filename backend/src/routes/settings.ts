import { getMetaSettings, saveMetaSettings } from "@dmflow/db";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

const updateSchema = z.object({
  appId: z.string().min(1).optional(),
  appSecret: z.string().min(1).optional(),
  verifyToken: z.string().min(1).optional(),
  pageAccessToken: z.string().min(1).optional(),
  igUserId: z.string().min(1).optional(),
  graphApiVersion: z.string().min(1).optional(),
});

// RF: painel de conexão com o Instagram — status real (não só "token no .env")
export async function settingsRoutes(app: FastifyInstance) {
  app.get("/settings/instagram", async () => {
    const settings = await getMetaSettings();
    const status = await checkInstagramConnection(settings.pageAccessToken, settings.igUserId, settings.graphApiVersion);
    return {
      appId: settings.appId,
      igUserId: settings.igUserId,
      graphApiVersion: settings.graphApiVersion,
      hasAppSecret: Boolean(settings.appSecret),
      hasVerifyToken: Boolean(settings.verifyToken),
      hasPageAccessToken: Boolean(settings.pageAccessToken),
      ...status,
    };
  });

  app.put("/settings/instagram", async (req, reply) => {
    const body = updateSchema.parse(req.body);

    // valida contra a API de verdade antes de salvar — não deixa gravar
    // credencial quebrada silenciosamente
    const merged = { ...(await getMetaSettings()), ...body };
    const status = await checkInstagramConnection(merged.pageAccessToken, merged.igUserId, merged.graphApiVersion);

    if (!status.connected) {
      return reply.status(400).send({ error: "Não consegui conectar com essas credenciais", detail: status.error });
    }

    await saveMetaSettings(body);
    return { ...status, appId: merged.appId, igUserId: merged.igUserId };
  });
}

async function checkInstagramConnection(
  token: string,
  igUserId: string,
  version: string,
): Promise<{ connected: boolean; username?: string; error?: string }> {
  if (!token || !igUserId) {
    return { connected: false, error: "Faltam credenciais (token ou IG User ID)" };
  }

  try {
    const res = await fetch(`https://graph.instagram.com/${version}/${igUserId}?fields=id,username&access_token=${token}`);
    const data = (await res.json()) as { username?: string; error?: { message?: string } };

    if (!res.ok || data.error) {
      return { connected: false, error: data.error?.message ?? `HTTP ${res.status}` };
    }

    return { connected: true, username: data.username };
  } catch (err) {
    return { connected: false, error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}
