import { Link, useLocation } from "@tanstack/react-router";
import { Icon } from "./Icon";
import { getCurrentUser } from "@/lib/auth";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { useEffect, useState } from "react";

const PETUGAS_ITEMS = [
  { to: "/home", icon: "home", label: "Beranda" },
  { to: "/map", icon: "map", label: "Peta" },
  { to: "/upload", icon: "cloud_upload", label: "Upload" },
  { to: "/my-reports", icon: "description", label: "Laporan Saya" },
] as const;

const SUPERVISOR_ITEMS = [
  { to: "/supervisor", icon: "dashboard", label: "Dashboard" },
  { to: "/map", icon: "map", label: "Peta" },
  { to: "/stats", icon: "bar_chart", label: "Statistik" },
] as const;

const EKSEKUSI_ITEMS = [
  { to: "/petugas-eksekusi", icon: "assignment", label: "Tugas Saya" },
  { to: "/map", icon: "map", label: "Peta" },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();
  const [user, setUser] = useState<ReturnType<typeof getCurrentUser>>(null);
  const { canInstall, install } = usePwaInstall();

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  if (!user) return null;

  const items =
    user?.role === "supervisor"
      ? SUPERVISOR_ITEMS
      : user?.role === "petugas_eksekusi"
        ? EKSEKUSI_ITEMS
        : PETUGAS_ITEMS;

  return (
    <nav className="shrink-0 md:hidden w-full max-w-[430px] flex justify-around items-center px-2 bg-white h-16 border-t border-[#D0DAE8]" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
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
      {canInstall && (
        <button
          type="button"
          onClick={install}
          className="flex flex-col items-center justify-center h-full px-2 transition-all active:scale-95 text-on-surface-variant"
        >
          <Icon name="download" />
          <span className="font-label-sm text-label-sm">Install</span>
        </button>
      )}
    </nav>
  );
}
