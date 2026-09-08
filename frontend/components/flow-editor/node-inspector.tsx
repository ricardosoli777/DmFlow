"use client";

import { useFlowEditorStore } from "@/stores/flow-editor.store";

// Painel de propriedades — abre quando um node é selecionado no canvas.
// Cada tipo de node tem seus próprios campos (aqui: cobertura mínima pra
// message/buttons/webhook; os demais tipos seguem o mesmo padrão).
export function NodeInspector() {
  const { nodes, selectedNodeId, updateNodeData } = useFlowEditorStore();
  const node = nodes.find((n) => n.id === selectedNodeId);

  if (!node) {
    return (
      <div className="w-72 border-l border-border bg-card p-4 text-sm text-muted-foreground">
        Selecione um node no canvas pra editar.
      </div>
    );
  }

  const type = node.data.type as string;

  return (
    <div className="flex w-72 flex-col gap-4 border-l border-border bg-card p-4">
      <p className="text-xs font-medium uppercase text-muted-foreground">{type}</p>

      {(type === "message" || type === "buttons" || type === "capture") && (
        <label className="flex flex-col gap-1 text-sm">
          Texto
          <textarea
            className="min-h-[80px] rounded-[var(--radius)] border border-border bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            value={(node.data.text as string) ?? ""}
            onChange={(e) => updateNodeData(node.id, { text: e.target.value })}
          />
        </label>
      )}

      {type === "webhook" && (
        <label className="flex flex-col gap-1 text-sm">
          URL
          <input
            className="rounded-[var(--radius)] border border-border bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            value={(node.data.url as string) ?? ""}
            onChange={(e) => updateNodeData(node.id, { url: e.target.value })}
          />
        </label>
      )}

      {type === "tag" && (
        <label className="flex flex-col gap-1 text-sm">
          Tag
          <input
            className="rounded-[var(--radius)] border border-border bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            value={(node.data.tag as string) ?? ""}
            onChange={(e) => updateNodeData(node.id, { tag: e.target.value })}
          />
        </label>
      )}
    </div>
  );
}
