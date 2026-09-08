// Envio real via Instagram Messaging API — RF03, RNF01.
// Docs: docs/04-integracao-meta.md
import { getPrisma } from "@dmflow/db";
import { env } from "../env";

const prisma = getPrisma();
const GRAPH_BASE = `https://graph.facebook.com/${env.META_GRAPH_API_VERSION}`;
const WINDOW_24H_MS = 24 * 60 * 60 * 1000;

class MessagingWindowClosedError extends Error {
  constructor(igsid: string) {
    super(`Janela de 24h fechada para o contato ${igsid} — envio bloqueado (RNF01)`);
  }
}

/**
 * Envia uma DM livre pro usuário. Bloqueia (e loga, nunca falha silenciosamente)
 * se a última interação dele foi há mais de 24h — regra da Meta (RNF01).
 */
export async function sendDirectMessage(igsid: string, text: string): Promise<void> {
  const contact = await prisma.contact.findUniqueOrThrow({ where: { igsid } });

  if (!isWithinMessagingWindow(contact.lastInboundAt)) {
    await prisma.message.create({
      data: { contactId: contact.id, direction: "blocked", content: text },
    });
    console.warn(new MessagingWindowClosedError(igsid).message);
    return;
  }

  await callGraphApi(`/${env.META_IG_USER_ID}/messages`, {
    recipient: { id: igsid },
    message: { text },
  });

  await prisma.message.create({
    data: { contactId: contact.id, direction: "outbound", content: text },
  });
}

/**
 * Abre a thread de DM a partir de um comentário (Private Reply). Sempre
 * permitido pela Meta logo após o comentário — não passa pela checagem de janela.
 */
export async function sendPrivateReply(commentId: string, text: string): Promise<void> {
  await callGraphApi(`/${commentId}/private_replies`, { message: text });
}

function isWithinMessagingWindow(lastInboundAt: Date | null): boolean {
  if (!lastInboundAt) return false;
  return Date.now() - lastInboundAt.getTime() <= WINDOW_24H_MS;
}

async function callGraphApi(path: string, body: Record<string, unknown>): Promise<void> {
  if (!env.META_PAGE_ACCESS_TOKEN) {
    console.log(`[dev sem token] POST ${GRAPH_BASE}${path}`, body);
    return;
  }

  const res = await fetch(`${GRAPH_BASE}${path}?access_token=${env.META_PAGE_ACCESS_TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Graph API ${path} falhou (${res.status}): ${errorBody}`);
  }
}
