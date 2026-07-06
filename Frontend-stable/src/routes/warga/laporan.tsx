import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PageLayout } from "@/components/jk/PageLayout";

export const Route = createFileRoute("/warga/laporan")({
  component: WargaLaporanLayout,
});

function WargaLaporanLayout() {
  return (
    <PageLayout title="Laporan Saya" withBottomNav>
      <Outlet />
    </PageLayout>
  );
}
