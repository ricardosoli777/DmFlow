"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Flow = { id: string; name: string; updatedAt: string };

export default function FlowsPage() {
  const { data: flows } = useQuery({
    queryKey: ["flows"],
    queryFn: () => api.get<Flow[]>("/flows"),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Fluxos</h1>
        <Button asChild>
          <Link href="/flows/novo">Novo fluxo</Link>
        </Button>
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
