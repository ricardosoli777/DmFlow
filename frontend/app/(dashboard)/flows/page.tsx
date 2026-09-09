"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Flow = { id: string; name: string; updatedAt: string };

export default function FlowsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: flows } = useQuery({
    queryKey: ["flows"],
    queryFn: () => api.get<Flow[]>("/flows"),
  });

  const createFlow = useMutation({
    mutationFn: () => api.post<Flow>("/flows", { name: "Novo fluxo", definition: { nodes: [], start: "" } }),
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
        <Button onClick={() => createFlow.mutate()} disabled={createFlow.isPending}>
          {createFlow.isPending ? "Criando..." : "Novo fluxo"}
        </Button>
      </div>

      {createFlow.isError && <p className="text-sm text-danger">Não foi possível criar o fluxo.</p>}
      {deleteError && <p className="text-sm text-danger">{deleteError}</p>}

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
