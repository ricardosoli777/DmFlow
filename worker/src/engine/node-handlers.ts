import type { Contact, FlowRun, InstagramAccount } from "@dmflow/db";
import { getPrisma } from "@dmflow/db";
import { env } from "../env";
import type { ButtonAction } from "../services/instagram";
import {
  checkSendRateLimit,
  interpolate,
  sendButtonsMessage,
  sendDirectMessage,
  sendMediaMessage,
  sendPrivateReply,
} from "../services/instagram";

const prisma = getPrisma();

// `next` liga o botão a outro node do fluxo (postback); `url` abre um link
// externo direto no cliente; `trackedLinkId` (RF14) resolve pro redirect
// público `/r/:code` do link rastreado escolhido — os três são mutuamente
// exclusivos, só um por botão. `followGate` (RF15, só faz sentido com
// `next`) exige que o contato siga a conta antes de liberar o clique — ver
// `resolve-event.ts::advanceToButtonTarget`.
export type ButtonOption = {
  label: string;
  next?: string;
  url?: string;
  trackedLinkId?: string;
  followGate?: boolean;
};

export type FlowNode = {
  id: string;
  type: "message" | "buttons" | "image" | "audio" | "video" | "delay" | "condition" | "capture" | "tag" | "webhook" | "end";
  [key: string]: unknown;
};

export type NodeResult = {
  nextNodeId: string | null;
  waitingForInput: boolean;
  /**
   * Presente quando o node precisa pausar e retomar depois de um tempo (node
   * "delay") ou reagendar por causa de rate limit (Wave 6). O executor
   * (`executor.ts`) marca o flow_run como "scheduled" e agenda um job
   * atrasado do BullMQ em vez de continuar o loop na mesma execução.
   */
  delayMs?: number;
  /**
   * Node em que retomar quando `delayMs` está presente. Default é
   * `nextNodeId` (ex: node "Aguardar" — retoma no próximo node depois de
   * esperar). Rate limiting usa o próprio node atual aqui, pra tentar o
   * mesmo envio de novo depois da janela.
   */
  resumeNodeId?: string;
};

type HandlerArgs = {
  node: FlowNode;
  run: FlowRun;
  contact: Contact;
  // RF17 — conta Instagram por onde esse contato chegou; toda função de
  // envio precisa dela pra saber com quais credenciais falar com a Graph
  // API. Ver executor.ts (carregada via `contact.instagramAccount`).
  account: InstagramAccount;
  /** Presente quando o node está sendo retomado após esperar resposta do usuário (ex: capture). */
  resumeInput?: string;
  /**
   * Presente só no primeiro node de um flow_run disparado por comentário,
   * e só uma vez. A primeira mensagem de texto puro (sem CTA — Private
   * Reply não suporta botões/mídia) sai por esse endpoint em vez de DM
   * comum, porque a Meta pode recusar abrir uma conversa nova via envio
   * direto. Ver worker/src/engine/executor.ts.
   */
  privateReply?: { commentId: string };
};

/**
 * RNF09 — checa o cap de 750 envios/h da Meta antes de qualquer node que
 * manda mensagem. Se estourou, reagenda o MESMO node (não avança) pra tentar
 * de novo depois, reaproveitando o mecanismo de pausa/retomada do node
 * "delay" (`NodeResult.delayMs`/`resumeNodeId`, ver executor.ts) — a
 * mensagem nunca é perdida, só atrasada.
 */
async function checkRateLimitOrSchedule(
  node: FlowNode,
  contact: Contact,
  account: InstagramAccount,
): Promise<NodeResult | null> {
  const rateLimit = await checkSendRateLimit(account);
  if (rateLimit.allowed) return null;

  await prisma.message.create({
    data: {
      contactId: contact.id,
      direction: "blocked",
      content: `[rate limit] node ${node.id}`,
      status: "rate_limited",
      reason: "cap de 750 envios/hora da Meta atingido — reagendado (RNF09)",
    },
  });

  return { nextNodeId: null, waitingForInput: false, delayMs: rateLimit.retryAfterMs, resumeNodeId: node.id };
}

// Manda texto puro pela Private Reply (se disponível e sem CTA) ou pela DM normal.
async function sendText(
  account: InstagramAccount,
  contact: Contact,
  text: string,
  actions: ButtonAction[],
  privateReply?: { commentId: string },
): Promise<void> {
  if (privateReply && actions.length === 0) {
    await sendPrivateReply(account, privateReply.commentId, contact, text);
    return;
  }
  await sendDirectMessage(account, contact, text, actions);
}

// RF05 — um handler por tipo de node, testável isoladamente.
export const nodeHandlers: Record<FlowNode["type"], (args: HandlerArgs) => Promise<NodeResult>> = {
  // CTA opcional em qualquer node de conteúdo (message/image/audio/video):
  // se tiver `options`, a mensagem sai com botões e o fluxo espera o clique
  // (postback) em vez de seguir direto pro `next` — mesmo comportamento do
  // node "Botões" dedicado, só que embutido.
  message: async ({ node, contact, account, privateReply }) => {
    const limited = await checkRateLimitOrSchedule(node, contact, account);
    if (limited) return limited;

    const actions = await toButtonActions(node.options, account);
    await sendText(account, contact, interpolate(String(node.text ?? ""), contact), actions, privateReply);
    return hasPostback(actions)
      ? { nextNodeId: null, waitingForInput: true }
      : { nextNodeId: (node.next as string) ?? null, waitingForInput: false };
  },

  // Botões/mídia não passam pela Private Reply (a Meta não aceita anexo nem
  // template nesse endpoint) — se um destes for o node inicial de um fluxo
  // disparado por comentário, a primeira mensagem ainda sai como DM comum e
  // corre o risco de falhar se a conversa nunca foi aberta. Prefira começar
  // o fluxo com um node "Mensagem" de texto puro quando o trigger for comentário.
  buttons: async ({ node, contact, account }) => {
    const limited = await checkRateLimitOrSchedule(node, contact, account);
    if (limited) return limited;

    const actions = await toButtonActions(node.options, account);
    await sendButtonsMessage(account, contact, interpolate(String(node.text ?? ""), contact), actions);
    // Se algum botão for postback, o próximo node é resolvido via clique
    // (ver resolve-event.ts). Se só houver botões de link externo, segue
    // direto pro `next` do node, já que nenhum clique volta pro webhook.
    return hasPostback(actions)
      ? { nextNodeId: null, waitingForInput: true }
      : { nextNodeId: (node.next as string) ?? null, waitingForInput: false };
  },

  image: async ({ node, contact, account }) => {
    const limited = await checkRateLimitOrSchedule(node, contact, account);
    if (limited) return limited;

    const actions = await toButtonActions(node.options, account);
    await sendMediaMessage(account, contact, "image", String(node.url ?? ""), actions);
    return hasPostback(actions)
      ? { nextNodeId: null, waitingForInput: true }
      : { nextNodeId: (node.next as string) ?? null, waitingForInput: false };
  },

  audio: async ({ node, contact, account }) => {
    const limited = await checkRateLimitOrSchedule(node, contact, account);
    if (limited) return limited;

    const actions = await toButtonActions(node.options, account);
    await sendMediaMessage(account, contact, "audio", String(node.url ?? ""), actions);
    return hasPostback(actions)
      ? { nextNodeId: null, waitingForInput: true }
      : { nextNodeId: (node.next as string) ?? null, waitingForInput: false };
  },

  video: async ({ node, contact, account }) => {
    const limited = await checkRateLimitOrSchedule(node, contact, account);
    if (limited) return limited;

    const actions = await toButtonActions(node.options, account);
    await sendMediaMessage(account, contact, "video", String(node.url ?? ""), actions);
    return hasPostback(actions)
      ? { nextNodeId: null, waitingForInput: true }
      : { nextNodeId: (node.next as string) ?? null, waitingForInput: false };
  },

  delay: async ({ node }) => {
    // RNF01: a janela de 24h é checada de novo no `send*` do node seguinte
    // quando o flow_run retoma (ver services/instagram.ts) — o delay em si só
    // agenda a retomada, não manda mensagem nenhuma.
    const amount = Number(node.duration ?? 1);
    const unit = String(node.unit ?? "minutes");
    const msPerUnit = { seconds: 1_000, minutes: 60_000, hours: 3_600_000 }[unit] ?? 60_000;
    return {
      nextNodeId: (node.next as string) ?? null,
      waitingForInput: false,
      delayMs: Math.max(1, amount) * msPerUnit,
    };
  },

  condition: async ({ node, contact }) => {
    const field = String(node.field ?? "");
    const value = (contact.attributes as Record<string, unknown>)[field];
    const matches = value === node.equals;
    const next = matches ? (node.thenNext as string) : (node.elseNext as string);
    return { nextNodeId: next ?? null, waitingForInput: false };
  },

  capture: async ({ node, contact, account, resumeInput, privateReply }) => {
    if (resumeInput === undefined) {
      const limited = await checkRateLimitOrSchedule(node, contact, account);
      if (limited) return limited;

      await sendText(account, contact, interpolate(String(node.prompt ?? ""), contact), [], privateReply);
      return { nextNodeId: null, waitingForInput: true };
    }

    const field = String(node.field ?? "value");
    await prisma.contact.update({
      where: { id: contact.id },
      data: { attributes: { ...(contact.attributes as object), [field]: resumeInput } },
    });
    return { nextNodeId: (node.next as string) ?? null, waitingForInput: false };
  },

  tag: async ({ node, contact }) => {
    const tag = String(node.tag ?? "");
    await prisma.contact.update({
      where: { id: contact.id },
      data: { tags: { push: tag } },
    });
    return { nextNodeId: (node.next as string) ?? null, waitingForInput: false };
  },

  webhook: async ({ node, contact }) => {
    const url = String(node.url ?? "");
    if (!url) return { nextNodeId: (node.next as string) ?? null, waitingForInput: false };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId: node.id, contactId: contact.id, attributes: contact.attributes }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await prisma.message.create({
        data: {
          contactId: contact.id,
          direction: "outbound",
          content: `[webhook] ${url}`,
          status: "ok",
          reason: `HTTP ${response.status}`,
        },
      });
    } catch (err) {
      await prisma.message.create({
        data: {
          contactId: contact.id,
          direction: "outbound",
          content: `[webhook] ${url}`,
          status: "failed",
          reason: (err as Error).message,
        },
      });
    }
    return { nextNodeId: (node.next as string) ?? null, waitingForInput: false };
  },

  end: async () => {
    return { nextNodeId: null, waitingForInput: false };
  },
};

async function toButtonActions(options: unknown, account: InstagramAccount): Promise<ButtonAction[]> {
  const list = (options as ButtonOption[] | undefined) ?? [];
  const resolved = await Promise.all(
    list
      .filter((o) => o.label && (o.next || o.url || o.trackedLinkId))
      .map(async (o): Promise<ButtonAction | null> => {
        if (o.trackedLinkId) {
          const link = await prisma.trackedLink.findFirst({
            where: { id: o.trackedLinkId, workspaceId: account.workspaceId },
          });
          if (!link) return null; // link apagado, ou de outro workspace — ignora o botão
          return { type: "url", title: o.label, url: `${env.PUBLIC_API_URL}/r/${link.code}` };
        }
        return o.url
          ? { type: "url", title: o.label, url: o.url }
          : { type: "next", title: o.label, payload: o.next as string };
      }),
  );
  return resolved.filter((action): action is ButtonAction => action !== null);
}

function hasPostback(actions: ButtonAction[]): boolean {
  return actions.some((a) => a.type === "next");
}
