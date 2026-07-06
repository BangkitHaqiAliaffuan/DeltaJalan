import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PageLayout } from "@/components/jk/PageLayout";

export const Route = createFileRoute("/supervisor/patrol-schedule")({
  component: PatrolScheduleLayout,
  ssr: false,
});

function PatrolScheduleLayout() {
  return (
    <PageLayout back="/supervisor" withBottomNav>
      <Outlet />
    </PageLayout>
  );
}
