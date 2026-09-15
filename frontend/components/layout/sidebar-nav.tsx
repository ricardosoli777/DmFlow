"use client";

import { GitBranch, Inbox, LayoutDashboard, Link2, LogOut, Settings, Users, Users2, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { clearSession, getCurrentWorkspaceId, getWorkspaces, setCurrentWorkspaceId } from "@/lib/api";

const items = [
  { href: "/", label: "Visão Geral", icon: LayoutDashboard },
  { href: "/triggers", label: "Triggers", icon: Zap },
  { href: "/flows", label: "Fluxos", icon: GitBranch },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/contacts", label: "Contatos", icon: Users },
  { href: "/links", label: "Links rastreados", icon: Link2 },
  { href: "/settings/team", label: "Time", icon: Users2 },
  { href: "/settings", label: "Configurações", icon: Settings },
];

export function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const workspaces = getWorkspaces();
  const currentId = getCurrentWorkspaceId();

  function handleSwitchWorkspace(id: string) {
    setCurrentWorkspaceId(id);
    router.refresh();
    window.location.href = "/";
  }

  function handleLogout() {
    clearSession();
    router.push("/login");
  }

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-border bg-card p-4">
      <div className="mb-4 flex items-center gap-2 px-2">
        <img src="/logo.svg" alt="" width={28} height={28} className="rounded-md" />
        <span className="text-lg font-bold">DMFlow</span>
      </div>

      {workspaces.length > 0 && (
        <select
          className="mb-4 rounded-[var(--radius)] border border-border bg-background p-2 text-xs outline-none focus:ring-2 focus:ring-primary"
          value={currentId ?? ""}
          onChange={(e) => handleSwitchWorkspace(e.target.value)}
        >
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      )}

      <nav className="flex flex-col gap-1">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-[var(--radius)] px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
              )}
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={handleLogout}
        className="mt-auto flex items-center gap-3 rounded-[var(--radius)] px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
      >
        <LogOut size={18} />
        Sair
      </button>
    </aside>
  );
}
