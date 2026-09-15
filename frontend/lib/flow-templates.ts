import type { FlowDefinition } from "./flow-definition";

type FlowTemplate = { id: string; name: string; description: string; definition: FlowDefinition };

const pos = (x: number, y: number) => ({ x, y });

export const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    id: "blank",
    name: "Fluxo em branco",
    description: "Comece com um node de fim válido.",
    definition: { nodes: [{ id: "end", type: "end", label: "Fim do fluxo", position: pos(300, 180) }], start: "end" },
  },
  {
    id: "link",
    name: "Entregar link",
    description: "Agradece o comentário e entrega um link rastreado.",
    definition: {
      start: "welcome",
      nodes: [
        { id: "welcome", type: "message", label: "Boas-vindas", text: "Oi, {{first_name}}! O link está aqui:", next: "link", position: pos(80, 180) },
        { id: "link", type: "buttons", label: "Link", text: "Toque no botão para abrir:", options: [{ label: "Abrir link", trackedLinkId: "" }], next: "end", position: pos(360, 180) },
        { id: "end", type: "end", label: "Fim do fluxo", position: pos(650, 180) },
      ],
    },
  },
  {
    id: "coupon",
    name: "Entregar cupom",
    description: "Envia um cupom e marca o contato para segmentação.",
    definition: {
      start: "coupon",
      nodes: [
        { id: "coupon", type: "message", label: "Cupom", text: "{{first_name}}, seu cupom é BEMVINDO10!", next: "tag", position: pos(80, 180) },
        { id: "tag", type: "tag", label: "Tag cupom", tag: "recebeu-cupom", next: "end", position: pos(370, 180) },
        { id: "end", type: "end", label: "Fim do fluxo", position: pos(640, 180) },
      ],
    },
  },
  {
    id: "follow-gate",
    name: "Link com follow gate",
    description: "Pede para seguir a conta antes de liberar o link.",
    definition: {
      start: "ask-follow",
      nodes: [
        { id: "ask-follow", type: "buttons", label: "Pedir follow", text: "Siga nosso perfil e toque em liberar.", options: [{ label: "Já segui", next: "deliver", followGate: true }], position: pos(80, 180) },
        { id: "deliver", type: "buttons", label: "Liberar link", text: "Pronto! Aqui está:", options: [{ label: "Abrir link", trackedLinkId: "" }], next: "end", position: pos(390, 180) },
        { id: "end", type: "end", label: "Fim do fluxo", position: pos(680, 180) },
      ],
    },
  },
];
