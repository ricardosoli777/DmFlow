import {
  Clock,
  ExternalLink,
  GitBranch,
  Image as ImageIcon,
  MessageSquare,
  MousePointerClick,
  Music,
  Send,
  StopCircle,
  Tag,
  Trash2,
  Video,
  Webhook,
} from "lucide-react";
import { Handle, Position, type NodeProps } from "reactflow";
import { useFlowEditorStore, type FlowNodeType } from "@/stores/flow-editor.store";

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

type ButtonOption = { label: string; next?: string; url?: string };

type NodeData = {
  type: FlowNodeType;
  label: string;
  text?: string;
  prompt?: string;
  url?: string;
  tag?: string;
  options?: ButtonOption[];
  duration?: number;
  unit?: "seconds" | "minutes" | "hours";
  field?: string;
  equals?: string;
};

// Node visual do canvas — RF10. Mostra o conteúdo real configurado (texto,
// CTA dos botões) direto no card, não só o label genérico do tipo — edição
// completa fica no painel de propriedades (node-inspector.tsx).
export function FlowNode({ id, data, selected }: NodeProps<NodeData>) {
  const Icon = icons[data.type];
  const preview = getPreview(data);
  const deleteNode = useFlowEditorStore((s) => s.deleteNode);

  return (
    <div
      className={`group relative min-w-[200px] max-w-[260px] rounded-[var(--radius)] border bg-card px-4 py-3 shadow-sm ${
        selected ? "border-primary ring-2 ring-primary/30" : "border-border"
      }`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          deleteNode(id);
        }}
        className="absolute -right-2 -top-2 hidden h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm hover:border-danger hover:text-danger group-hover:flex"
        aria-label="Excluir node"
      >
        <Trash2 size={12} />
      </button>

      <Handle type="target" position={Position.Top} className="!bg-primary" />
      <div className="flex items-center gap-2">
        <Icon size={16} className="shrink-0 text-primary" />
        <span className="text-sm font-medium">{data.label}</span>
      </div>

      {preview && <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{preview}</p>}

      {data.options && data.options.length > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          {data.options.map((opt, i) => (
            <div
              key={i}
              className="flex items-center justify-center gap-1 truncate rounded-full border border-border bg-muted px-2 py-0.5 text-center text-xs"
            >
              {opt.url !== undefined && <ExternalLink size={10} className="shrink-0" />}
              <span className="truncate">{opt.label || "(sem texto)"}</span>
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
    case "delay": {
      const unitLabel = { seconds: "s", minutes: "min", hours: "h" }[data.unit ?? "minutes"];
      return data.duration ? `${data.duration}${unitLabel}` : null;
    }
    case "condition":
      return data.field ? `se ${data.field} = ${data.equals || "?"}` : null;
    default:
      return null;
  }
}
