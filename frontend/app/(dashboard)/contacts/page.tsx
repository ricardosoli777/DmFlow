"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";

type Contact = { id: string; name: string | null; igsid: string; tags: string[] };

// RF07 — segmentação por tag
export default function ContactsPage() {
  const { data: contacts } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => api.get<Contact[]>("/contacts"),
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Contatos</h1>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="p-4 font-medium">Nome</th>
              <th className="p-4 font-medium">IGSID</th>
              <th className="p-4 font-medium">Tags</th>
            </tr>
          </thead>
          <tbody>
            {(contacts ?? []).map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0">
                <td className="p-4">{c.name ?? "—"}</td>
                <td className="p-4 font-mono text-xs">{c.igsid}</td>
                <td className="p-4">{c.tags.join(", ") || "—"}</td>
              </tr>
            ))}
            {!contacts?.length && (
              <tr>
                <td colSpan={3} className="p-8 text-center text-muted-foreground">
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
