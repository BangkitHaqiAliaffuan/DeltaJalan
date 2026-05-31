import { Link, useLocation } from "@tanstack/react-router";
import { Icon } from "./Icon";
import { getCurrentUser } from "@/lib/auth";

const PETUGAS_ITEMS = [
  { to: "/home", icon: "home", label: "Beranda" },
  { to: "/upload", icon: "cloud_upload", label: "Upload" },
  { to: "/my-reports", icon: "description", label: "Laporan Saya" },
] as const;

const SUPERVISOR_ITEMS = [
  { to: "/supervisor", icon: "dashboard", label: "Dashboard" },
  { to: "/stats", icon: "bar_chart", label: "Statistik" },
] as const;

const EKSEKUSI_ITEMS = [
  { to: "/petugas-eksekusi", icon: "assignment", label: "Tugas Saya" },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();
  const user = getCurrentUser();

  const items =
    user?.role === "supervisor"
      ? SUPERVISOR_ITEMS
      : user?.role === "petugas_eksekusi"
        ? EKSEKUSI_ITEMS
        : PETUGAS_ITEMS;

  return (
    <nav className="shrink-0 md:hidden w-full max-w-[430px] flex justify-around items-center px-2 bg-white h-16 border-t border-[#D0DAE8]">
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
