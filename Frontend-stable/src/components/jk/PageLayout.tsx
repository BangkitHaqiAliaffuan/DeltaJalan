import { AppLayout } from "./AppLayout";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import Fab from "./Fab";
import { ConnectionBanner } from "./ConnectionBanner";
import { PullToRefresh } from "./PullToRefresh";

interface PageLayoutProps {
  title?: string;
  back?: string;
  right?: React.ReactNode;
  showBrand?: boolean;
  withBottomNav?: boolean;
  fullPage?: boolean;
  onRefresh?: () => Promise<void>;
  hideFab?: boolean;
  children: React.ReactNode;
}

export function PageLayout({
  title,
  back,
  right,
  showBrand,
  withBottomNav,
  fullPage,
  onRefresh,
  hideFab,
  children,
}: PageLayoutProps) {
  const content = fullPage ? (
    <div className="flex-1">{children}</div>
  ) : onRefresh ? (
    <PullToRefresh onRefresh={onRefresh}>{children}</PullToRefresh>
  ) : (
    <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">{children}</div>
  );

  return (
    <AppLayout fullPage={fullPage}>
      <div className="flex flex-col flex-1 min-h-0 w-full max-w-full">
        <ConnectionBanner />
        <TopBar {...{ title, back, right, showBrand }} />
        {content}
        {withBottomNav && (
          <>
            <div className="shrink-0 sticky bottom-0 z-10">
              <BottomNav />
            </div>
            {!hideFab && <Fab />}
          </>
        )}
      </div>
    </AppLayout>
  );
}
