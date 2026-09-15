"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { getCurrentWorkspaceId } from "@/lib/api";

// RNF10 — antes desta wave nenhuma rota do backend validava o token mesmo,
// então essa página abria "funcionando" mesmo sem sessão (só as chamadas de
// API falhavam silenciosamente). Agora que o backend exige JWT + workspace
// de verdade, um guard simples evita telas quebradas cheias de "—".
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("dmflow_token");
    if (!token || !getCurrentWorkspaceId()) {
      router.replace("/login");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) return null;

  return (
    <div className="flex">
      <SidebarNav />
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
