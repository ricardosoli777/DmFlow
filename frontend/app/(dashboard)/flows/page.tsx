"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Play, Trash2 } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FLOW_TEMPLATES } from "@/lib/flow-templates";
import type { FlowDefinition } from "@/lib/flow-definition";

type Flow = { id: string; name: string; updatedAt: string };
type SavedTemplate = { id: string; name: string; description: string; definition: FlowDefinition; updatedAt: string };

export default function FlowsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: flows } = useQuery({
    queryKey: ["flows"],
    queryFn: () => api.get<Flow[]>("/flows"),
  });
  const { data: savedTemplates } = useQuery({
    queryKey: ["flow-templates"],
    queryFn: () => api.get<SavedTemplate[]>("/flow-templates"),
  });

  const createFlow = useMutation({
    mutationFn: (templateId: string) => {
      const template = FLOW_TEMPLATES.find((item) => item.id === templateId) ?? FLOW_TEMPLATES[0];
      return api.post<Flow>("/flows", { name: template.name, definition: template.definition });
    },
    onSuccess: (flow) => {
      queryClient.invalidateQueries({ queryKey: ["flows"] });
      router.push(`/flows/${flow.id}`);
    },
  });

  const deleteFlow = useMutation({
    mutationFn: (id: string) => api.delete(`/flows/${id}`),
    onSuccess: () => {
      setDeleteError(null);
      queryClient.invalidateQueries({ queryKey: ["flows"] });
    },
    onError: (err: unknown) => setDeleteError(err instanceof Error ? err.message : "Não foi possível excluir."),
  });
  const deleteTemplate = useMutation({
    mutationFn: (id: string) => api.delete(`/flow-templates/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["flow-templates"] }),
  });

  const createFlowFromSavedTemplate = useMutation({
    mutationFn: (template: SavedTemplate) => api.post<Flow>("/flows", { name: template.name, definition: template.definition }),
    onSuccess: (flow) => {
      queryClient.invalidateQueries({ queryKey: ["flows"] });
      router.push(`/flows/${flow.id}`);
    },
  });

  function handleDelete(e: React.MouseEvent, flow: Flow) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Excluir o fluxo "${flow.name}"? Essa ação não pode ser desfeita.`)) return;
    deleteFlow.mutate(flow.id);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Fluxos</h1>
        <Button onClick={() => createFlow.mutate("blank")} disabled={createFlow.isPending}>
          {createFlow.isPending ? "Criando..." : "Novo fluxo"}
        </Button>
      </div>

      {createFlow.isError && <p className="text-sm text-danger">Não foi possível criar o fluxo.</p>}
      {deleteError && <p className="text-sm text-danger">{deleteError}</p>}

      <section>
        <h2 className="mb-3 text-sm font-medium">Começar por template</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FLOW_TEMPLATES.filter((template) => template.id !== "blank").map((template) => (
            <Card key={template.id} className="p-4">
              <p className="font-medium">{template.name}</p>
              <p className="mt-1 min-h-10 text-xs text-muted-foreground">{template.description}</p>
              <Button className="mt-3" size="sm" onClick={() => createFlow.mutate(template.id)} disabled={createFlow.isPending}>
                Usar template
              </Button>
            </Card>
          ))}
        </div>
      </section>

      {!!savedTemplates?.length && (
        <section>
          <h2 className="mb-3 text-sm font-medium">Meus templates</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {savedTemplates.map((template) => (
              <Card key={template.id} className="p-4">
                <p className="font-medium">{template.name}</p>
                <p className="mt-1 min-h-10 text-xs text-muted-foreground">
                  {template.description || `${template.definition.nodes.length} nodes`}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => createFlowFromSavedTemplate.mutate(template)} disabled={createFlowFromSavedTemplate.isPending}>
                    <Play size={14} /> Usar e editar
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      if (window.confirm(`Excluir o template "${template.name}"?`)) deleteTemplate.mutate(template.id);
                    }}
                    disabled={deleteTemplate.isPending}
                    aria-label={`Excluir template ${template.name}`}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(flows ?? []).map((flow) => (
          <Link key={flow.id} href={`/flows/${flow.id}`}>
            <Card className="group relative transition-colors hover:border-primary">
              <button
                type="button"
                onClick={(e) => handleDelete(e, flow)}
                disabled={deleteFlow.isPending}
                className="absolute right-3 top-3 hidden rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-danger group-hover:block"
                aria-label={`Excluir fluxo ${flow.name}`}
              >
                <Trash2 size={14} />
              </button>
              <CardHeader>
                <CardTitle>{flow.name}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Atualizado em {new Date(flow.updatedAt).toLocaleDateString("pt-BR")}
              </CardContent>
            </Card>
          </Link>
        ))}
        {!flows?.length && <p className="text-muted-foreground">Nenhum fluxo criado ainda.</p>}
      </div>
    </div>
  );
}
