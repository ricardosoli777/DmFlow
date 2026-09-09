import type { Edge, Node } from "reactflow";

// Converte entre o grafo do React Flow (nodes+edges, só existe no canvas) e o
// JSON que a API/worker entendem (nodes com `next`/`options[].next`/
// `thenNext`/`elseNext` apontando id-a-id, sem edges — ver docs/03-motor-de-fluxos.md).
// `condition` nunca usa edge pra decidir o próximo node (usa thenNext/elseNext,
// escolhidos no painel de propriedades); todo o resto usa a única edge que sai
// do node como o campo `next`.

export type FlowDefinitionNode = {
  id: string;
  type: string;
  position?: { x: number; y: number };
  next?: string;
  thenNext?: string;
  elseNext?: string;
  options?: { label: string; next?: string; url?: string }[];
  [key: string]: unknown;
};

export type FlowDefinition = {
  nodes: FlowDefinitionNode[];
  start: string;
};

export function toDefinition(nodes: Node[], edges: Edge[]): FlowDefinition {
  const start = nodes.find((n) => !edges.some((e) => e.target === n.id))?.id ?? nodes[0]?.id ?? "";

  const defNodes: FlowDefinitionNode[] = nodes.map((n) => {
    const data = n.data as Record<string, unknown>;
    const node: FlowDefinitionNode = {
      ...data,
      id: n.id,
      type: data.type as string,
      position: n.position,
    };

    if (node.type !== "condition") {
      const outgoing = edges.find((e) => e.source === n.id);
      if (outgoing) node.next = outgoing.target;
    }

    return node;
  });

  return { nodes: defNodes, start };
}

export function fromDefinition(definition: FlowDefinition | null | undefined): { nodes: Node[]; edges: Edge[] } {
  const defNodes = definition?.nodes ?? [];

  const nodes: Node[] = defNodes.map((n) => ({
    id: n.id,
    type: "flowNode",
    position: n.position ?? { x: 0, y: 0 },
    data: { ...n },
  }));

  const edges: Edge[] = [];
  defNodes.forEach((n) => {
    if (n.type === "condition") {
      if (n.thenNext) edges.push({ id: `e-${n.id}-then`, source: n.id, target: n.thenNext, label: "Sim" });
      if (n.elseNext) edges.push({ id: `e-${n.id}-else`, source: n.id, target: n.elseNext, label: "Não" });
      return;
    }
    if (n.next) edges.push({ id: `e-${n.id}-next`, source: n.id, target: n.next });
  });

  return { nodes, edges };
}
