"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, MessageCircle, Users, Workflow, XCircle, Zap } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";

type Overview = {
  contacts: number;
  activeTriggers: number;
  flowRuns: number;
  messagesSent: number;
};

type AccountStatus = { id: string; igUsername: string; connected: boolean; connectionMethod: "meta" | "zernio"; zernioKeySlot?: "primary" | "secondary"; providerHealthy?: boolean; username?: string; error?: string };

type Health = {
  lastEventAt: string | null;
  lastEventProcessed: boolean | null;
  workerLikelyDown: boolean;
  pendingEvents: number;
  queue: { waiting?: number; active?: number; failed?: number; completed?: number };
  accounts: AccountStatus[];
};

type RecentContact = {
  id: string;
  name: string | null;
  username: string | null;
  igsid: string;
  lastInboundAt: string | null;
  lastMessage: string | null;
  origin: {
    flowName: string;
    triggerType: "comment" | "dm_keyword" | null;
    triggerKeyword: string | null;
    postId: string | null;
  } | null;
};

export default function OverviewPage() {
  const { data } = useQuery({
    queryKey: ["metrics-overview"],
    queryFn: () => api.get<Overview>("/metrics/overview"),
  });

  const { data: health } = useQuery({
    queryKey: ["metrics-health"],
    queryFn: () => api.get<Health>("/metrics/health"),
    refetchInterval: 30_000,
  });

  const { data: recentContacts } = useQuery({
    queryKey: ["metrics-recent-contacts"],
    queryFn: () => api.get<RecentContact[]>("/metrics/recent-contacts"),
    refetchInterval: 30_000,
  });

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold">Visão Geral</h1>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Contatos" value={data?.contacts ?? "—"} icon={Users} />
        <StatCard label="Triggers ativos" value={data?.activeTriggers ?? "—"} icon={Zap} />
        <StatCard label="Fluxos executados" value={data?.flowRuns ?? "—"} icon={Workflow} />
        <StatCard label="Mensagens enviadas" value={data?.messagesSent ?? "—"} icon={MessageCircle} />
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Saúde do app</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {(health?.accounts ?? []).map((a) => (
            <HealthCard
              key={a.id}
              title={a.igUsername || a.username ? `Conexão — @${a.igUsername || a.username}` : "Conexão com o Instagram"}
              ok={a.connectionMethod === "zernio" && !a.providerHealthy ? null : a.connected}
              okText={a.connectionMethod === "zernio" ? a.providerHealthy ? `Conta encontrada no Zernio — chave ${a.zernioKeySlot === "secondary" ? "2" : "1"}` : `Conta vinculada (chave ${a.zernioKeySlot === "secondary" ? "2" : "1"}); ${a.error ?? "aguardando validação do Zernio"}` : a.username ? `Conectado como @${a.username} via Meta` : "Conectado via Meta"}
              badText={a.error ?? "Sem resposta da Graph API"}
            />
          ))}
          {health && health.accounts.length === 0 && (
            <HealthCard
              title="Conexão com o Instagram"
              ok={false}
              okText=""
              badText="Nenhuma conta conectada — configure em Configurações"
            />
          )}
          <HealthCard
            title="Worker / fila de eventos"
            ok={health ? !health.workerLikelyDown : null}
            okText={`Fila em dia (${health?.pendingEvents ?? 0} pendente(s))`}
            badText={`${health?.pendingEvents ?? 0} evento(s) parado(s) na fila há mais de 10min — worker pode estar fora do ar`}
          />
          <HealthCard
            title="Último evento recebido"
            ok={health?.lastEventAt ? true : null}
            okText={health?.lastEventAt ? new Date(health.lastEventAt).toLocaleString("pt-BR") : "—"}
            badText="Nenhum evento recebido ainda — verifique o webhook no painel da Meta"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Contatos recentes</h2>
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="p-4 font-medium">Contato</th>
                <th className="p-4 font-medium">Entrou por</th>
                <th className="p-4 font-medium">Última mensagem</th>
                <th className="p-4 font-medium">Quando</th>
              </tr>
            </thead>
            <tbody>
              {(recentContacts ?? []).map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="font-medium">{c.name ?? c.username ?? c.igsid}</span>
                      {c.username && <span className="text-xs text-muted-foreground">@{c.username}</span>}
                    </div>
                  </td>
                  <td className="p-4">
                    {c.origin ? (
                      <div className="flex flex-col gap-1">
                        <Badge variant={c.origin.triggerType === "comment" ? "rascunho" : "ativo"}>
                          {c.origin.triggerType === "comment" ? "Comentário" : "DM"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {c.origin.triggerKeyword ?? "sem palavra-chave"} → {c.origin.flowName}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="max-w-[280px] truncate p-4" title={c.lastMessage ?? ""}>
                    {c.lastMessage ?? <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="p-4 text-xs text-muted-foreground">
                    {c.lastInboundAt ? new Date(c.lastInboundAt).toLocaleString("pt-BR") : "—"}
                  </td>
                </tr>
              ))}
              {!recentContacts?.length && (
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
    </div>
  );
}

function HealthCard({
  title,
  ok,
  okText,
  badText,
}: {
  title: string;
  ok: boolean | null;
  okText: string;
  badText: string;
}) {
  const Icon = ok === null ? AlertTriangle : ok ? CheckCircle2 : XCircle;
  const color = ok === null ? "text-muted-foreground" : ok ? "text-success" : "text-danger";

  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <Icon size={18} className={`mt-0.5 shrink-0 ${color}`} />
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{ok === false ? badText : okText}</p>
        </div>
      </CardContent>
    </Card>
  );
}
