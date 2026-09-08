import type { Contact, FlowRun } from "@dmflow/db";
import { getPrisma } from "@dmflow/db";
import { sendButtonsMessage, sendDirectMessage, sendMediaMessage } from "../services/instagram";

const prisma = getPrisma();

export type ButtonOption = { label: string; next: string };

export type FlowNode = {
  id: string;
  type: "message" | "buttons" | "image" | "audio" | "video" | "delay" | "condition" | "capture" | "tag" | "webhook" | "end";
  [key: string]: unknown;
};

export type NodeResult = {
  nextNodeId: string | null;
  waitingForInput: boolean;
};

type HandlerArgs = {
  node: FlowNode;
  run: FlowRun;
  contact: Contact;
  /** Presente quando o node está sendo retomado após esperar resposta do usuário (ex: capture). */
  resumeInput?: string;
};

// RF05 — um handler por tipo de node, testável isoladamente.
export const nodeHandlers: Record<FlowNode["type"], (args: HandlerArgs) => Promise<NodeResult>> = {
  // CTA opcional em qualquer node de conteúdo (message/image/audio/video):
  // se tiver `options`, a mensagem sai com botões e o fluxo espera o clique
  // (postback) em vez de seguir direto pro `next` — mesmo comportamento do
  // node "Botões" dedicado, só que embutido.
  message: async ({ node, contact }) => {
    const options = toQuickReplies(node.options);
    await sendDirectMessage(contact.igsid, String(node.text ?? ""), options);
    return options.length
      ? { nextNodeId: null, waitingForInput: true }
      : { nextNodeId: (node.next as string) ?? null, waitingForInput: false };
  },

  buttons: async ({ node, contact }) => {
    await sendButtonsMessage(contact.igsid, String(node.text ?? ""), toQuickReplies(node.options));
    // Próximo node é resolvido via postback quando o usuário clica (ver resolve-event.ts)
    return { nextNodeId: null, waitingForInput: true };
  },

  image: async ({ node, contact }) => {
    const options = toQuickReplies(node.options);
    await sendMediaMessage(contact.igsid, "image", String(node.url ?? ""), options);
    return options.length
      ? { nextNodeId: null, waitingForInput: true }
      : { nextNodeId: (node.next as string) ?? null, waitingForInput: false };
  },

  audio: async ({ node, contact }) => {
    const options = toQuickReplies(node.options);
    await sendMediaMessage(contact.igsid, "audio", String(node.url ?? ""), options);
    return options.length
      ? { nextNodeId: null, waitingForInput: true }
      : { nextNodeId: (node.next as string) ?? null, waitingForInput: false };
  },

  video: async ({ node, contact }) => {
    const options = toQuickReplies(node.options);
    await sendMediaMessage(contact.igsid, "video", String(node.url ?? ""), options);
    return options.length
      ? { nextNodeId: null, waitingForInput: true }
      : { nextNodeId: (node.next as string) ?? null, waitingForInput: false };
  },

  delay: async ({ node }) => {
    // RNF01: delays longos precisam checar a janela de 24h antes de reenviar —
    // agendamento real (BullMQ delayed job) entra no refinamento da Wave 3.
    return { nextNodeId: (node.next as string) ?? null, waitingForInput: false };
  },

  condition: async ({ node, contact }) => {
    const field = String(node.field ?? "");
    const value = (contact.attributes as Record<string, unknown>)[field];
    const matches = value === node.equals;
    const next = matches ? (node.thenNext as string) : (node.elseNext as string);
    return { nextNodeId: next ?? null, waitingForInput: false };
  },

  capture: async ({ node, contact, resumeInput }) => {
    if (resumeInput === undefined) {
      await sendDirectMessage(contact.igsid, String(node.prompt ?? ""));
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

  webhook: async ({ node }) => {
    const url = String(node.url ?? "");
    if (url) {
      await fetch(url, { method: "POST", body: JSON.stringify({ nodeId: node.id }) }).catch(() => null);
    }
    return { nextNodeId: (node.next as string) ?? null, waitingForInput: false };
  },

  end: async () => {
    return { nextNodeId: null, waitingForInput: false };
  },
};

function toQuickReplies(options: unknown): { title: string; payload: string }[] {
  const list = (options as ButtonOption[] | undefined) ?? [];
  return list.filter((o) => o.label && o.next).map((o) => ({ title: o.label, payload: o.next }));
}
