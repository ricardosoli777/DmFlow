// Envio real via Instagram Messaging API — RF03, RNF01.
// Docs: docs/04-integracao-meta.md
import { getMetaSettings, getPrisma } from "@dmflow/db";

const prisma = getPrisma();
const WINDOW_24H_MS = 24 * 60 * 60 * 1000;

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

function toGraphButton(action: ButtonAction): Record<string, string> {
  return action.type === "url"
    ? { type: "web_url", title: action.title.slice(0, 20), url: action.url }
    : { type: "postback", title: action.title.slice(0, 20), payload: action.payload };
}

async function ensureWithinWindow(igsid: string, logContent: string): Promise<boolean> {
  const contact = await prisma.contact.findUniqueOrThrow({ where: { igsid } });

  if (!isWithinMessagingWindow(contact.lastInboundAt)) {
    await prisma.message.create({
      data: { contactId: contact.id, direction: "blocked", content: logContent },
    });
    console.warn(new MessagingWindowClosedError(igsid).message);
    return false;
  }
  return true;
}

/**
 * Envia uma DM de texto livre. Bloqueia (e loga, nunca falha silenciosamente)
 * se a última interação foi há mais de 24h — regra da Meta (RNF01). Se
 * `options` vier preenchido, anexa CTAs (quick replies) na mesma mensagem —
 * não precisa de um node "Botões" separado só pra isso.
 */
export async function sendDirectMessage(igsid: string, text: string, options?: QuickReply[]): Promise<void> {
  if (options?.length) return sendButtonsMessage(igsid, text, options);

  if (!(await ensureWithinWindow(igsid, text))) return;

  await callSend(igsid, { text });
  await logOutbound(igsid, text);
}

/**
 * Envia mensagem com botões. Se todas as opções forem `next` (postback), usa
 * quick replies (até 13). Se alguma opção for `url` (link externo), a Meta
 * exige um button template em vez de quick reply — nesse caso o limite cai
 * pra 3 botões (mistura postback + web_url é permitida no mesmo template).
 */
export async function sendButtonsMessage(igsid: string, text: string, options: QuickReply[]): Promise<void> {
  if (!(await ensureWithinWindow(igsid, text))) return;

  const hasUrl = options.some((o) => o.type === "url");
  if (hasUrl) {
    await callSend(igsid, {
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
    await callSend(igsid, {
      text,
      quick_replies: options.slice(0, 13).map((o) => ({
        content_type: "text",
        title: o.title.slice(0, 20),
        payload: o.type === "next" ? o.payload : "",
      })),
    });
  }
  await logOutbound(igsid, `${text} [botões: ${options.map((o) => o.title).join(", ")}]`);
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
  igsid: string,
  mediaType: "image" | "audio" | "video",
  url: string,
  options?: QuickReply[],
): Promise<void> {
  if (!url) return;
  if (!(await ensureWithinWindow(igsid, `[${mediaType}] ${url}`))) return;

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

  await callSend(igsid, message);
  await logOutbound(igsid, `[${mediaType}] ${url}${options?.length ? ` [botões: ${options.map((o) => o.title).join(", ")}]` : ""}`);

  if (hasUrl) {
    await callSend(igsid, {
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
}

/**
 * Abre a thread de DM a partir de um comentário (Private Reply). Sempre
 * permitido pela Meta logo após o comentário — não passa pela checagem de
 * janela (é esse endpoint que abre a janela, não o contrário). Usado só na
 * primeira mensagem de um flow_run disparado por comentário — ver
 * `usePrivateReplyForFirstMessage` em worker/src/engine/node-handlers.ts.
 */
export async function sendPrivateReply(commentId: string, igsid: string, text: string): Promise<void> {
  const settings = await getMetaSettings();
  await callGraphApi(settings, `/${commentId}/private_replies`, { message: text });
  await logOutbound(igsid, text);
}

/**
 * Responde publicamente ao comentário (visível pra todo mundo, não é DM).
 * Usado opcionalmente antes de abrir o fluxo de DM, se o trigger tiver uma
 * resposta pública configurada.
 */
export async function sendPublicCommentReply(commentId: string, text: string): Promise<void> {
  const settings = await getMetaSettings();
  await callGraphApi(settings, `/${commentId}/replies`, { message: text });
}

function isWithinMessagingWindow(lastInboundAt: Date | null): boolean {
  if (!lastInboundAt) return false;
  return Date.now() - lastInboundAt.getTime() <= WINDOW_24H_MS;
}

async function logOutbound(igsid: string, content: string): Promise<void> {
  const contact = await prisma.contact.findUniqueOrThrow({ where: { igsid } });
  await prisma.message.create({ data: { contactId: contact.id, direction: "outbound", content } });
}

async function callSend(igsid: string, message: Record<string, unknown>): Promise<void> {
  const settings = await getMetaSettings();
  await callGraphApi(settings, `/${settings.igUserId}/messages`, {
    recipient: { id: igsid },
    message,
  });
}

async function callGraphApi(
  settings: Awaited<ReturnType<typeof getMetaSettings>>,
  path: string,
  body: Record<string, unknown>,
): Promise<void> {
  if (!settings.pageAccessToken) {
    console.log(`[dev sem token] POST graph.instagram.com/${settings.graphApiVersion}${path}`, body);
    return;
  }

  const res = await fetch(
    `https://graph.instagram.com/${settings.graphApiVersion}${path}?access_token=${settings.pageAccessToken}`,
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
