import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { PageLayout } from "@/components/jk/PageLayout";
import { PetaInteraktif } from "@/components/jk/PetaInteraktif";
import { SkeletonMapArea } from "@/components/jk/Skeleton";
import { getCurrentUser, getToken } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/aiStore";
import { authFetch } from "@/hooks/useReportQueries";
import type { MapDataResponse } from "@/types/laporan";
import type { MapFilters } from "@/components/jk/PetaInteraktif";

export const Route = createFileRoute("/warga/peta")({
  ssr: false,
  component: WargaPetaPage,
  head: () => ({ meta: [{ title: "Peta Kerusakan — DeltaJalan" }] }),
});

const defaultFilters: MapFilters = {
  status: [],
  severity: [],
  district: "",
  uptd_id: "",
  deadline_hari: "",
  status_deadline: "",
};

function WargaPetaPage() {
  const token = getToken() ?? "";
  const navigate = useNavigate();
  const [mapData, setMapData] = useState<MapDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filters] = useState<MapFilters>(defaultFilters);

  const user = getCurrentUser();
  const currentUserId = user?.id ?? null;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(false);
      try {
        const data = await authFetch<{ success: boolean; data: MapDataResponse }>(
          `${API_BASE_URL}/reports/map-data`,
          token,
        );
        if (!cancelled && data.success) {
          setMapData(data.data);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [token]);

  function handleViewDetail(id: string) {
    navigate({ to: "/warga/laporan/$id", params: { id } });
  }

  return (
    <PageLayout back="/warga" title="Peta Kerusakan" withBottomNav>
      <main className="flex flex-col h-full min-h-0">
        {loading ? (
          <SkeletonMapArea />
        ) : error ? (
          <div className="flex-1 flex items-center justify-center bg-[#F5F7FA]">
            <div className="flex flex-col items-center gap-3">
              <p className="text-[13px] font-semibold text-[#0F172A]">Gagal memuat peta</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-1.5 bg-[#1A4F8A] text-white text-[12px] font-medium rounded-lg"
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
                  Ditugaskan: 0,
                  "Sedang Diperbaiki": 0,
                  Selesai: 0,
                  Ditolak: 0,
                },
                terlambat_count: 0,
              }
            }
            teamList={[]}
            filters={filters}
            onFilterChange={() => {}}
            onViewDetail={handleViewDetail}
            userRole="warga"
            currentUserId={currentUserId}
          />
        )}
      </main>
    </PageLayout>
  );
}
