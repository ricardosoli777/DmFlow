"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";

type Contact = { id: string; name: string | null; username: string | null; igsid: string; tags: string[] };

// RF11 — inbox com contatos e intervenção manual (conversa completa entra
// na Wave 4, aqui já lista a base pra abrir a conversa e gerenciar o contato).
export default function InboxPage() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: contacts } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => api.get<Contact[]>("/contacts"),
  });

  const updateContact = useMutation({
    mutationFn: ({ id, ...patch }: { id: string; name?: string | null }) => api.patch(`/contacts/${id}`, patch),
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
  }

  function saveEditing(id: string) {
    updateContact.mutate({ id, name: nameDraft.trim() || null });
    setEditingId(null);
  }

  function handleDelete(c: Contact) {
    if (!window.confirm(`Excluir a conversa com ${c.name ?? c.igsid}? Isso apaga o histórico de mensagens.`)) return;
    deleteContact.mutate(c.id);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Inbox</h1>
      {actionError && <p className="text-sm text-danger">{actionError}</p>}
      <Card className="divide-y divide-border">
        {(contacts ?? []).map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-4 p-4 hover:bg-muted/50">
            {editingId === c.id ? (
              <input
                autoFocus
                className="w-48 rounded-[var(--radius)] border border-border bg-background p-1.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={() => saveEditing(c.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEditing(c.id);
                  if (e.key === "Escape") setEditingId(null);
                }}
              />
            ) : (
              <span className="font-medium">{c.name ?? c.username ?? c.igsid}</span>
            )}
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{c.igsid}</span>
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
                title="Excluir conversa/contato"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {!contacts?.length && <p className="p-8 text-center text-muted-foreground">Nenhuma conversa ainda.</p>}
      </Card>
    </div>
  );
}
