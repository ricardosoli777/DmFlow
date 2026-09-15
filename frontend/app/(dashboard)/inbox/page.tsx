"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Contact = { id: string; name: string | null; username: string | null; igsid: string; tags: string[] };

type ThreadMessage = {
  id: string;
  direction: "inbound" | "outbound" | "blocked";
  content: string;
  status: "ok" | "skipped" | "failed" | "rate_limited" | "follow_gate_pending";
  reason: string | null;
  createdAt: string;
};

type ContactDetail = Contact & { messages: ThreadMessage[] };

// RF11 — inbox com contatos + conversa completa (thread) e intervenção
// manual de verdade: o envio passa pela fila (worker/src/index.ts) e chama a
// Instagram Messaging API, não só grava no banco.
export default function InboxPage() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");

  const { data: contacts } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => api.get<Contact[]>("/contacts"),
  });

  const { data: selected } = useQuery({
    queryKey: ["contacts", selectedId],
    queryFn: () => api.get<ContactDetail>(`/contacts/${selectedId}`),
    enabled: Boolean(selectedId),
    refetchInterval: selectedId ? 5000 : false,
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
    onSuccess: (_data, id) => {
      setActionError(null);
      if (selectedId === id) setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (err: unknown) => setActionError(err instanceof Error ? err.message : "Não foi possível excluir."),
  });

  const sendMessage = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      api.post(`/contacts/${id}/messages`, { content }),
    onSuccess: () => {
      setActionError(null);
      setDraftText("");
      queryClient.invalidateQueries({ queryKey: ["contacts", selectedId] });
    },
    onError: (err: unknown) => setActionError(err instanceof Error ? err.message : "Não foi possível enviar."),
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

  function handleSend() {
    if (!selectedId || !draftText.trim()) return;
    sendMessage.mutate({ id: selectedId, content: draftText.trim() });
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Inbox</h1>
      {actionError && <p className="text-sm text-danger">{actionError}</p>}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card className="divide-y divide-border">
          {(contacts ?? []).map((c) => (
            <div
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`flex cursor-pointer items-center justify-between gap-4 p-4 hover:bg-muted/50 ${
                selectedId === c.id ? "bg-muted/50" : ""
              }`}
            >
              {editingId === c.id ? (
                <input
                  autoFocus
                  className="w-48 rounded-[var(--radius)] border border-border bg-background p-1.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
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
                <span className="hidden text-xs text-muted-foreground sm:inline">{c.igsid}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    startEditing(c);
                  }}
                  className="rounded px-2 py-1 text-xs font-medium text-primary hover:bg-muted"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(c);
                  }}
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

        <Card className="flex flex-col">
          {!selectedId || !selected ? (
            <p className="p-8 text-center text-muted-foreground">Selecione uma conversa pra ver o histórico.</p>
          ) : (
            <>
              <div className="border-b border-border p-4">
                <p className="font-medium">{selected.name ?? selected.username ?? selected.igsid}</p>
                <p className="text-xs text-muted-foreground">{selected.igsid}</p>
              </div>
              <div className="flex max-h-[420px] min-h-[240px] flex-col gap-2 overflow-y-auto p-4">
                {selected.messages.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground">Sem mensagens ainda.</p>
                )}
                {selected.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[85%] rounded-[var(--radius)] px-3 py-2 text-sm ${
                      m.direction === "inbound"
                        ? "self-start bg-muted"
                        : "self-end bg-primary text-primary-foreground"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    {m.status !== "ok" && (
                      <Badge variant={m.status === "failed" ? "erro" : "pausado"} className="mt-1">
                        {m.status === "failed" ? `Falhou: ${m.reason ?? "erro"}` : m.reason ?? m.status}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 border-t border-border p-4">
                <input
                  className="flex-1 rounded-[var(--radius)] border border-border bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Escreva uma mensagem…"
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSend();
                  }}
                />
                <Button
                  size="sm"
                  onClick={handleSend}
                  disabled={sendMessage.isPending || !draftText.trim()}
                  title="Enviar (a mensagem sai como DM real do Instagram)"
                >
                  <Send size={14} />
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
