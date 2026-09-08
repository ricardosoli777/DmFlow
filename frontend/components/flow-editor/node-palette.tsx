"use client";

import { Clock, GitBranch, MessageSquare, MousePointerClick, Send, StopCircle, Tag, Webhook } from "lucide-react";
import type { FlowNodeType } from "@/stores/flow-editor.store";

const paletteItems: { type: FlowNodeType; label: string; icon: typeof MessageSquare }[] = [
  { type: "message", label: "Mensagem", icon: MessageSquare },
  { type: "buttons", label: "Botões", icon: MousePointerClick },
  { type: "delay", label: "Aguardar", icon: Clock },
  { type: "condition", label: "Condição", icon: GitBranch },
  { type: "capture", label: "Capturar", icon: Send },
  { type: "tag", label: "Tag", icon: Tag },
  { type: "webhook", label: "Webhook", icon: Webhook },
  { type: "end", label: "Fim", icon: StopCircle },
];

// RF10 — arrasta um item daqui pro canvas (drag and drop nativo do HTML5,
// capturado pelo onDrop do FlowCanvas).
export function NodePalette() {
  return (
    <div className="flex w-48 flex-col gap-2 border-r border-border bg-card p-4">
      <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Nodes</p>
      {paletteItems.map((item) => (
        <div
          key={item.type}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("application/dmflow-node-type", item.type);
            e.dataTransfer.effectAllowed = "move";
          }}
          className="flex cursor-grab items-center gap-2 rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm active:cursor-grabbing"
        >
          <item.icon size={16} className="text-primary" />
          {item.label}
        </div>
      ))}
    </div>
  );
}
