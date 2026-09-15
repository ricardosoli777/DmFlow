"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Trash2 } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Member = { id: string; email: string; role: "OWNER" | "ADMIN" | "MEMBER"; createdAt: string };
type Invitation = { id: string; email: string; role: "ADMIN" | "MEMBER"; inviteUrl?: string; createdAt: string };

// RF16 — workspace: membros com papel (owner/admin/member) e convites por
// link (quem cria copia e manda pra pessoa — não manda e-mail sozinho).
export default function TeamPage() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [error, setError] = useState<string | null>(null);
  const [newInviteUrl, setNewInviteUrl] = useState<string | null>(null);

  const { data: members } = useQuery({
    queryKey: ["workspace-members"],
    queryFn: () => api.get<Member[]>("/workspace/members"),
  });

  const { data: invitations } = useQuery({
    queryKey: ["workspace-invitations"],
    queryFn: () => api.get<Invitation[]>("/workspace/invitations"),
  });

  const invite = useMutation({
    mutationFn: () => api.post<Invitation>("/workspace/invitations", { email, role }),
    onSuccess: (res) => {
      setError(null);
      setEmail("");
      setNewInviteUrl(res.inviteUrl ?? null);
      queryClient.invalidateQueries({ queryKey: ["workspace-invitations"] });
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : "Não foi possível convidar."),
  });

  const revokeInvite = useMutation({
    mutationFn: (id: string) => api.delete(`/workspace/invitations/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workspace-invitations"] }),
  });

  const changeRole = useMutation({
    mutationFn: ({ id, role: newRole }: { id: string; role: string }) =>
      api.patch(`/workspace/members/${id}`, { role: newRole }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workspace-members"] }),
  });

  const removeMember = useMutation({
    mutationFn: (id: string) => api.delete(`/workspace/members/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workspace-members"] }),
  });

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    invite.mutate();
  }

  function copyInvite(url: string) {
    navigator.clipboard?.writeText(url);
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold">Time</h1>

      <Card className="flex flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold">Convidar</h2>
        <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            E-mail
            <input
              type="email"
              className="rounded-[var(--radius)] border border-border bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Papel
            <select
              className="rounded-[var(--radius)] border border-border bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              value={role}
              onChange={(e) => setRole(e.target.value as "ADMIN" | "MEMBER")}
            >
              <option value="MEMBER">Membro</option>
              <option value="ADMIN">Admin</option>
            </select>
          </label>
          <Button type="submit" disabled={invite.isPending}>
            Gerar link de convite
          </Button>
        </form>
        {error && <p className="text-sm text-danger">{error}</p>}
        {newInviteUrl && (
          <div className="flex items-center gap-2 rounded-[var(--radius)] border border-border bg-muted/30 p-3 text-sm">
            <span className="flex-1 truncate font-mono text-xs">{newInviteUrl}</span>
            <button
              type="button"
              onClick={() => copyInvite(newInviteUrl)}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-primary"
              title="Copiar link"
            >
              <Copy size={14} />
            </button>
          </div>
        )}
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Membros</h2>
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="p-4 font-medium">E-mail</th>
                <th className="p-4 font-medium">Papel</th>
                <th className="p-4 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {(members ?? []).map((m) => (
                <tr key={m.id} className="border-b border-border last:border-0">
                  <td className="p-4">{m.email}</td>
                  <td className="p-4">
                    <select
                      className="rounded-[var(--radius)] border border-border bg-background p-1.5 text-xs outline-none focus:ring-2 focus:ring-primary"
                      value={m.role}
                      onChange={(e) => changeRole.mutate({ id: m.id, role: e.target.value })}
                    >
                      <option value="OWNER">Owner</option>
                      <option value="ADMIN">Admin</option>
                      <option value="MEMBER">Membro</option>
                    </select>
                  </td>
                  <td className="p-4">
                    <button
                      type="button"
                      onClick={() => removeMember.mutate(m.id)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-danger"
                      title="Remover do workspace"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {!members?.length && (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-muted-foreground">
                    Nenhum membro ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      {!!invitations?.length && (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Convites pendentes</h2>
          <Card className="divide-y divide-border">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <span className="font-medium">{inv.email}</span>{" "}
                  <Badge variant="rascunho">{inv.role === "ADMIN" ? "Admin" : "Membro"}</Badge>
                </div>
                <button
                  type="button"
                  onClick={() => revokeInvite.mutate(inv.id)}
                  className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-danger"
                  title="Cancelar convite"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}
