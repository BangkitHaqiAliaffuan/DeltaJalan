import { Link, useLocation } from "@tanstack/react-router";
import { Icon } from "./Icon";
import { getCurrentUser } from "@/lib/auth";
import { useEffect, useState } from "react";

const PETUGAS_ITEMS = [
  { to: "/home", icon: "home", label: "Beranda" },
  { to: "/tugas-saya", icon: "assignment", label: "Tugas" },
  { to: "/map", icon: "map", label: "Peta" },
  { to: "/my-reports", icon: "description", label: "Laporan" },
] as const;

const SUPERVISOR_ITEMS = [
  { to: "/supervisor", icon: "dashboard", label: "Dashboard" },
  { to: "/supervisor/patrol-schedule", icon: "calendar_month", label: "Jadwal" },
  { to: "/map", icon: "map", label: "Peta" },
  { to: "/stats", icon: "bar_chart", label: "Statistik" },
] as const;

const WARGA_ITEMS = [
  { to: "/warga", icon: "home", label: "Beranda" },
  { to: "/warga/peta", icon: "map", label: "Peta" },
  { to: "/warga/laporan", icon: "description", label: "Laporan" },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();
  const [user, setUser] = useState<ReturnType<typeof getCurrentUser>>(null);

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  if (!user) return null;

  const role = user?.role;
  const isPetugas = role === "petugas";
  const isWarga = role === "warga";
  const items = isWarga ? WARGA_ITEMS : isPetugas ? PETUGAS_ITEMS : SUPERVISOR_ITEMS;

  return (
      <nav
        className="shrink-0 md:hidden w-full max-w-[430px] flex justify-around items-center px-2 bg-white h-16 border-t border-[#D0DAE8]"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {items.map((it) => {
          const active = pathname === it.to;
          return (
            <Link
              key={it.to}
              to={it.to}
              className={`flex flex-col items-center justify-center h-full px-2 transition-all active:scale-95 ${
                active ? "text-primary border-t-2 border-primary" : "text-on-surface-variant"
              }`}
            >
              <Icon name={it.icon} filled={active} />
              <span className="font-label-sm text-label-sm">{it.label}</span>
            </Link>
          );
        })}
      </nav>
  );
}
