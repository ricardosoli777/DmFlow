"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { fromDefinition, toDefinition, type FlowDefinition } from "@/lib/flow-definition";
import { useFlowEditorStore } from "@/stores/flow-editor.store";
import { Button } from "@/components/ui/button";
import { FlowCanvas } from "@/components/flow-editor/flow-canvas";
import { NodeInspector } from "@/components/flow-editor/node-inspector";
import { NodePalette } from "@/components/flow-editor/node-palette";

type FlowRecord = { id: string; name: string; definition: FlowDefinition };

// RF04, RF10 — o grafo desenhado aqui é salvo como o mesmo JSON que o worker
// executa (docs/03-motor-de-fluxos.md). Ver frontend/lib/flow-definition.ts
// pra conversão entre o grafo do canvas (nodes+edges) e esse JSON.
export default function FlowEditorPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const queryClient = useQueryClient();
  const { nodes, edges, setNodes, setEdges } = useFlowEditorStore();
  const [name, setName] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const loadedFlowId = useRef<string | null>(null);
  const skipNextDirtyCheck = useRef(false);

  const { data: flow, isLoading, isError } = useQuery({
    queryKey: ["flow", id],
    queryFn: () => api.get<FlowRecord>(`/flows/${id}`),
  });

  useEffect(() => {
    if (!flow || loadedFlowId.current === flow.id) return;
    loadedFlowId.current = flow.id;
    skipNextDirtyCheck.current = true;
    setName(flow.name);
    const { nodes: loadedNodes, edges: loadedEdges } = fromDefinition(flow.definition);
    setNodes(loadedNodes);
    setEdges(loadedEdges);
    setDirty(false);
  }, [flow, setNodes, setEdges]);

  // Qualquer mudança no canvas (ou no nome) depois do carregamento inicial
  // marca como "não salvo" — evita repetir o bug do botão Salvar que não
  // dava nenhum feedback e fazia parecer que o fluxo tinha sido salvo.
  useEffect(() => {
    if (loadedFlowId.current !== id) return;
    if (skipNextDirtyCheck.current) {
      skipNextDirtyCheck.current = false;
      return;
    }
    setDirty(true);
  }, [nodes, edges, name, id]);

  useEffect(() => {
    function warnUnsaved(e: BeforeUnloadEvent) {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", warnUnsaved);
    return () => window.removeEventListener("beforeunload", warnUnsaved);
  }, [dirty]);

  const save = useMutation({
    mutationFn: () => api.put(`/flows/${id}`, { name: name.trim() || "Sem título", definition: toDefinition(nodes, edges) }),
    onSuccess: () => {
      setSaveError(null);
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["flows"] });
    },
    onError: (err: unknown) => {
      setSaveError(err instanceof Error ? err.message : "Não foi possível salvar.");
    },
  });

  if (isLoading) {
    return <p className="p-8 text-sm text-muted-foreground">Carregando fluxo...</p>;
  }

  if (isError || !flow) {
    return <p className="p-8 text-sm text-danger">Não foi possível carregar este fluxo.</p>;
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 -m-8">
      <div className="flex items-center justify-between gap-4 border-b border-border bg-card px-6 py-3">
        <input
          className="min-w-0 flex-1 rounded-[var(--radius)] border border-transparent bg-transparent px-2 py-1 text-lg font-semibold outline-none focus:border-border focus:bg-background"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do fluxo"
        />
        <div className="flex items-center gap-3">
          {!dirty && !save.isPending && !saveError && (
            <span className="flex items-center gap-1 text-xs text-success">
              <CheckCircle2 size={14} /> Salvo
            </span>
          )}
          {dirty && !save.isPending && !saveError && (
            <span className="text-xs text-muted-foreground">Alterações não salvas</span>
          )}
          {saveError && (
            <span className="flex items-center gap-1 text-xs text-danger">
              <XCircle size={14} /> {saveError}
            </span>
          )}
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending || !dirty}>
            {save.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <NodePalette />
        <div className="flex-1">
          <FlowCanvas />
        </div>
        <NodeInspector />
      </div>
    </div>
  );
}
