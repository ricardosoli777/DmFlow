"use client";

import { useCallback, useMemo, useRef } from "react";
import ReactFlow, { Background, Controls, type ReactFlowInstance } from "reactflow";
import "reactflow/dist/style.css";
import { useFlowEditorStore, type FlowNodeType } from "@/stores/flow-editor.store";
import { FlowNode } from "./flow-node";

// RF10 — canvas de drag and drop: solta um tipo de node da paleta aqui,
// vira um node real conectável no fluxo.
export function FlowCanvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, selectNode } = useFlowEditorStore();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rfInstance = useRef<ReactFlowInstance | null>(null);

  const nodeTypes = useMemo(() => ({ flowNode: FlowNode }), []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/dmflow-node-type") as FlowNodeType;
      if (!type || !wrapperRef.current || !rfInstance.current) return;

      const bounds = wrapperRef.current.getBoundingClientRect();
      const position = rfInstance.current.project({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });

      addNode(type, position);
    },
    [addNode],
  );

  return (
    <div ref={wrapperRef} className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={(instance) => (rfInstance.current = instance)}
        onDrop={onDrop}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onNodeClick={(_, node) => selectNode(node.id)}
        onPaneClick={() => selectNode(null)}
        deleteKeyCode={["Backspace", "Delete"]}
        fitView
      >
        <Background gap={16} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
