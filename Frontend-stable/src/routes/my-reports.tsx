import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Icon } from "@/components/jk/Icon";
import { PageLayout } from "@/components/jk/PageLayout";
import { ReportCard, ReportCardSkeleton } from "@/components/jk/ReportCard";
import { ConfirmDialog } from "@/components/jk/ConfirmDialog";
import { API_BASE_URL } from "@/lib/aiStore";
import { getToken } from "@/lib/auth";
import type { Laporan } from "@/types/laporan";

export const Route = createFileRoute("/my-reports")({
  component: MyReportsPage,
  head: () => ({ meta: [{ title: "Laporan Saya — DeltaJalan" }] }),
});

const FILTERS = [
  { key: "all", label: "Semua" },
  { key: "Rusak Berat", label: "Rusak Berat" },
  { key: "Rusak Sedang", label: "Rusak Sedang" },
  { key: "Rusak Ringan", label: "Rusak Ringan" },
  { key: "Diproses", label: "Diproses" },
  { key: "Selesai", label: "Selesai" },
] as const;

function matchFilter(report: Laporan, filter: string): boolean {
  if (filter === "all") return true;
  if (filter === "Diproses")
    return ["Menunggu Review", "Ditinjau", "Disetujui", "Sedang Diperbaiki"].includes(report.status);
  if (filter === "Selesai") return report.status === "Selesai";
  return (report.overall_severity ?? report.ai_severity ?? "") === filter;
}

function matchSearch(report: Laporan, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    report.report_code.toLowerCase().includes(q) ||
    report.road_name.toLowerCase().includes(q) ||
    report.district.toLowerCase().includes(q)
  );
}

function MyReportsPage() {
  const [laporan, setLaporan] = useState<Laporan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const token = getToken();

  useEffect(() => {
    loadLaporan();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadLaporan() {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/reports?user_reports=true&limit=20`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setLaporan(data.data ?? []);
      }
    } catch {
      // fallback ke data kosong
    } finally {
      setIsLoading(false);
    }
  }

  const handleDeleteClick = useCallback((id: string) => {
    setDeleteTarget(id);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/reports/${deleteTarget}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        setDeleteTarget(null);
        loadLaporan();
      } else {
        const json = await res.json().catch(() => ({}));
        alert(json.message ?? "Gagal menghapus laporan.");
      }
    } catch {
      alert("Terjadi kesalahan jaringan.");
    } finally {
      setDeleteLoading(false);
    }
  }, [deleteTarget, token]);

  const filtered = useMemo(() => {
    return laporan.filter(
      (r) => matchFilter(r, activeFilter) && matchSearch(r, searchQuery),
    );
  }, [laporan, activeFilter, searchQuery]);

  const handleRefresh = useCallback(async () => {
    await loadLaporan();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <PageLayout
      title="Laporan Saya"
      right={
        <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-low">
          <Icon name="filter_list" className="text-on-surface-variant" />
        </button>
      }
      withBottomNav
      onRefresh={handleRefresh}
    >
      <div>
        {/* Search bar */}
        <section className="px-margin-mobile pt-md">
          <div className="relative flex items-center">
            <Icon name="search" className="absolute left-4 text-on-surface-variant pointer-events-none" />
            <input
              className="w-full bg-[#F1F5F9] border border-[#C0CEDF] rounded-lg h-11 pl-12 pr-10 font-body-md text-body-md text-on-surface focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
              placeholder="Cari ID, nama jalan, atau kecamatan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="absolute right-3 text-on-surface-variant hover:text-on-surface"
                onClick={() => setSearchQuery("")}
                aria-label="Hapus pencarian"
              >
                <Icon name="close" />
              </button>
            )}
          </div>
        </section>

        {/* Filter chips */}
        <section className="flex overflow-x-auto gap-2 px-margin-mobile py-md no-scrollbar">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`whitespace-nowrap px-4 py-2 rounded-lg font-label-md text-label-md active:scale-95 transition-all ${
                activeFilter === f.key
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-lowest border border-border-subtle text-on-surface-variant"
              }`}
            >
              {f.label}
            </button>
          ))}
        </section>

        {/* Report count */}
        <div className="px-margin-mobile mb-sm">
          <p className="font-label-md text-label-md text-on-surface-variant">
            {filtered.length} laporan
            {activeFilter !== "all" && ` • ${FILTERS.find((f) => f.key === activeFilter)?.label}`}
            {searchQuery && ` • Cari: "${searchQuery}"`}
          </p>
        </div>

        {/* Card list */}
        <main className="px-margin-mobile flex flex-col gap-md pb-28">
          {isLoading ? (
            <div aria-busy="true" aria-label="Memuat laporan" className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ReportCardSkeleton />
              <ReportCardSkeleton />
              <ReportCardSkeleton />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant">
              <Icon name="description" className="!text-[48px] mb-3" />
              <p className="font-body-md text-body-md mb-1">
                {searchQuery || activeFilter !== "all" ? "Laporan tidak ditemukan" : "Belum ada laporan."}
              </p>
              {searchQuery || activeFilter !== "all" ? (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setActiveFilter("all");
                  }}
                  className="mt-2 px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md text-label-md"
                >
                  Reset filter
                </button>
              ) : null}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {filtered.map((c) => (
                <ReportCard
                  key={c.id}
                  report={c}
                  options={{ showTrust: true }}
                  actions={[
                    { label: "Lihat Detail", icon: "arrow_forward", variant: "secondary", to: "/detail-report", search: { reportId: c.id } },
                    ...(c.status === "Menunggu Review"
                      ? [{ label: "Hapus", icon: "delete", variant: "destructive" as const, onClick: () => handleDeleteClick(c.id) }]
                      : []),
                  ]}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      <ConfirmDialog
        open={deleteTarget != null}
        title="Hapus Laporan?"
        message="Laporan yang dihapus tidak dapat dikembalikan. Apakah Anda yakin ingin menghapus laporan ini?"
        confirmText="Ya, Hapus"
        cancelText="Batal"
        confirmLoading={deleteLoading}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </PageLayout>
  );
}
