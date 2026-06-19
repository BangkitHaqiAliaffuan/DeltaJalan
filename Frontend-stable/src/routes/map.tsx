import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { PageLayout } from "@/components/jk/PageLayout";
import { Icon } from "@/components/jk/Icon";
import { PetaInteraktif } from "@/components/jk/PetaInteraktif";
import type { MapFilters } from "@/components/jk/PetaInteraktif";
import { SkeletonMapArea } from "@/components/jk/Skeleton";
import { getCurrentUser, getToken } from "@/lib/auth";
import { useMapData, useUprs } from "@/hooks/useReportQueries";

export const Route = createFileRoute("/map")({
  ssr: false,
  component: MapPage,
  validateSearch: (search: Record<string, unknown>) => {
    const highlight = search.highlight as string | undefined;
    const lat = search.lat as string | undefined;
    const lng = search.lng as string | undefined;
    return {
      ...(highlight ? { highlight } : {}),
      ...(lat ? { lat: parseFloat(lat) } : {}),
      ...(lng ? { lng: parseFloat(lng) } : {}),
    };
  },
  head: () => ({ meta: [{ title: "Peta Interaktif — DeltaJalan" }] }),
});

const defaultFilters: MapFilters = {
  status: [],
  severity: [],
  district: "",
  upr_id: "",
  deadline_hari: "",
  status_deadline: "",
};

function MapPage() {
  const token = getToken() ?? "";
  const navigate = useNavigate();
  const search = useSearch({ from: Route.id });

  const [clientUserRole, setClientUserRole] = useState<string | undefined>(undefined);
  useEffect(() => { setClientUserRole(getCurrentUser()?.role); }, []);

  const [filters, setFilters] = useState<MapFilters>(defaultFilters);
  const [debouncedFilters, setDebouncedFilters] = useState<MapFilters>(defaultFilters);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters(filters);
    }, 300);
    return () => clearTimeout(timer);
  }, [filters]);

  const { data: mapData, isLoading: loading, isError: error } = useMapData(token, debouncedFilters);
  const { data: uprList = [] } = useUprs(token);

  const handleFilterChange = useCallback((newFilters: MapFilters) => {
    setFilters(newFilters);
  }, []);

  function handleViewDetail(id: string) {
    navigate({ to: "/detail-report", search: { reportId: id } });
  }

  return (
    <PageLayout
      back={clientUserRole === "supervisor" ? "/supervisor" : "/home"}
      title="Peta Interaktif"
      withBottomNav
    >
      <main className="flex flex-col h-full min-h-0">
        {loading ? (
          <SkeletonMapArea />
        ) : error ? (
          <div className="flex-1 flex items-center justify-center bg-[#F5F7FA]">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center">
                <Icon name="error_outline" className="!text-[24px] text-[#E11D48]" />
              </div>
              <p className="text-[13px] font-semibold text-[#0F172A]">Gagal memuat peta</p>
              <p className="text-[12px] text-[#64748B]">Terjadi kesalahan saat mengambil data</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-1.5 bg-[#1A4F8A] text-white text-[12px] font-medium rounded-lg hover:bg-[#153d6e] transition-colors"
              >
                Coba Lagi
              </button>
            </div>
          </div>
        ) : (
          <PetaInteraktif
            mapReports={mapData?.reports ?? []}
            districtStats={mapData?.districts ?? {}}
            mapStats={
              mapData?.stats ?? {
                total: 0,
                by_severity: { berat: 0, sedang: 0, ringan: 0 },
                by_status: {
                  "Menunggu Review": 0,
                  Disetujui: 0,
                  "Sedang Diperbaiki": 0,
                  Selesai: 0,
                  Ditolak: 0,
                },
                terlambat_count: 0,
              }
            }
            uprList={uprList}
            filters={filters}
            onFilterChange={handleFilterChange}
            onViewDetail={handleViewDetail}
            userRole={clientUserRole}
            highlightReportId={search.highlight}
          />
        )}
      </main>
    </PageLayout>
  );
}
