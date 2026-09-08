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

// RF05 — um handler por tipo de node, testável isoladamente.
export const nodeHandlers: Record<
  FlowNode["type"],
  (node: FlowNode, run: FlowRun, contact: Contact) => Promise<NodeResult>
> = {
  message: async (node, run, contact) => {
    await sendDirectMessage(contact.igsid, String(node.text ?? ""));
    return { nextNodeId: (node.next as string) ?? null, waitingForInput: false };
  },

  buttons: async (node, run, contact) => {
    await sendDirectMessage(contact.igsid, String(node.text ?? ""));
    // Próximo node é resolvido quando o usuário responder (ver resolveTrigger)
    return { nextNodeId: null, waitingForInput: true };
  },

  delay: async (node) => {
    // RNF01: delays longos precisam checar a janela de 24h antes de reenviar —
    // agendamento real (BullMQ delayed job) entra na Wave 3.
    return { nextNodeId: (node.next as string) ?? null, waitingForInput: false };
  },

  condition: async (node, run, contact) => {
    const field = String(node.field ?? "");
    const value = (contact.attributes as Record<string, unknown>)[field];
    const matches = value === node.equals;
    const next = matches ? (node.thenNext as string) : (node.elseNext as string);
    return { nextNodeId: next ?? null, waitingForInput: false };
  },

  capture: async (node, run, contact) => {
    await sendDirectMessage(contact.igsid, String(node.prompt ?? ""));
    return { nextNodeId: null, waitingForInput: true };
  },

  tag: async (node, run, contact) => {
    const tag = String(node.tag ?? "");
    await prisma.contact.update({
      where: { id: contact.id },
      data: { tags: { push: tag } },
    });
    return { nextNodeId: (node.next as string) ?? null, waitingForInput: false };
  },

  webhook: async (node) => {
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
