"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Trash2 } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type TrackedLink = {
  id: string;
  label: string;
  destinationUrl: string;
  code: string;
  redirectUrl: string;
  clicks: number;
  createdAt: string;
};

// RF14 — links rastreados: cada um vira um redirect público (`/r/:code`,
// backend/src/routes/tracked-links.ts) que qualquer botão de node pode usar
// em vez da URL final direto, dando CTR por campanha.
export default function LinksPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: links } = useQuery({
    queryKey: ["tracked-links"],
    queryFn: () => api.get<TrackedLink[]>("/tracked-links"),
  });

  const create = useMutation({
    mutationFn: () => api.post("/tracked-links", { label, destinationUrl }),
    onSuccess: () => {
      setShowForm(false);
      setLabel("");
      setDestinationUrl("");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["tracked-links"] });
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : "Erro ao criar"),
  });

  const deleteLink = useMutation({
    mutationFn: (id: string) => api.delete(`/tracked-links/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tracked-links"] }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !destinationUrl.trim()) {
      setError("Preencha o nome e a URL de destino.");
      return;
    }
    create.mutate();
  }

  function handleCopy(link: TrackedLink) {
    navigator.clipboard?.writeText(link.redirectUrl);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId((id) => (id === link.id ? null : id)), 1500);
  }

  function handleDelete(link: TrackedLink) {
    if (!window.confirm(`Excluir o link "${link.label}"? Botões de fluxo que usam ele param de funcionar.`)) return;
    deleteLink.mutate(link.id);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Links rastreados</h1>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancelar" : "Novo link"}</Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Use um link rastreado num botão de link (nodes Mensagem/Botões/Imagem/Áudio/Vídeo) em vez de colar a
        URL final direto, pra ver quantos cliques cada campanha gera.
      </p>

      {showForm && (
        <Card>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
            <label className="flex flex-col gap-1 text-sm">
              Nome (só pra você identificar)
              <input
                className="rounded-[var(--radius)] border border-border bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                placeholder="ex: link do ebook - campanha reel"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              URL de destino
              <input
                className="rounded-[var(--radius)] border border-border bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                placeholder="https://..."
                value={destinationUrl}
                onChange={(e) => setDestinationUrl(e.target.value)}
              />
            </label>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" disabled={create.isPending} className="w-fit">
              {create.isPending ? "Criando..." : "Criar link"}
            </Button>
          </form>
        </Card>
      )}

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="p-4 font-medium">Nome</th>
              <th className="p-4 font-medium">Link rastreado</th>
              <th className="p-4 font-medium">Destino</th>
              <th className="p-4 font-medium">Cliques</th>
              <th className="p-4 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {(links ?? []).map((l) => (
              <tr key={l.id} className="border-b border-border last:border-0">
                <td className="p-4 font-medium">{l.label}</td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <span className="max-w-[220px] truncate font-mono text-xs">{l.redirectUrl}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(l)}
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-primary"
                      title="Copiar link"
                    >
                      <Copy size={14} />
                    </button>
                    {copiedId === l.id && <span className="text-xs text-success">Copiado!</span>}
                  </div>
                </td>
                <td className="max-w-[240px] truncate p-4 text-muted-foreground" title={l.destinationUrl}>
                  {l.destinationUrl}
                </td>
                <td className="p-4 font-medium">{l.clicks}</td>
                <td className="p-4">
                  <button
                    type="button"
                    onClick={() => handleDelete(l)}
                    disabled={deleteLink.isPending}
                    className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-danger"
                    title="Excluir link"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {!links?.length && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                  Nenhum link rastreado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
