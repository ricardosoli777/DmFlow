"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Trigger = {
  id: string;
  postId: string;
  keyword: string | null;
  active: boolean;
  hitCount: number;
  flow: { name: string };
};

export default function TriggersPage() {
  const { data: triggers } = useQuery({
    queryKey: ["triggers"],
    queryFn: () => api.get<Trigger[]>("/triggers"),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Triggers</h1>
        <Button>Nova automação</Button>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="p-4 font-medium">Post</th>
              <th className="p-4 font-medium">Palavra-chave</th>
              <th className="p-4 font-medium">Fluxo</th>
              <th className="p-4 font-medium">Disparos</th>
              <th className="p-4 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {(triggers ?? []).map((t) => (
              <tr key={t.id} className="border-b border-border last:border-0">
                <td className="p-4 font-mono text-xs">{t.postId}</td>
                <td className="p-4">{t.keyword ?? <span className="text-muted-foreground">qualquer comentário</span>}</td>
                <td className="p-4">{t.flow.name}</td>
                <td className="p-4">{t.hitCount}</td>
                <td className="p-4">
                  <Badge variant={t.active ? "ativo" : "pausado"}>{t.active ? "Ativo" : "Pausado"}</Badge>
                </td>
              </tr>
            ))}
            {!triggers?.length && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                  Nenhum trigger criado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
