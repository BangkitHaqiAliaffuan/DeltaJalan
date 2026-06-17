import { Link, useLocation } from "@tanstack/react-router";
import { Icon } from "@/components/jk/Icon";
import { getCurrentUser, clearAuth } from "@/lib/auth";
import { useEffect, useState, type ReactNode } from "react";

const ADMIN_MENU = [
  { section: "Manajemen", items: [
    { icon: "dashboard", label: "Dashboard", to: "/admin/dashboard" },
    { icon: "people", label: "User", to: "/admin/users" },
    { icon: "groups", label: "UPR", to: "/admin/uprs" },
    { icon: "description", label: "Laporan", to: "/admin/reports" },
  ]},
  { section: "Sistem", items: [
    { icon: "file_download", label: "Export", to: "/admin/export" },
    { icon: "history", label: "Aktivitas", to: "/admin/activity" },
    { icon: "settings", label: "Pengaturan", to: "/admin/config" },
  ]},
];

export function AdminLayout({ children }: { children?: ReactNode }) {
  const { pathname } = useLocation();
  const [user, setUser] = useState<ReturnType<typeof getCurrentUser>>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const u = getCurrentUser();
    setUser(u);
    if (!u || u.role !== "admin") {
      window.location.href = "/admin/login";
    }
  }, []);

  function handleLogout() {
    clearAuth();
    window.location.href = "/admin/login";
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#1e40af] transform transition-transform md:translate-x-0 md:static md:z-auto ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between px-5 h-[68px] border-b border-white/15">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0 border border-white/30">
              <span className="text-white text-[15px] font-bold">DJ</span>
            </div>
            <div className="min-w-0">
              <span className="font-semibold text-white text-[15px] leading-tight block truncate">DeltaJalan</span>
              <span className="text-white/60 text-[10px] leading-tight block truncate">Dinas PU Bina Marga</span>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-white/60 hover:text-white">
            <Icon name="close" className="!text-[22px]" />
          </button>
        </div>
        <nav className="px-3 py-4 overflow-y-auto" style={{ height: "calc(100% - 68px - 72px)" }}>
          {ADMIN_MENU.map((group) => (
            <div key={group.section} className="mb-1">
              <span className="block px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-white/40">
                {group.section}
              </span>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.to;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                        active
                          ? "bg-white/15 text-white font-semibold"
                          : "text-white/70 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <Icon name={item.icon} className="!text-[22px]" filled={active} />
                      <span className="text-[14px] font-medium">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 px-4 py-4 border-t border-white/15">
          <div className="flex items-center gap-3 mb-3 px-3">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center border border-white/30 shrink-0">
              <span className="text-white text-[13px] font-bold">{user?.initials ?? "A"}</span>
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-white text-[13px] font-semibold truncate leading-tight">{user?.name ?? "Admin"}</span>
              <span className="text-white/60 text-[11px] truncate leading-tight capitalize">Admin</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-colors text-[13px]"
          >
            <Icon name="logout" className="!text-[18px]" />
            Keluar
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-white border-b border-[#E2E8F0] px-4 md:px-6 h-14 flex items-center gap-3 shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden text-[#475569] hover:text-[#0F172A] -ml-1 w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9] transition-colors">
            <Icon name="menu" className="!text-[22px]" />
          </button>
          <div className="flex-1" />
          <button className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9] transition-colors text-[#475569] relative">
            <Icon name="notifications" className="!text-[22px]" />
          </button>
          <div className="w-8 h-8 rounded-full bg-[#1e40af] flex items-center justify-center text-white text-[12px] font-bold shrink-0">
            {user?.initials ?? "A"}
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
