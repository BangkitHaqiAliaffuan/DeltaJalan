import { AppLayout } from "./AppLayout";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";

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
      <div className="flex flex-col h-screen w-full">
        <TopBar {...{ title, back, right, showBrand }} />
        {children}
        {withBottomNav && <BottomNav />}
      </div>
    </AppLayout>
  );
}
