import { TopBar } from "./TopBar";
import { ConnectionBanner } from "./ConnectionBanner";
import { Icon } from "./Icon";
import { Link, useLocation } from "@tanstack/react-router";

interface PublicLayoutProps {
  title?: string;
  back?: string;
  right?: React.ReactNode;
  showBrand?: boolean;
  withBottomNav?: boolean;
  children: React.ReactNode;
}

const PUBLIC_ITEMS = [
  { to: "/", icon: "home", label: "Beranda" },
  { to: "/lapor", icon: "add_circle", label: "Lapor" },
  { to: "/lacak", icon: "search", label: "Lacak" },
] as const;

export function PublicLayout({
  title,
  back,
  right,
  showBrand,
  withBottomNav,
  children,
}: PublicLayoutProps) {
  const { pathname } = useLocation();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#F5F7FA]">
      <ConnectionBanner />
      <TopBar {...{ title, back, right, showBrand }} />
      <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
      {withBottomNav && (
        <nav
          className="shrink-0 md:hidden w-full max-w-[430px] relative flex justify-around items-center px-2 bg-white h-16 border-t border-[#D0DAE8]"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          {PUBLIC_ITEMS.map((it) => {
            const active = pathname === it.to || (it.to === "/" && pathname === "");
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
          <Link
            to="/lapor"
            className="absolute left-1/2 -translate-x-1/2 -top-5 w-12 h-12 rounded-full flex items-center justify-center bg-primary shadow-lg shadow-primary/30 transition-transform active:scale-90 z-10"
          >
            <Icon name="add" className="!text-2xl font-bold text-white" />
          </Link>
        </nav>
      )}
    </div>
  );
}
