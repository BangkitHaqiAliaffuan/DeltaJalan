import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { Icon } from "@/components/jk/Icon";
import { PageLayout } from "@/components/jk/PageLayout";
import { ReportCard, ReportCardSkeleton } from "@/components/jk/ReportCard";
import { getCurrentUser, getToken } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/aiStore";
import type { Laporan } from "@/types/laporan";

export const Route = createFileRoute("/warga/")({
  component: WargaDashboard,
  head: () => ({ meta: [{ title: "Beranda — DeltaJalan Warga" }] }),
});

function WargaDashboard() {
  const user = getCurrentUser();
  const token = getToken() ?? "";
  const [reports, setReports] = useState<Laporan[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, diproses: 0, selesai: 0, ditolak: 0 });

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/warga/reports?per_page=5`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        const items = (json.data ?? []) as Laporan[];
        setReports(items);
        setStats({
          total: json.meta?.total ?? items.length,
          diproses: items.filter((r) =>
            ["Menunggu Verifikasi", "Menunggu Review", "Ditinjau", "Disetujui", "Sedang Diperbaiki"].includes(r.status)
          ).length,
          selesai: items.filter((r) => r.status === "Selesai").length,
          ditolak: items.filter((r) => r.status === "Ditolak").length,
        });
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  return (
    <PageLayout showBrand withBottomNav onRefresh={loadReports}>
      <main className="pb-4">
        <section className="bg-gradient-to-br from-[#1e40af] to-[#2e68d8] p-6 text-white">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                Selamat datang, {user?.name ?? "Warga"}
              </h1>
              <p className="text-sm text-blue-200 mt-1">
                Laporkan kerusakan jalan di Kab. Sidoarjo
              </p>
            </div>
            <span className="px-2.5 py-1 bg-white/15 text-xs font-semibold text-blue-200 uppercase tracking-wide">
              Warga
            </span>
          </div>
        </section>

        <div className="max-w-5xl mx-auto px-4">
          <section className="mt-6 mb-6">
            <h3 className="text-[15px] font-bold text-[#0F172A] mb-3 flex items-center gap-2">
              <Icon name="bar_chart" className="!text-lg text-[#1e40af]" />
              Laporan Saya
            </h3>
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-[#EEF2FF] border border-[#C7D2FE] rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 aspect-square animate-pulse">
                    <div className="w-6 h-6 bg-[#C7D2FE] mb-2" />
                    <div className="w-12 h-7 bg-[#C7D2FE] mb-1" />
                    <div className="w-20 h-4 bg-[#C7D2FE]" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Total", value: stats.total, icon: "description", color: "text-[#1e40af]" },
                  { label: "Diproses", value: stats.diproses, icon: "sync", color: "text-[#D97706]" },
                  { label: "Selesai", value: stats.selesai, icon: "check_circle", color: "text-[#16A34A]" },
                  { label: "Ditolak", value: stats.ditolak, icon: "cancel", color: "text-[#DC2626]" },
                ].map(({ label, value, icon, color }) => (
                  <div
                    key={label}
                    className="bg-gradient-to-br from-[#EEF2FF] to-white border border-[#C7D2FE] rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 aspect-square group transition-all duration-200 ease-out hover:scale-[1.03] hover:shadow-md hover:border-[#A5B4FC]"
                  >
                    <Icon name={icon} className={`${color} !text-2xl`} />
                    <span className={`text-2xl font-bold ${color}`}>{value}</span>
                    <p className="text-xs font-medium text-[#475569]">{label}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="mb-4">
            <Link
              to="/warga/lapor"
              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-[#1e40af] to-[#2e68d8] text-white rounded-xl font-label-md text-label-md font-semibold hover:shadow-lg hover:shadow-[#1e40af]/25 active:scale-[0.98] transition-all"
            >
              <Icon name="add" className="!text-[20px]" />
              Laporkan Kerusakan Jalan
            </Link>
          </section>

          <section className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[15px] font-bold text-[#0F172A] flex items-center gap-2">
                <Icon name="history" className="!text-lg text-[#1e40af]" />
                Laporan Terbaru
              </h3>
              <Link
                to="/warga/laporan"
                className="text-xs font-semibold text-[#1e40af] hover:text-[#2e68d8] transition-colors"
              >
                Lihat Semua
              </Link>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <ReportCardSkeleton key={i} />
                ))}
              </div>
            ) : reports.length === 0 ? (
              <div className="text-center py-8 text-[#476788]">
                <Icon name="inbox" className="!text-4xl mb-2 opacity-30" />
                <p className="font-body-sm text-body-sm">Belum ada laporan</p>
                <Link
                  to="/warga/lapor"
                  className="inline-block mt-3 px-4 py-2 bg-[#1e40af] text-white text-sm font-semibold rounded-lg hover:bg-[#173bab] transition-colors"
                >
                  Buat Laporan Baru
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {reports.map((r) => (
                  <ReportCard
                    key={r.id}
                    report={r}
                    cardLink={{ to: '/warga/laporan/$id', params: { id: r.id } }}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </PageLayout>
  );
}
