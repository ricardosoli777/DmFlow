import { getFirstInstagramAccount, getInstagramAccount } from "@dmflow/db";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { workspaceApiKey, zernio } from "./zernio";

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
    const connection = await prisma.zernioConnection.findUnique({ where: { instagramAccountId: account.id } });
    if (connection) {
      try {
        const apiKey = await workspaceApiKey(req.workspaceId, connection.keySlot as "primary" | "secondary");
        if (!apiKey) return reply.status(503).send({ error: "Chave Zernio não configurada" });
        const result = await zernio<{ posts?: Array<{ id: string; message?: string; mediaType?: string; picture?: string; permalink?: string; createdTime?: string }> }>(
          apiKey, `/accounts/${encodeURIComponent(connection.accountId)}/posts`, { signal: AbortSignal.timeout(10_000) });
        return { media: (result.posts ?? []).map((post) => ({
          id: post.id, caption: post.message ?? "", media_type: post.mediaType === "video" ? "VIDEO" : "IMAGE",
          media_url: post.picture, thumbnail_url: post.picture, permalink: post.permalink ?? "", timestamp: post.createdTime ?? "",
        })) };
      } catch (error) {
        return reply.status(502).send({ error: `Falha ao buscar posts no Zernio: ${(error as Error).message}` });
      }
    }
    if (!account.pageAccessToken || !account.igUserId) {
      return reply.status(400).send({ error: "Instagram não conectado — configure em Configurações" });
    }

    const fields = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp";
    const url = `https://graph.facebook.com/${account.graphApiVersion}/${account.igUserId}/media?fields=${fields}&limit=50&access_token=${encodeURIComponent(account.pageAccessToken)}`;

    const res = await fetch(url);
    const data = (await res.json()) as { data?: IgMedia[]; error?: { message?: string } };

    if (!res.ok || data.error) {
      return reply.status(502).send({ error: data.error?.message ?? "Falha ao buscar posts da Meta" });
    }

    return { media: data.data ?? [] };
  });
}
