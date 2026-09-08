"use client";

import { Plus, Trash2 } from "lucide-react";
import { useFlowEditorStore } from "@/stores/flow-editor.store";
import { Button } from "@/components/ui/button";

type ButtonOption = { label: string; next: string };

const selectClass =
  "rounded-[var(--radius)] border border-border bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-primary";

// Painel de propriedades — abre quando um node é selecionado no canvas.
// Cada tipo de node tem seus próprios campos.
export function NodeInspector() {
  const { nodes, selectedNodeId, updateNodeData, deleteNode, selectNode } = useFlowEditorStore();
  const node = nodes.find((n) => n.id === selectedNodeId);

  if (!node) {
    return (
      <div className="w-72 border-l border-border bg-card p-4 text-sm text-muted-foreground">
        Selecione um node no canvas pra editar.
      </div>
    );
  }

  const type = node.data.type as string;
  const otherNodes = nodes.filter((n) => n.id !== node.id);
  const options = (node.data.options as ButtonOption[] | undefined) ?? [];

  function updateOption(index: number, patch: Partial<ButtonOption>) {
    if (!node) return;
    const next = options.map((o, i) => (i === index ? { ...o, ...patch } : o));
    updateNodeData(node.id, { options: next });
  }

  function addOption() {
    if (!node) return;
    updateNodeData(node.id, { options: [...options, { label: "", next: "" }] });
  }

  function removeOption(index: number) {
    if (!node) return;
    updateNodeData(
      node.id,
      { options: options.filter((_, i) => i !== index) },
    );
  }

  return (
    <div className="flex w-72 flex-col gap-4 overflow-y-auto border-l border-border bg-card p-4">
      <p className="text-xs font-medium uppercase text-muted-foreground">{type}</p>

      {(type === "message" || type === "buttons") && (
        <label className="flex flex-col gap-1 text-sm">
          Texto
          <textarea
            className="min-h-[80px] rounded-[var(--radius)] border border-border bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            value={(node.data.text as string) ?? ""}
            onChange={(e) => updateNodeData(node.id, { text: e.target.value })}
          />
        </label>
      )}

      {type === "capture" && (
        <label className="flex flex-col gap-1 text-sm">
          Pergunta (o que o bot envia antes de esperar a resposta)
          <textarea
            className="min-h-[80px] rounded-[var(--radius)] border border-border bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            value={(node.data.prompt as string) ?? ""}
            onChange={(e) => updateNodeData(node.id, { prompt: e.target.value })}
          />
          <span className="mt-1">Salvar resposta no campo</span>
          <input
            className="rounded-[var(--radius)] border border-border bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            placeholder="ex: email, telefone"
            value={(node.data.field as string) ?? ""}
            onChange={(e) => updateNodeData(node.id, { field: e.target.value })}
          />
        </label>
      )}

      {["buttons", "message", "image", "audio", "video"].includes(type) && (
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span>Botões (CTA) — opcional</span>
            <Button size="sm" variant="ghost" onClick={addOption}>
              <Plus size={14} /> Adicionar
            </Button>
          </div>
          {options.map((opt, i) => (
            <div key={i} className="flex flex-col gap-1 rounded-[var(--radius)] border border-border p-2">
              <div className="flex items-center gap-1">
                <input
                  className="flex-1 rounded-[var(--radius)] border border-border bg-background p-1.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Texto do botão"
                  value={opt.label}
                  onChange={(e) => updateOption(i, { label: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => removeOption(i)}
                  className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-danger"
                  aria-label="Remover botão"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <select
                className="rounded-[var(--radius)] border border-border bg-background p-1.5 text-xs outline-none focus:ring-2 focus:ring-primary"
                value={opt.next}
                onChange={(e) => updateOption(i, { next: e.target.value })}
              >
                <option value="">Vai para... (escolha um node)</option>
                {otherNodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {(n.data.label as string) ?? n.id}
                  </option>
                ))}
              </select>
            </div>
          ))}
          {options.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhum botão ainda — clique em &ldquo;Adicionar&rdquo;.</p>
          )}
        </div>
      )}

      {(type === "image" || type === "audio" || type === "video") && (
        <label className="flex flex-col gap-1 text-sm">
          URL {type === "image" ? "da imagem" : type === "audio" ? "do áudio" : "do vídeo"}
          <input
            className="rounded-[var(--radius)] border border-border bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            placeholder="https://..."
            value={(node.data.url as string) ?? ""}
            onChange={(e) => updateNodeData(node.id, { url: e.target.value })}
          />
          <span className="text-xs text-muted-foreground">
            Precisa ser uma URL pública (a Meta baixa o arquivo de lá pra enviar).
          </span>
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

      {type === "delay" && (
        <label className="flex flex-col gap-1 text-sm">
          Esperar
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              className="w-20 rounded-[var(--radius)] border border-border bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              value={(node.data.duration as number) ?? 1}
              onChange={(e) => updateNodeData(node.id, { duration: Number(e.target.value) })}
            />
            <select
              className={`flex-1 ${selectClass}`}
              value={(node.data.unit as string) ?? "minutes"}
              onChange={(e) => updateNodeData(node.id, { unit: e.target.value })}
            >
              <option value="seconds">segundos</option>
              <option value="minutes">minutos</option>
              <option value="hours">horas</option>
            </select>
          </div>
          <span className="text-xs text-muted-foreground">
            Agendamento real (BullMQ) ainda não implementado — por enquanto o fluxo segue direto pro
            próximo node sem pausar de verdade. Ver docs/07 (Wave 3).
          </span>
        </label>
      )}

      {type === "condition" && (
        <div className="flex flex-col gap-3 text-sm">
          <label className="flex flex-col gap-1">
            Campo do contato a checar
            <input
              className="rounded-[var(--radius)] border border-border bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              placeholder="ex: email (campo salvo num node Capturar)"
              value={(node.data.field as string) ?? ""}
              onChange={(e) => updateNodeData(node.id, { field: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            É igual a
            <input
              className="rounded-[var(--radius)] border border-border bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              placeholder="valor de comparação"
              value={(node.data.equals as string) ?? ""}
              onChange={(e) => updateNodeData(node.id, { equals: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            Se verdadeiro, vai para
            <select
              className={selectClass}
              value={(node.data.thenNext as string) ?? ""}
              onChange={(e) => updateNodeData(node.id, { thenNext: e.target.value })}
            >
              <option value="">Escolha um node...</option>
              {otherNodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {(n.data.label as string) ?? n.id}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            Se falso, vai para
            <select
              className={selectClass}
              value={(node.data.elseNext as string) ?? ""}
              onChange={(e) => updateNodeData(node.id, { elseNext: e.target.value })}
            >
              <option value="">Escolha um node...</option>
              {otherNodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {(n.data.label as string) ?? n.id}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <hr className="mt-auto border-border" />
      <button
        type="button"
        onClick={() => {
          deleteNode(node.id);
          selectNode(null);
        }}
        className="flex items-center justify-center gap-2 rounded-[var(--radius)] border border-danger/30 py-2 text-sm text-danger hover:bg-danger/10"
      >
        <Trash2 size={14} /> Excluir este node
      </button>
    </div>
  );
}
