import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Icon } from "./Icon";
import { getCurrentUser, clearAuth, getToken, type User } from "@/lib/auth";
import { useEffect, useState } from "react";
import { usePwaInstall } from "@/hooks/usePwaInstall";

interface MenuItem {
  icon: string;
  label: string;
  to: string;
  disabled?: boolean;
}

const PETUGAS_MENU: MenuItem[] = [
  { icon: "home", label: "Beranda", to: "/home" },
  { icon: "map", label: "Peta", to: "/map" },
  { icon: "cloud_upload", label: "Upload & Analisis", to: "/upload" },
  { icon: "description", label: "Laporan Saya", to: "/my-reports" },
  { icon: "assignment", label: "Tugas Survei", to: "/tugas-survei" },
];

const SUPERVISOR_MENU: MenuItem[] = [
  { icon: "dashboard", label: "Dashboard", to: "/supervisor" },
  { icon: "map", label: "Peta", to: "/map" },
  { icon: "bar_chart", label: "Statistik", to: "/stats" },
  { icon: "assignment", label: "Survei", to: "/kelola-survei" },
];

const EKSEKUSI_MENU: MenuItem[] = [
  { icon: "assignment", label: "Tugas Saya", to: "/petugas-eksekusi" },
  { icon: "map", label: "Peta", to: "/map" },
];

export function Sidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const menuItems =
    user?.role === "supervisor"
      ? SUPERVISOR_MENU
      : user?.role === "petugas_eksekusi"
        ? EKSEKUSI_MENU
        : PETUGAS_MENU;

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

  const { canInstall, install } = usePwaInstall();

  return (
    <aside className="hidden md:flex flex-col w-64 shrink-0 min-h-screen bg-[#1A4F8A] sticky top-0 h-screen overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/15">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0">
          <img src="/logo.png" alt="DeltaJalan" className="w-10 h-10 object-contain" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="font-bold text-white text-[16px] leading-tight">DeltaJalan</span>
          <span className="text-white/60 text-[11px] leading-tight truncate">
            Dinas PU Bina Marga
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
              className={`group relative overflow-hidden flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ease-out ${
                active
                  ? "bg-white text-[#1A4F8A] font-semibold shadow-sm translate-x-0.5"
                  : "text-white/70 hover:text-[#1A4F8A] hover:translate-x-0.5"
              }`}
            >
              {!active && (
                <span className="absolute inset-y-0 left-0 w-full bg-white rounded-lg transition-transform duration-300 ease-out -translate-x-full group-hover:translate-x-0" />
              )}
              <Icon
                name={item.icon}
                className={`!text-[22px] sidebar-icon relative z-10 ${active ? "shadow-active" : "group-hover:text-[#1A4F8A] transition-colors duration-300"}`}
                filled={active}
              />
              <span className={`text-[14px] relative z-10 ${active ? "" : "group-hover:text-[#1A4F8A] transition-colors duration-300"}`} style={{ fontFamily: "'Inter', sans-serif" }}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Footer — user info + logout */}
      <div className="px-4 py-4 border-t border-white/15">
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
                {displayUser.role === "supervisor"
                  ? "Supervisor"
                  : displayUser.role === "petugas_eksekusi"
                    ? "Petugas Eksekusi"
                    : "Petugas Lapangan"}
              </span>
            )}
          </div>
        </div>
        {canInstall && (
          <button
            type="button"
            onClick={install}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-colors text-[13px] mb-1"
          >
            <Icon name="download" className="!text-[18px]" />
            Install Aplikasi
          </button>
        )}
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
