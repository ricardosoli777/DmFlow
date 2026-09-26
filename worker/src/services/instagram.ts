// Envio real via Instagram Messaging API — RF03, RNF01, RNF09.
// Docs: docs/04-integracao-meta.md
import { createHash } from "node:crypto";
import type { Contact, InstagramAccount } from "@dmflow/db";
import { decryptCredential, getPrisma } from "@dmflow/db";
import { connection } from "../lib/queue";

const prisma = getPrisma();
const WINDOW_24H_MS = 24 * 60 * 60 * 1000;
// RNF09 — a Meta documenta um cap de 750 private replies/hora por conta;
// fica com folga de segurança em vez de colar no limite exato.
const RATE_LIMIT_PER_HOUR = 740;

class MessagingWindowClosedError extends Error {
  constructor(igsid: string) {
    super(`Janela de 24h fechada para o contato ${igsid} — envio bloqueado (RNF01)`);
  }
}

/**
 * Ação de um botão/CTA: `next` dispara um postback (o worker resolve o
 * próximo node — ver resolve-event.ts); `url` abre um link externo direto
 * no cliente do Instagram, sem passar pelo webhook.
 */
export type ButtonAction =
  | { type: "next"; title: string; payload: string }
  | { type: "url"; title: string; url: string };

type QuickReply = ButtonAction;

// Personalização nas mensagens — {{name}}/{{username}}/{{first_name}}/{{tags}}
// viram dados do contato, e qualquer outro {{campo}} é procurado nos
// atributos capturados pelo fluxo (node "Capturar resposta"). Mesma ideia do
// ManyChat: quem escreve o texto só digita a chave entre chaves duplas — o
// seletor de variáveis no editor (frontend) insere isso automaticamente.
export function interpolate(text: string, contact: Contact): string {
  const name = contact.name ?? contact.username ?? "";
  const builtins: Record<string, string> = {
    name,
    username: contact.username ?? "",
    first_name: name.split(" ")[0] ?? "",
    tags: contact.tags.join(", "),
  };
  const attributes = (contact.attributes as Record<string, unknown>) ?? {};

  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key: string) => {
    const lowerKey = key.toLowerCase();
    if (lowerKey in builtins) return builtins[lowerKey];
    if (key in attributes) return String(attributes[key] ?? "");
    return match; // variável desconhecida — deixa como está em vez de apagar
  });
}

function toGraphButton(action: ButtonAction): Record<string, string> {
  return action.type === "url"
    ? { type: "web_url", title: action.title.slice(0, 20), url: action.url }
    : { type: "postback", title: action.title.slice(0, 20), payload: action.payload };
}

async function ensureWithinWindow(contact: Contact, logContent: string): Promise<boolean> {
  if (isWithinMessagingWindow(contact.lastInboundAt)) return true;

  await prisma.message.create({
    data: {
      contactId: contact.id,
      direction: "blocked",
      content: logContent,
      status: "skipped",
      reason: "janela de 24h fechada (RNF01)",
    },
  });
  console.warn(new MessagingWindowClosedError(contact.igsid).message);
  return false;
}

/**
 * Envia uma DM de texto livre. Bloqueia (e loga, nunca falha silenciosamente)
 * se a última interação foi há mais de 24h — regra da Meta (RNF01). Se
 * `options` vier preenchido, anexa CTAs (quick replies) na mesma mensagem —
 * não precisa de um node "Botões" separado só pra isso.
 */
export async function sendDirectMessage(
  account: InstagramAccount,
  contact: Contact,
  text: string,
  options?: QuickReply[],
): Promise<void> {
  if (options?.length) return sendButtonsMessage(account, contact, text, options);

  if (!(await ensureWithinWindow(contact, text))) return;

  try {
    if (await isZernioAccount(account)) await callZernioSend(account, contact, { message: text });
    else await callSend(account, contact.igsid, { text });
    await logOutbound(contact, text);
  } catch (err) {
    await logOutbound(contact, text, "failed", (err as Error).message);
    throw err;
  }
}

/**
 * Envia mensagem com botões. Se todas as opções forem `next` (postback), usa
 * quick replies (até 13). Se alguma opção for `url` (link externo), a Meta
 * exige um button template em vez de quick reply — nesse caso o limite cai
 * pra 3 botões (mistura postback + web_url é permitida no mesmo template).
 */
export async function sendButtonsMessage(
  account: InstagramAccount,
  contact: Contact,
  text: string,
  options: QuickReply[],
): Promise<void> {
  if (!(await ensureWithinWindow(contact, text))) return;

  const logContent = `${text} [botões: ${options.map((o) => o.title).join(", ")}]`;
  try {
    const hasUrl = options.some((o) => o.type === "url");
    if (await isZernioAccount(account)) {
      await callZernioSend(account, contact, hasUrl
        ? { message: text, buttons: options.slice(0, 3).map((o) => o.type === "url" ? { type: "url", title: o.title, url: o.url } : { type: "postback", title: o.title, payload: o.payload }) }
        : { message: text, quickReplies: options.slice(0, 13).map((o) => ({ title: o.title, payload: o.type === "next" ? o.payload : "" })) });
      await logOutbound(contact, logContent);
      return;
    }
    if (hasUrl) {
      await callSend(account, contact.igsid, {
        attachment: {
          type: "template",
          payload: {
            template_type: "button",
            text: text.slice(0, 640),
            buttons: options.slice(0, 3).map(toGraphButton),
          },
        },
      });
    } else {
      await callSend(account, contact.igsid, {
        text,
        quick_replies: options.slice(0, 13).map((o) => ({
          content_type: "text",
          title: o.title.slice(0, 20),
          payload: o.type === "next" ? o.payload : "",
        })),
      });
    }
    await logOutbound(contact, logContent);
  } catch (err) {
    await logOutbound(contact, logContent, "failed", (err as Error).message);
    throw err;
  }
}

/**
 * Envia mídia (imagem/áudio/vídeo) por URL pública. Se `options` vier
 * preenchido, anexa CTAs na mesma mensagem — permite "imagem com botão"
 * sem precisar de um node separado. Se alguma opção for `url` (link
 * externo), a Meta não permite misturar anexo de mídia com button
 * template na mesma mensagem, então os botões saem numa mensagem
 * separada logo em seguida.
 */
export async function sendMediaMessage(
  account: InstagramAccount,
  contact: Contact,
  mediaType: "image" | "audio" | "video",
  url: string,
  options?: QuickReply[],
): Promise<void> {
  if (!url) return;
  if (!(await ensureWithinWindow(contact, `[${mediaType}] ${url}`))) return;

  const hasUrl = options?.some((o) => o.type === "url") ?? false;
  const message: Record<string, unknown> = {
    attachment: { type: mediaType, payload: { url, is_reusable: true } },
  };
  if (options?.length && !hasUrl) {
    message.quick_replies = options.slice(0, 13).map((o) => ({
      content_type: "text",
      title: o.title.slice(0, 20),
      payload: o.type === "next" ? o.payload : "",
    }));
  }

  const logContent = `[${mediaType}] ${url}${options?.length ? ` [botões: ${options.map((o) => o.title).join(", ")}]` : ""}`;
  try {
    if (await isZernioAccount(account)) {
      await callZernioSend(account, contact, { attachmentUrl: url, attachmentType: mediaType });
      if (options?.length) await sendButtonsMessage(account, contact, "Escolha uma opção:", options);
      await logOutbound(contact, logContent);
      return;
    }
    await callSend(account, contact.igsid, message);
    await logOutbound(contact, logContent);

    if (hasUrl) {
      await callSend(account, contact.igsid, {
        attachment: {
          type: "template",
          payload: {
            template_type: "button",
            text: "Escolha uma opção:",
            buttons: options!.slice(0, 3).map(toGraphButton),
          },
        },
      });
    }
  } catch (err) {
    await logOutbound(contact, logContent, "failed", (err as Error).message);
    throw err;
  }
}

/**
 * Abre a thread de DM a partir de um comentário (Private Reply). Sempre
 * permitido pela Meta logo após o comentário — não passa pela checagem de
 * janela (é esse endpoint que abre a janela, não o contrário). Usado só na
 * primeira mensagem de um flow_run disparado por comentário — ver
 * `usePrivateReplyForFirstMessage` em worker/src/engine/node-handlers.ts.
 */
export async function sendPrivateReply(
  account: InstagramAccount,
  postId: string,
  commentId: string,
  contact: Contact,
  text: string,
): Promise<void> {
  try {
    if (await isZernioAccount(account)) {
      await callZernio(account, `/inbox/comments/${encodeURIComponent(postId)}/${encodeURIComponent(commentId)}/private-reply`,
        { message: text });
    } else {
    await callGraphApi(account, `/${commentId}/private_replies`, { message: text });
    }
    await logOutbound(contact, text);
  } catch (err) {
    await logOutbound(contact, text, "failed", (err as Error).message);
    throw err;
  }
}

/**
 * Responde publicamente ao comentário (visível pra todo mundo, não é DM).
 * Usado opcionalmente antes de abrir o fluxo de DM, se o trigger tiver uma
 * resposta pública configurada.
 */
export async function sendPublicCommentReply(account: InstagramAccount, postId: string, commentId: string, text: string): Promise<void> {
  if (await isZernioAccount(account)) {
    const idempotencyKey = createHash("sha256").update(`${account.id}:${commentId}:${text}`).digest("hex");
    await callZernio(account, `/inbox/comments/${encodeURIComponent(postId)}`, { message: text, commentId }, idempotencyKey);
  } else await callGraphApi(account, `/${commentId}/replies`, { message: text });
}

/**
 * Busca nome/username/foto de um contato direto na Graph API — usado quando
 * o contato chegou só por DM (o webhook de `messages` não manda o nome
 * junto, diferente do de `comments`), pra `{{name}}` não ficar vazio.
 * Só funciona pra usuários dentro da janela de mensagens ativa com a conta.
 */
export async function fetchInstagramProfile(
  account: InstagramAccount,
  igsid: string,
): Promise<{ name?: string; username?: string; profilePic?: string } | null> {
  if (!account.pageAccessToken) return null;

  try {
    const res = await fetch(
      `https://graph.facebook.com/${account.graphApiVersion}/${igsid}?fields=name,username,profile_pic&access_token=${encodeURIComponent(account.pageAccessToken)}`,
    );
    const data = (await res.json()) as {
      name?: string;
      username?: string;
      profile_pic?: string;
      error?: { message?: string };
    };
    if (!res.ok || data.error) {
      console.warn(`[worker] não consegui buscar perfil de ${igsid}:`, data.error?.message ?? res.status);
      return null;
    }
    return { name: data.name, username: data.username, profilePic: data.profile_pic };
  } catch (err) {
    console.warn(`[worker] erro buscando perfil de ${igsid}:`, (err as Error).message);
    return null;
  }
}

/**
 * RNF09 — checa o rate limit de envio ANTES de mandar qualquer coisa pra
 * Graph API. Contador por hora no Redis, particionado por conta (`igUserId`)
 * — RF17, cada conta tem sua própria cota de 750/h junto à Meta. Só conta de
 * verdade quem foi de fato permitido a enviar — uma tentativa recusada não
 * consome a cota da próxima janela (`DECR`).
 */
export async function checkSendRateLimit(account: InstagramAccount): Promise<{ allowed: boolean; retryAfterMs: number }> {
  const hourBucket = new Date().toISOString().slice(0, 13); // "2026-09-15T14"
  const key = `ratelimit:${account.igUserId}:${hourBucket}`;

  const count = await connection.incr(key);
  if (count === 1) await connection.expire(key, 3600);
  if (count <= RATE_LIMIT_PER_HOUR) return { allowed: true, retryAfterMs: 0 };

  await connection.decr(key);

  const nextHour = new Date();
  nextHour.setMinutes(60, 0, 0);
  return { allowed: false, retryAfterMs: nextHour.getTime() - Date.now() };
}

/**
 * RF15 — checa se o contato já segue a conta (`is_user_follow_business`).
 * Fail-open de propósito: erro, campo ausente ou sem token configurado
 * conta como "segue" — nunca trava um seguidor de verdade só porque a Graph
 * API não respondeu o campo.
 */
export async function checkFollowStatus(account: InstagramAccount, igsid: string): Promise<boolean> {
  if (await isZernioAccount(account)) {
    const connection = await prisma.zernioConnection.findUniqueOrThrow({ where: { instagramAccountId: account.id } });
    const stored = await prisma.zernioApiKey.findUniqueOrThrow({ where: { workspaceId: account.workspaceId } });
    const encrypted = connection.keySlot === "secondary" ? stored.secondaryApiKey : stored.apiKey;
    if (!encrypted) throw new Error("Chave Zernio ausente para verificar seguidor");
    const response = await fetch(`https://zernio.com/api/v1/accounts/${encodeURIComponent(connection.accountId)}/follow-status/${encodeURIComponent(igsid)}?refresh=true`,
      { headers: { Authorization: `Bearer ${decryptCredential(encrypted)}` }, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`Verificação de seguidor Zernio falhou (${response.status})`);
    const data = await response.json() as { isFollower: boolean | null };
    return data.isFollower !== false;
  }
  if (!account.pageAccessToken) return true;

  try {
    const res = await fetch(
      `https://graph.facebook.com/${account.graphApiVersion}/${igsid}?fields=is_user_follow_business&access_token=${encodeURIComponent(account.pageAccessToken)}`,
    );
    const data = (await res.json()) as { is_user_follow_business?: boolean; error?: { message?: string } };
    if (!res.ok || data.error || data.is_user_follow_business === undefined) {
      console.warn(
        `[worker] não consegui checar follow status de ${igsid} (fail-open):`,
        data.error?.message ?? res.status,
      );
      return true;
    }
    return data.is_user_follow_business;
  } catch (err) {
    console.warn(`[worker] erro checando follow status de ${igsid} (fail-open):`, (err as Error).message);
    return true;
  }
}

function isWithinMessagingWindow(lastInboundAt: Date | null): boolean {
  if (!lastInboundAt) return false;
  return Date.now() - lastInboundAt.getTime() <= WINDOW_24H_MS;
}

async function logOutbound(
  contact: Contact,
  content: string,
  status: "ok" | "failed" = "ok",
  reason?: string,
): Promise<void> {
  await prisma.message.create({
    data: { contactId: contact.id, direction: "outbound", content, status, reason },
  });
}

async function callSend(account: InstagramAccount, igsid: string, message: Record<string, unknown>): Promise<void> {
  await callGraphApi(account, `/${account.igUserId}/messages`, {
    recipient: { id: igsid },
    message,
  });
}

async function callGraphApi(account: InstagramAccount, path: string, body: Record<string, unknown>): Promise<void> {
  if (!account.pageAccessToken) {
    throw new Error(`Conta ${account.id} sem token Meta: envio não realizado`);
  }

  const res = await fetch(
    `https://graph.facebook.com/${account.graphApiVersion}${path}?access_token=${encodeURIComponent(account.pageAccessToken)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Graph API ${path} falhou (${res.status}): ${errorBody}`);
  }
}

async function isZernioAccount(account: InstagramAccount): Promise<boolean> {
  return Boolean(await prisma.zernioConnection.findUnique({ where: { instagramAccountId: account.id }, select: { id: true } }));
}

async function callZernioSend(account: InstagramAccount, contact: Contact, body: Record<string, unknown>): Promise<void> {
  if (!contact.zernioConversationId) throw new Error("Conversa Zernio ainda não identificada para este contato");
  await callZernio(account, `/inbox/conversations/${encodeURIComponent(contact.zernioConversationId)}/messages`, body);
}

async function callZernio(account: InstagramAccount, path: string, body: Record<string, unknown>, idempotencyKey?: string): Promise<void> {
  const connection = await prisma.zernioConnection.findUnique({ where: { instagramAccountId: account.id } });
  if (!connection) throw new Error("Conta Zernio não vinculada");
  const stored = await prisma.zernioApiKey.findUnique({ where: { workspaceId: account.workspaceId } });
  const encrypted = connection.keySlot === "secondary" ? stored?.secondaryApiKey : stored?.apiKey;
  if (!encrypted) throw new Error(`Chave Zernio ${connection.keySlot} não configurada no banco`);
  const response = await fetch(`https://zernio.com/api/v1${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${decryptCredential(encrypted)}`, "Content-Type": "application/json", ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) },
    body: JSON.stringify({ accountId: connection.accountId, ...body }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Envio Zernio falhou (${response.status}): ${(await response.text()).slice(0, 500)}`);
}
