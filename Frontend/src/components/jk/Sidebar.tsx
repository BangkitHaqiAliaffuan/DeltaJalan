import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Icon } from "./Icon";
import { getCurrentUser, clearAuth, getToken, type User } from "@/lib/auth";
import { useEffect, useState } from "react";

interface MenuItem {
  icon: string;
  label: string;
  to: string;
  disabled?: boolean;
}

const PETUGAS_MENU: MenuItem[] = [
  { icon: "home", label: "Beranda", to: "/home" },
  { icon: "cloud_upload", label: "Upload & Analisis", to: "/upload" },
  { icon: "description", label: "Laporan Saya", to: "/my-reports" },
  { icon: "analytics", label: "Semua Laporan", to: "/reports" },
  { icon: "settings", label: "Pengaturan", to: "/settings", disabled: true },
];

const SUPERVISOR_MENU: MenuItem[] = [
  { icon: "dashboard", label: "Dashboard", to: "/supervisor" },
  { icon: "rate_review", label: "Review Laporan", to: "/supervisor" },
  { icon: "analytics", label: "Laporan Saya", to: "/my-reports" },
  { icon: "bar_chart", label: "Statistik", to: "/stats", disabled: true },
  { icon: "settings", label: "Pengaturan", to: "/settings", disabled: true },
];

export function Sidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const menuItems = user?.role === "supervisor" ? SUPERVISOR_MENU : PETUGAS_MENU;

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  const displayUser = user ?? {
    name: "",
    role: "petugas" as const,
    wilayah: "",
    initials: "",
  };

  async function handleLogout() {
    const token = getToken();
    // Panggil API logout untuk invalidate token di server
    if (token) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Abaikan error jaringan — tetap logout di sisi client
      }
    }
    clearAuth();
    navigate({ to: "/" });
  }

  return (
    <aside className="hidden md:flex flex-col w-60 shrink-0 min-h-screen bg-[#1A4F8A] sticky top-0 h-screen overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center border border-white/30 shrink-0">
          <Icon name="edit_road" className="text-white !text-[22px]" />
        </div>
        <div className="flex flex-col min-w-0">
          <span
            className="font-bold text-white text-[16px] leading-tight"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            JalanKita
          </span>
          <span
            className="text-white/60 text-[11px] leading-tight truncate"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            Dishub Kab. Sidoarjo
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {menuItems.map((item) => {
          const active = pathname === item.to;
          if (item.disabled) {
            return (
              <div
                key={item.label}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg opacity-40 cursor-not-allowed"
              >
                <Icon name={item.icon} className="text-white/70 !text-[22px]" />
                <span
                  className="text-white/70 text-[14px]"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  {item.label}
                </span>
                <span className="ml-auto text-[10px] text-white/50 bg-white/10 px-1.5 py-0.5 rounded">
                  Soon
                </span>
              </div>
            );
          }
          return (
            <Link
              key={item.label}
              to={item.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                active
                  ? "bg-white/20 text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon name={item.icon} className="!text-[22px]" filled={active} />
              <span className="text-[14px]" style={{ fontFamily: "'Inter', sans-serif" }}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Footer — user info + logout */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center border border-white/30 shrink-0">
            {displayUser.initials && (
              <span
                className="text-white text-[13px] font-bold"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                {displayUser.initials}
              </span>
            )}
          </div>
          <div className="flex flex-col min-w-0">
            {displayUser.name && (
              <span
                className="text-white text-[13px] font-semibold truncate leading-tight"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                {displayUser.name}
              </span>
            )}
            {displayUser.role && (
              <span
                className="text-white/60 text-[11px] truncate leading-tight capitalize"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                {displayUser.role === "supervisor" ? "Supervisor" : "Petugas Lapangan"}
              </span>
            )}
          </div>
        </div>
        {/* Tombol Logout */}
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-colors text-[13px]"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          <Icon name="logout" className="!text-[18px]" />
          Keluar
        </button>
      </div>
    </aside>
  );
}
