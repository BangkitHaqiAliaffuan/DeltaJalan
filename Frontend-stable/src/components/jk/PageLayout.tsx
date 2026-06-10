import { AppLayout } from "./AppLayout";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import { ConnectionBanner } from "./ConnectionBanner";

interface PageLayoutProps {
  title?: string;
  back?: string;
  right?: React.ReactNode;
  showBrand?: boolean;
  withBottomNav?: boolean;
  children: React.ReactNode;
}

export function PageLayout({
  title,
  back,
  right,
  showBrand,
  withBottomNav,
  children,
}: PageLayoutProps) {
  return (
    <AppLayout>
      <div className="flex flex-col flex-1 min-h-0 w-full max-w-full">
        <ConnectionBanner />
        <TopBar {...{ title, back, right, showBrand }} />
        <div className="flex-1 min-h-0 overflow-y-auto">
          {children}
        </div>
        {withBottomNav && <div className="shrink-0 sticky bottom-0 z-10"><BottomNav /></div>}
      </div>
    </AppLayout>
  );
}
