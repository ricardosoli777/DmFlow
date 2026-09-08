import { Clock, GitBranch, MessageSquare, MousePointerClick, Send, StopCircle, Tag, Webhook } from "lucide-react";
import { Handle, Position, type NodeProps } from "reactflow";
import type { FlowNodeType } from "@/stores/flow-editor.store";

const icons: Record<FlowNodeType, typeof MessageSquare> = {
  message: MessageSquare,
  buttons: MousePointerClick,
  delay: Clock,
  condition: GitBranch,
  capture: Send,
  tag: Tag,
  webhook: Webhook,
  end: StopCircle,
};

// Node visual do canvas — RF10. O conteúdo real (texto, opções) é editado
// no painel de propriedades (node-inspector.tsx) quando o node é selecionado.
export function FlowNode({ data, selected }: NodeProps<{ type: FlowNodeType; label: string }>) {
  const Icon = icons[data.type];

  return (
    <div
      className={`min-w-[180px] rounded-[var(--radius)] border bg-card px-4 py-3 shadow-sm ${
        selected ? "border-primary ring-2 ring-primary/30" : "border-border"
      }`}
    >
      {data.type !== "message" && <Handle type="target" position={Position.Top} className="!bg-primary" />}
      <div className="flex items-center gap-2">
        <Icon size={16} className="text-primary" />
        <span className="text-sm font-medium">{data.label}</span>
      </div>
      {data.type !== "end" && <Handle type="source" position={Position.Bottom} className="!bg-primary" />}
    </div>
  );
}
