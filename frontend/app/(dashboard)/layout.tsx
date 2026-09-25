"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { getCurrentWorkspaceId } from "@/lib/api";

// RNF10 — antes desta wave nenhuma rota do backend validava o token mesmo,
// então essa página abria "funcionando" mesmo sem sessão (só as chamadas de
// API falhavam silenciosamente). Agora que o backend exige JWT + workspace
// de verdade, um guard simples evita telas quebradas cheias de "—".
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
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

  const isFlowEditor = /^\/flows\/[^/]+$/.test(pathname);

  return (
    <div className="min-h-screen md:flex">
      {!isFlowEditor && <SidebarNav />}
      <main className={`min-w-0 flex-1 overflow-y-auto ${isFlowEditor ? "h-screen" : "p-4 pb-24 sm:p-6 sm:pb-24 md:p-8 md:pb-8"}`}>{children}</main>
    </div>
  );
}
