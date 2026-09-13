"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";

type Contact = { id: string; name: string | null; username: string | null; igsid: string; tags: string[] };

// RF07 — segmentação por tag, e edição/remoção manual do contato
export default function ContactsPage() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [tagsDraft, setTagsDraft] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: contacts } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => api.get<Contact[]>("/contacts"),
  });

  const updateContact = useMutation({
    mutationFn: ({ id, ...patch }: { id: string; name?: string | null; tags?: string[] }) =>
      api.patch(`/contacts/${id}`, patch),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (err: unknown) => setActionError(err instanceof Error ? err.message : "Não foi possível salvar."),
  });

  const deleteContact = useMutation({
    mutationFn: (id: string) => api.delete(`/contacts/${id}`),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (err: unknown) => setActionError(err instanceof Error ? err.message : "Não foi possível excluir."),
  });

  function startEditing(c: Contact) {
    setEditingId(c.id);
    setNameDraft(c.name ?? "");
    setTagsDraft(c.tags.join(", "));
  }

  function saveEditing(id: string) {
    updateContact.mutate({
      id,
      name: nameDraft.trim() || null,
      tags: tagsDraft
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
    setEditingId(null);
  }

  function handleDelete(c: Contact) {
    if (!window.confirm(`Excluir o contato ${c.name ?? c.igsid}? Isso apaga também o histórico de mensagens dele.`))
      return;
    deleteContact.mutate(c.id);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Contatos</h1>
      {actionError && <p className="text-sm text-danger">{actionError}</p>}
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="p-4 font-medium">Nome</th>
              <th className="p-4 font-medium">IGSID</th>
              <th className="p-4 font-medium">Tags</th>
              <th className="p-4 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {(contacts ?? []).map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0">
                {editingId === c.id ? (
                  <>
                    <td className="p-4">
                      <input
                        autoFocus
                        className="w-40 rounded-[var(--radius)] border border-border bg-background p-1.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                        value={nameDraft}
                        placeholder="Nome"
                        onChange={(e) => setNameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEditing(c.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                      />
                    </td>
                    <td className="p-4 font-mono text-xs">{c.igsid}</td>
                    <td className="p-4">
                      <input
                        className="w-48 rounded-[var(--radius)] border border-border bg-background p-1.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                        value={tagsDraft}
                        placeholder="tag1, tag2"
                        onChange={(e) => setTagsDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEditing(c.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                      />
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => saveEditing(c.id)}
                          className="rounded px-2 py-1 text-xs font-medium text-primary hover:bg-muted"
                        >
                          Salvar
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                        >
                          Cancelar
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="p-4">
                      <button
                        type="button"
                        onClick={() => startEditing(c)}
                        className="rounded px-1.5 py-0.5 text-left hover:bg-muted"
                        title="Clique pra editar"
                      >
                        {c.name ?? c.username ?? <span className="text-muted-foreground">—</span>}
                      </button>
                    </td>
                    <td className="p-4 font-mono text-xs">{c.igsid}</td>
                    <td className="p-4">{c.tags.join(", ") || "—"}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => startEditing(c)}
                          className="rounded px-2 py-1 text-xs font-medium text-primary hover:bg-muted"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(c)}
                          disabled={deleteContact.isPending}
                          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-danger"
                          title="Excluir contato"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {!contacts?.length && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-muted-foreground">
                  Nenhum contato ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
