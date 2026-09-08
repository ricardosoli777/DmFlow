"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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

type Flow = { id: string; name: string };

export default function TriggersPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [postId, setPostId] = useState("");
  const [keyword, setKeyword] = useState("");
  const [flowId, setFlowId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: triggers } = useQuery({
    queryKey: ["triggers"],
    queryFn: () => api.get<Trigger[]>("/triggers"),
  });

  const { data: flows } = useQuery({
    queryKey: ["flows"],
    queryFn: () => api.get<Flow[]>("/flows"),
  });

  const create = useMutation({
    mutationFn: () =>
      api.post("/triggers", { postId, keyword: keyword.trim() || undefined, flowId }),
    onSuccess: () => {
      setShowForm(false);
      setPostId("");
      setKeyword("");
      setFlowId("");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["triggers"] });
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : "Erro ao criar"),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!postId.trim() || !flowId) {
      setError("Preencha o link/ID do post e escolha um fluxo.");
      return;
    }
    create.mutate();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Triggers</h1>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancelar" : "Nova automação"}</Button>
      </div>

      {showForm && (
        <Card>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-6">
            <label className="flex flex-col gap-1 text-sm">
              Link ou ID do post/reel
              <input
                className="rounded-[var(--radius)] border border-border bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                placeholder="https://instagram.com/p/... ou o ID da mídia"
                value={postId}
                onChange={(e) => setPostId(e.target.value)}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Palavra-chave (deixe em branco pra disparar em qualquer comentário)
              <input
                className="rounded-[var(--radius)] border border-border bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                placeholder="ex: quero, eu, link"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Fluxo a disparar
              <select
                className="rounded-[var(--radius)] border border-border bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                value={flowId}
                onChange={(e) => setFlowId(e.target.value)}
              >
                <option value="">Escolha um fluxo...</option>
                {(flows ?? []).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              {!flows?.length && (
                <span className="text-xs text-muted-foreground">
                  Nenhum fluxo criado ainda — crie um em &ldquo;Fluxos&rdquo; primeiro.
                </span>
              )}
            </label>

            {error && <p className="text-sm text-danger">{error}</p>}

            <Button type="submit" disabled={create.isPending} className="w-fit">
              {create.isPending ? "Criando..." : "Criar automação"}
            </Button>
          </form>
        </Card>
      )}

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
                <td className="max-w-[200px] truncate p-4 font-mono text-xs" title={t.postId}>
                  {t.postId}
                </td>
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
