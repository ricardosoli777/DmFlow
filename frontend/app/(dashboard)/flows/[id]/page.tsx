"use client";

import { Button } from "@/components/ui/button";
import { FlowCanvas } from "@/components/flow-editor/flow-canvas";
import { NodeInspector } from "@/components/flow-editor/node-inspector";
import { NodePalette } from "@/components/flow-editor/node-palette";

// RF04, RF10 — o grafo desenhado aqui é salvo como o mesmo JSON que o
// worker executa (docs/03-motor-de-fluxos.md). Persistência real (save via
// PUT /flows/:id usando o store) entra completa na Wave 4.
export default function FlowEditorPage({ params }: { params: { id: string } }) {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 -m-8">
      <div className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
        <h1 className="text-lg font-semibold">Editor de Fluxo</h1>
        <Button size="sm">Salvar</Button>
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
