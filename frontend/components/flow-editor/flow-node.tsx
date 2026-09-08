import {
  Clock,
  GitBranch,
  Image as ImageIcon,
  MessageSquare,
  MousePointerClick,
  Music,
  Send,
  StopCircle,
  Tag,
  Video,
  Webhook,
} from "lucide-react";
import { Handle, Position, type NodeProps } from "reactflow";
import type { FlowNodeType } from "@/stores/flow-editor.store";

const icons: Record<FlowNodeType, typeof MessageSquare> = {
  message: MessageSquare,
  buttons: MousePointerClick,
  image: ImageIcon,
  audio: Music,
  video: Video,
  delay: Clock,
  condition: GitBranch,
  capture: Send,
  tag: Tag,
  webhook: Webhook,
  end: StopCircle,
};

type ButtonOption = { label: string; next: string };

type NodeData = {
  type: FlowNodeType;
  label: string;
  text?: string;
  prompt?: string;
  url?: string;
  tag?: string;
  options?: ButtonOption[];
};

// Node visual do canvas — RF10. Mostra o conteúdo real configurado (texto,
// CTA dos botões) direto no card, não só o label genérico do tipo — edição
// completa fica no painel de propriedades (node-inspector.tsx).
export function FlowNode({ data, selected }: NodeProps<NodeData>) {
  const Icon = icons[data.type];
  const preview = getPreview(data);

  return (
    <div
      className={`min-w-[200px] max-w-[260px] rounded-[var(--radius)] border bg-card px-4 py-3 shadow-sm ${
        selected ? "border-primary ring-2 ring-primary/30" : "border-border"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-primary" />
      <div className="flex items-center gap-2">
        <Icon size={16} className="shrink-0 text-primary" />
        <span className="text-sm font-medium">{data.label}</span>
      </div>

      {preview && <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{preview}</p>}

      {data.type === "buttons" && data.options && data.options.length > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          {data.options.map((opt, i) => (
            <div
              key={i}
              className="truncate rounded-full border border-border bg-muted px-2 py-0.5 text-center text-xs"
            >
              {opt.label || "(sem texto)"}
            </div>
          ))}
        </div>
      )}

      {data.type !== "end" && <Handle type="source" position={Position.Bottom} className="!bg-primary" />}
    </div>
  );
}

function getPreview(data: NodeData): string | null {
  switch (data.type) {
    case "message":
      return data.text || null;
    case "capture":
      return data.prompt || null;
    case "buttons":
      return data.text || null;
    case "image":
    case "audio":
    case "video":
      return data.url || null;
    case "tag":
      return data.tag ? `#${data.tag}` : null;
    case "webhook":
      return data.url || null;
    default:
      return null;
  }
}
