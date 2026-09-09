"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Flow = { id: string; name: string; updatedAt: string };

export default function FlowsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Fluxos</h1>
        <Button onClick={() => createFlow.mutate()} disabled={createFlow.isPending}>
          {createFlow.isPending ? "Criando..." : "Novo fluxo"}
        </Button>
        {createFlow.isError && <p className="text-sm text-danger">Não foi possível criar o fluxo.</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(flows ?? []).map((flow) => (
          <Link key={flow.id} href={`/flows/${flow.id}`}>
            <Card className="transition-colors hover:border-primary">
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
