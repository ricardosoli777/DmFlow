import { getMetaSettings } from "@dmflow/db";
import type { FastifyInstance } from "fastify";

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
// ao criar um trigger (em vez de colar link/ID manualmente).
export async function instagramMediaRoutes(app: FastifyInstance) {
  app.get("/instagram/media", async (req, reply) => {
    const settings = await getMetaSettings();

    if (!settings.pageAccessToken || !settings.igUserId) {
      return reply.status(400).send({ error: "Instagram não conectado — configure em Configurações" });
    }

    const fields = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp";
    const url = `https://graph.instagram.com/${settings.graphApiVersion}/${settings.igUserId}/media?fields=${fields}&limit=50&access_token=${settings.pageAccessToken}`;

    const res = await fetch(url);
    const data = (await res.json()) as { data?: IgMedia[]; error?: { message?: string } };

    if (!res.ok || data.error) {
      return reply.status(502).send({ error: data.error?.message ?? "Falha ao buscar posts da Meta" });
    }

    return { media: data.data ?? [] };
  });
}
