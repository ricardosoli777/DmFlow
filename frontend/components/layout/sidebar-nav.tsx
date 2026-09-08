"use client";

import { GitBranch, Inbox, LayoutDashboard, Settings, Users, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Visão Geral", icon: LayoutDashboard },
  { href: "/triggers", label: "Triggers", icon: Zap },
  { href: "/flows", label: "Fluxos", icon: GitBranch },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/contacts", label: "Contatos", icon: Users },
  { href: "/settings", label: "Configurações", icon: Settings },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-border bg-card p-4">
      <div className="mb-8 px-2 text-lg font-bold">DMFlow</div>
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
    </aside>
  );
}
