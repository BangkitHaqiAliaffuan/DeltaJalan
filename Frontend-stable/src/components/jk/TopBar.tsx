import { Link, useNavigate } from "@tanstack/react-router";
import { Icon } from "./Icon";
import { NotificationBell } from "./NotificationBell";
import { useState, useEffect, useRef } from "react";
import { getCurrentUser, clearAuth, getToken } from "@/lib/auth";

export function TopBar({
  title,
  back,
  right,
  showBrand,
}: {
  title?: string;
  back?: string;
  right?: React.ReactNode;
  showBrand?: boolean;
}) {
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [user, setUser] = useState<{ name: string; role: string; initials: string } | null>(null);

  useEffect(() => {
    const u = getCurrentUser();
    if (u) {
      setUser({ name: u.name, role: u.role, initials: u.initials });
    }
  }, []);

  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  async function handleLogout() {
    const token = getToken();
    if (token) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {}
    }
    clearAuth();
    navigate({ to: "/" });
  }

  return (
    <header className="shrink-0 flex justify-between items-center px-4 bg-white border-b border-[#D0DAE8] h-14">
      <div className="flex items-center gap-3">
        {back ? (
          <Link
            to={back}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#EEF3FA]"
          >
            <Icon name="arrow_back" className="text-on-surface-variant" />
          </Link>
        ) : null}
        {showBrand ? (
          <h1 className="font-headline-sm-mobile text-headline-sm-mobile font-extrabold text-primary">
            DeltaJalan
          </h1>
        ) : title ? (
          <h1 className="font-headline-sm-mobile text-headline-sm-mobile font-bold text-on-surface">
            {title}
          </h1>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        {right}
        <NotificationBell />
        {user && (
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white hover:opacity-90 transition-opacity"
            >
              <span className="font-label-md text-label-md font-bold">{user.initials}</span>
            </button>
            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-lg border border-[#D0DAE8] overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-[#D0DAE8]">
                  <p className="font-label-md text-label-md font-semibold text-on-surface truncate">
                    {user.name}
                  </p>
                  <p className="text-[11px] text-on-surface-variant capitalize">
                    {user.role === "supervisor"
                      ? "Supervisor"
                      : user.role === "petugas_eksekusi"
                        ? "Petugas Eksekusi"
                        : "Petugas Lapangan"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-3 text-[13px] text-on-surface font-medium hover:bg-surface-container-low transition-colors active:bg-surface-container"
                >
                  <Icon name="logout" className="!text-[18px] text-on-surface-variant" />
                  Keluar
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
