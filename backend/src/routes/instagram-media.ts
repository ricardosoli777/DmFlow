import { getFirstInstagramAccount, getInstagramAccount } from "@dmflow/db";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

type IgMedia = {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
};

// RF: lista os posts/reels reais da conta conectada, pra escolher visualmente
// ao criar um trigger (em vez de colar link/ID manualmente). RF17: precisa
// dizer de qual conta conectada (um workspace pode ter várias).
export async function instagramMediaRoutes(app: FastifyInstance) {
  app.get("/instagram/media", async (req, reply) => {
    const query = z.object({ accountId: z.string().optional() }).parse(req.query);

    const account = query.accountId
      ? await getInstagramAccount(query.accountId)
      : await getFirstInstagramAccount(req.workspaceId);

    if (!account || account.workspaceId !== req.workspaceId) {
      return reply.status(400).send({ error: "Instagram não conectado — configure em Configurações" });
    }
    if (!account.pageAccessToken || !account.igUserId) {
      return reply.status(400).send({ error: "Instagram não conectado — configure em Configurações" });
    }

    const fields = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp";
    const url = `https://graph.instagram.com/${account.graphApiVersion}/${account.igUserId}/media?fields=${fields}&limit=50&access_token=${account.pageAccessToken}`;

    const res = await fetch(url);
    const data = (await res.json()) as { data?: IgMedia[]; error?: { message?: string } };

    if (!res.ok || data.error) {
      return reply.status(502).send({ error: data.error?.message ?? "Falha ao buscar posts da Meta" });
    }

    return { media: data.data ?? [] };
  });
}

