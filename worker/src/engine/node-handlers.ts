import type { Contact, FlowRun } from "@dmflow/db";
import { getPrisma } from "@dmflow/db";
import { sendDirectMessage } from "../services/instagram";

const prisma = getPrisma();

export type FlowNode = {
  id: string;
  type: "message" | "buttons" | "delay" | "condition" | "capture" | "tag" | "webhook" | "end";
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
  message: async ({ node, contact }) => {
    await sendDirectMessage(contact.igsid, String(node.text ?? ""));
    return { nextNodeId: (node.next as string) ?? null, waitingForInput: false };
  },

  buttons: async ({ node, contact }) => {
    await sendDirectMessage(contact.igsid, String(node.text ?? ""));
    // Próximo node é resolvido via postback quando o usuário clica (ver resolve-event.ts)
    return { nextNodeId: null, waitingForInput: true };
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
