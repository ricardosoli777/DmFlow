import type { Connection, Edge, EdgeChange, Node, NodeChange } from "reactflow";
import { addEdge, applyEdgeChanges, applyNodeChanges } from "reactflow";
import { create } from "zustand";

export type FlowNodeType =
  | "message"
  | "buttons"
  | "image"
  | "audio"
  | "video"
  | "delay"
  | "condition"
  | "capture"
  | "tag"
  | "webhook"
  | "end";

// Estado do canvas (client-only) — dados persistidos vêm/vão via TanStack Query,
// nunca misturados aqui. Ver docs/03-motor-de-fluxos.md pro shape final salvo na API.
type FlowEditorState = {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (type: FlowNodeType, position: { x: number; y: number }) => void;
  selectNode: (id: string | null) => void;
  updateNodeData: (id: string, data: Record<string, unknown>) => void;
  deleteNode: (id: string) => void;
};

let idCounter = 0;
const nextId = () => `node_${Date.now()}_${idCounter++}`;

export const useFlowEditorStore = create<FlowEditorState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  onNodesChange: (changes) => set({ nodes: applyNodeChanges(changes, get().nodes) }),
  onEdgesChange: (changes) => set({ edges: applyEdgeChanges(changes, get().edges) }),
  onConnect: (connection) => set({ edges: addEdge(connection, get().edges) }),

  addNode: (type, position) => {
    const id = nextId();
    const node: Node = {
      id,
      type: "flowNode",
      position,
      data: { type, label: defaultLabel(type) },
    };
    set({ nodes: [...get().nodes, node] });
  },

  selectNode: (id) => set({ selectedNodeId: id }),

  updateNodeData: (id, data) => {
    set({
      nodes: get().nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n)),
    });
  },

  deleteNode: (id) => {
    set({
      nodes: get().nodes.filter((n) => n.id !== id),
      edges: get().edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: get().selectedNodeId === id ? null : get().selectedNodeId,
    });
  },
}));

function defaultLabel(type: FlowNodeType): string {
  const labels: Record<FlowNodeType, string> = {
    message: "Nova mensagem",
    buttons: "Botões",
    image: "Enviar imagem",
    audio: "Enviar áudio",
    video: "Enviar vídeo",
    delay: "Aguardar",
    condition: "Condição",
    capture: "Capturar resposta",
    tag: "Adicionar tag",
    webhook: "Chamar webhook",
    end: "Fim do fluxo",
  };
  return labels[type];
}
