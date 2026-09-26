import { randomBytes } from "node:crypto";
import { decryptCredential, encryptCredential } from "@dmflow/db";
import { env } from "../env";
import { prisma } from "./prisma";

export async function ensureZernioWebhook(connectionId: string): Promise<void> {
  const connection = await prisma.zernioConnection.findUniqueOrThrow({ where: { id: connectionId } });
  if (!connection.instagramAccountId) return;
  const stored = await prisma.zernioApiKey.findUnique({ where: { workspaceId: connection.workspaceId } });
  const encrypted = connection.keySlot === "secondary" ? stored?.secondaryApiKey : stored?.apiKey;
  const apiKey = encrypted ? decryptCredential(encrypted) : connection.keySlot === "primary" ? env.ZERNIO_API_KEY : "";
  if (!apiKey) throw new Error(`Chave Zernio ausente para slot ${connection.keySlot}`);

  const secret = connection.webhookSecret ? decryptCredential(connection.webhookSecret) : randomBytes(32).toString("hex");
  const body = {
    ...(connection.webhookId ? { webhookId: connection.webhookId } : {}),
    name: `DMFlow ${connection.keySlot}`,
    url: `${env.PUBLIC_API_URL.replace(/\/$/, "")}/webhooks/zernio/${connection.id}`,
    secret,
    events: ["message.received", "comment.received"],
    accountIds: [connection.accountId],
    isActive: true,
  };
  const send = (method: "PUT" | "POST", requestBody: typeof body) => fetch("https://zernio.com/api/v1/webhooks/settings", {
    method,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(10_000),
  });
  let response = await send(connection.webhookId ? "PUT" : "POST", body);
  let recreated = false;
  // A chave pode ter sido substituída por outra equipe Zernio. Nesse caso,
  // o webhook antigo não é visível para a nova chave; recrie-o no novo acesso.
  if (response.status === 404 && connection.webhookId) {
    response = await send("POST", { ...body, webhookId: undefined });
    recreated = true;
  }
  if (!response.ok) throw new Error(`Zernio recusou webhook (${response.status})`);
  const result = await response.json() as { webhook?: { _id?: string } };
  const webhookId = result.webhook?._id ?? (recreated ? null : connection.webhookId);
  if (!webhookId) throw new Error("Zernio não retornou ID do webhook");
  await prisma.zernioConnection.update({
    where: { id: connection.id },
    data: { webhookId, webhookSecret: encryptCredential(secret) },
  });
}

export async function activatePendingZernioWebhooks(): Promise<void> {
  const connections = await prisma.zernioConnection.findMany({ where: { instagramAccountId: { not: null }, webhookId: null } });
  for (const connection of connections) {
    try {
      if (connection.instagramAccountId && connection.username) {
        await prisma.instagramAccount.update({ where: { id: connection.instagramAccountId }, data: { igUsername: connection.username } });
      }
      await ensureZernioWebhook(connection.id);
    }
    catch (error) { console.error(`[zernio] webhook ${connection.id} não ativado:`, (error as Error).message); }
  }
}

export async function removeZernioWebhook(connectionId: string): Promise<void> {
  const connection = await prisma.zernioConnection.findUniqueOrThrow({ where: { id: connectionId } });
  if (!connection.webhookId) return;
  const stored = await prisma.zernioApiKey.findUnique({ where: { workspaceId: connection.workspaceId } });
  const encrypted = connection.keySlot === "secondary" ? stored?.secondaryApiKey : stored?.apiKey;
  const apiKey = encrypted ? decryptCredential(encrypted) : connection.keySlot === "primary" ? env.ZERNIO_API_KEY : "";
  if (!apiKey) throw new Error("Chave Zernio ausente para remover webhook");
  const response = await fetch(`https://zernio.com/api/v1/webhooks/settings?webhookId=${encodeURIComponent(connection.webhookId)}`, {
    method: "DELETE", headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok && response.status !== 404) throw new Error(`Falha ao remover webhook Zernio (${response.status})`);
}
