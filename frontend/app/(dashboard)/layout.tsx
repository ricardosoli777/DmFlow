import { SidebarNav } from "@/components/layout/sidebar-nav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex">
      <SidebarNav />
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
