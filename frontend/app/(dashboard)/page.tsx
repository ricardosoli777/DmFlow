"use client";

import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Users, Workflow, Zap } from "lucide-react";
import { api } from "@/lib/api";
import { StatCard } from "@/components/ui/stat-card";

type Overview = {
  contacts: number;
  activeTriggers: number;
  flowRuns: number;
  messagesSent: number;
};

export default function OverviewPage() {
  const { data } = useQuery({
    queryKey: ["metrics-overview"],
    queryFn: () => api.get<Overview>("/metrics/overview"),
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
    </div>
  );
}
