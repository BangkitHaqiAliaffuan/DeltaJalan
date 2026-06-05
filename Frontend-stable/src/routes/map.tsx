import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { PageLayout } from "@/components/jk/PageLayout";
import { PetaInteraktif } from "@/components/jk/PetaInteraktif";
import type { MapFilters } from "@/components/jk/PetaInteraktif";
import { getCurrentUser, getToken } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/aiStore";
import type { LaporanMarker, MapStats, DistrictSummary } from "@/types/laporan";

export const Route = createFileRoute("/map")({
  component: MapPage,
  head: () => ({ meta: [{ title: "Peta Interaktif — DeltaJalan" }] }),
});

interface UprItem {
  id: number;
  name: string;
  wilayah?: string;
}

const defaultFilters: MapFilters = {
  status: [],
  severity: [],
  district: "",
  upr_id: "",
  sla_days: "",
};

function MapPage() {
  const token = getToken() ?? "";
  const navigate = useNavigate();
  const user = getCurrentUser();

  const [mapReports, setMapReports] = useState<LaporanMarker[]>([]);
  const [districtStats, setDistrictStats] = useState<Record<string, DistrictSummary>>({});
  const [mapStats, setMapStats] = useState<MapStats>({
    total: 0,
    by_severity: { berat: 0, sedang: 0, ringan: 0 },
    by_status: { "Menunggu Review": 0, Disetujui: 0, "Sedang Diperbaiki": 0, Selesai: 0, Ditolak: 0 },
    sla_breach_count: 0,
  });
  const [uprList, setUprList] = useState<UprItem[]>([]);
  const [filters, setFilters] = useState<MapFilters>(defaultFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch(`${API_BASE_URL}/uprs`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) {
          const list: UprItem[] = (json.data ?? json.uprs ?? []).map((u: any) => ({
            id: u.id,
            name: u.name,
            wilayah: u.wilayah,
          }));
          setUprList(list);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(false);
      try {
        const params = new URLSearchParams();
        if (filters.status.length > 0) {
          params.set("status", filters.status.join(","));
        }
        if (filters.severity.length > 0) {
          params.set("severity", filters.severity.join(","));
        }
        if (filters.district) params.set("district", filters.district);
        if (filters.upr_id) params.set("upr_id", filters.upr_id);
        if (filters.sla_days) params.set("sla_days", filters.sla_days);

        const qs = params.toString();
        const url = `${API_BASE_URL}/reports/map-data${qs ? `?${qs}` : ""}`;

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Gagal memuat data");
        const json = await res.json();
        if (!cancelled) {
          const data = json.data ?? json;
          setMapReports(data.reports ?? []);
          setDistrictStats(data.districts ?? {});
          setMapStats(data.stats ?? {
            total: 0,
            by_severity: { berat: 0, sedang: 0, ringan: 0 },
            by_status: { "Menunggu Review": 0, Disetujui: 0, "Sedang Diperbaiki": 0, Selesai: 0, Ditolak: 0 },
            sla_breach_count: 0,
          });
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [token, filters]);

  const handleFilterChange = useCallback((newFilters: MapFilters) => {
    setFilters(newFilters);
  }, []);

  function handleViewDetail(id: string) {
    if (user?.role === "supervisor") {
      navigate({ to: "/review", search: { reportId: id } });
    } else {
      navigate({ to: "/detail-report", search: { reportId: id } });
    }
  }

  return (
    <PageLayout back={user?.role === "supervisor" ? "/supervisor" : "/home"} title="Peta Interaktif" withBottomNav>
        <main className="flex-1 min-h-0 flex flex-col">
          {loading ? (
            <div className="flex-1 flex items-center justify-center bg-[#F5F7FA]">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-[#E2E8F0] flex items-center justify-center">
                  <span className="material-symbols-outlined !text-[22px] text-[#1A4F8A] animate-spin">sync</span>
                </div>
                <p className="text-[13px] text-[#64748B]">Memuat peta...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex-1 flex items-center justify-center bg-[#F5F7FA]">
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center">
                  <span className="material-symbols-outlined !text-[24px] text-[#E11D48]">error_outline</span>
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
          mapReports={mapReports}
          districtStats={districtStats}
          mapStats={mapStats}
          uprList={uprList}
          filters={filters}
          onFilterChange={handleFilterChange}
          onViewDetail={handleViewDetail}
          userRole={user?.role}
        />
          )}
        </main>
    </PageLayout>
  );
}
