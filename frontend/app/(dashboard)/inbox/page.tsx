"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";

type Contact = { id: string; name: string | null; igsid: string };

// RF11 — inbox com contatos e intervenção manual (conversa completa entra
// na Wave 4, aqui já lista a base pra abrir a conversa).
export default function InboxPage() {
  const { data: contacts } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => api.get<Contact[]>("/contacts"),
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Inbox</h1>
      <Card className="divide-y divide-border">
        {(contacts ?? []).map((c) => (
          <div key={c.id} className="flex items-center justify-between p-4 hover:bg-muted/50">
            <span className="font-medium">{c.name ?? c.igsid}</span>
            <span className="text-xs text-muted-foreground">{c.igsid}</span>
          </div>
        ))}
        {!contacts?.length && (
          <p className="p-8 text-center text-muted-foreground">Nenhuma conversa ainda.</p>
        )}
      </Card>
    </div>
  );
}
