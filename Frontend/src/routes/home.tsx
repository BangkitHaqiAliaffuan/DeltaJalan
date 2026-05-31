import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Icon } from "@/components/jk/Icon";
import { BottomNav } from "@/components/jk/BottomNav";
import { AppLayout } from "@/components/jk/AppLayout";
import { TopBar } from "@/components/jk/TopBar";
import { getCurrentUser, getToken } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/aiStore";
import type { Laporan } from "@/types/laporan";

export const Route = createFileRoute("/home")({
  component: HomePage,
  head: () => ({ meta: [{ title: "Beranda Petugas — DeltaJalan" }] }),
});

function getSeverityColor(severity?: string | null): { bar: string; chip: string; label: string } {
  const s = (severity ?? "").toLowerCase();
  if (s.includes("berat"))
    return {
      bar: "bg-[#E11D48]",
      chip: "bg-red-50 text-[#E11D48] border-red-200",
      label: "Rusak Berat",
    };
  if (s.includes("sedang"))
    return {
      bar: "bg-[#F97316]",
      chip: "bg-amber-50 text-[#F97316] border-amber-200",
      label: "Rusak Sedang",
    };
  if (s.includes("ringan"))
    return {
      bar: "bg-[#F59E0B]",
      chip: "bg-green-50 text-[#F59E0B] border-green-200",
      label: "Rusak Ringan",
    };
  return {
    bar: "bg-gray-400",
    chip: "bg-gray-50 text-[#475569] border-gray-200",
    label: severity ?? "Baik",
  };
}

function displayStatus(status: string): string {
  return status === "Ditinjau" ? "Menunggu Review" : status;
}

function statusBadgeStyle(status: string): string {
  const map: Record<string, string> = {
    "Menunggu Review": "bg-[#FEF3C7] text-[#F59E0B] border-[#FCD34D]",
    Ditinjau: "bg-[#FEF3C7] text-[#F59E0B] border-[#FCD34D]",
    Disetujui: "bg-[#DBEAFE] text-[#1e40af] border-[#93C5FD]",
    Ditolak: "bg-red-50 text-[#E11D48] border-red-200",
    "Sedang Diperbaiki": "bg-[#DBEAFE] text-[#1e40af] border-[#93C5FD]",
    Selesai: "bg-[#D1FAE5] text-[#10B981] border-[#6EE7B7]",
    Diedit: "bg-gray-50 text-[#475569] border-gray-200",
  };
  return map[status] ?? "bg-gray-50 text-[#475569] border-gray-200";
}

function HomePage() {
  const user = getCurrentUser();
  const token = getToken() ?? "";

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{
    total: number;
    menunggu_review: number;
    disetujui: number;
    ditolak: number;
    sedang_diperbaiki: number;
    selesai: number;
  } | null>(null);
  const [recent, setRecent] = useState<Laporan[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [statsRes, reportsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/reports/stats`, { headers }),
          fetch(`${API_BASE_URL}/reports?user_reports=true&limit=10`, { headers }),
        ]);
        if (statsRes.ok) {
          const sj = await statsRes.json();
          setStats(sj.data ?? null);
        }
        if (reportsRes.ok) {
          const rj = await reportsRes.json();
          setRecent(rj.data ?? []);
        }
      } catch {
        // silently fail — data stays null
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 10) return "Selamat pagi";
    if (h < 15) return "Selamat siang";
    return "Selamat sore";
  })();

  const userName = user?.name ?? "Petugas";
  const userWilayah = user?.wilayah ?? "Sidoarjo";

  return (
    <AppLayout>
      <div className="flex flex-col h-screen w-full">
        <TopBar showBrand />
        <main className="flex-1 overflow-y-auto min-h-0 pb-4">
          <section className="px-4 pt-6 pb-8 bg-[#F1F5F9] rounded-b-lg border-b border-[#E2E8F0] mb-6">
            <div className="flex flex-col gap-1">
              <h2 className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-primary">
                {greeting}, {userName}
              </h2>
              <div className="flex items-center gap-1 text-[#475569]">
                <Icon name="location_on" className="!text-[16px]" />
                <p className="font-body-md text-body-md">Petugas Lapangan · Kec. {userWilayah}</p>
              </div>
            </div>
          </section>

          <section className="px-4 mb-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {loading ? (
                <>
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="bg-white border border-[#E2E8F0] p-4 rounded-lg animate-pulse"
                    >
                      <div className="h-8 w-12 bg-gray-200 rounded mb-2" />
                      <div className="h-4 w-20 bg-gray-200 rounded" />
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <div className="bg-white border border-[#E2E8F0] p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Icon name="assignment" className="text-primary" />
                    </div>
                    <p className="font-headline-md text-headline-md font-bold text-primary mb-1">
                      {stats?.total ?? 0}
                    </p>
                    <p className="font-label-md text-label-md text-[#475569]">Total Laporan</p>
                  </div>
                  <div className="bg-white border border-[#E2E8F0] p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Icon name="report_problem" className="text-[#E11D48]" />
                    </div>
                    <p className="font-headline-md text-headline-md font-bold text-[#E11D48] mb-1">
                      {recent.filter((r) => {
                        const s = r.overall_severity ?? r.ai_severity ?? "";
                        return s.toLowerCase().includes("berat");
                      }).length || 0}
                    </p>
                    <p className="font-label-md text-label-md text-[#475569]">Rusak Berat</p>
                  </div>
                  <div className="bg-white border border-[#E2E8F0] p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Icon name="sync" className="text-[#F59E0B]" />
                    </div>
                    <p className="font-headline-md text-headline-md font-bold text-[#F59E0B] mb-1">
                      {(stats?.menunggu_review ?? 0) + (stats?.sedang_diperbaiki ?? 0)}
                    </p>
                    <p className="font-label-md text-label-md text-[#475569]">Diproses</p>
                  </div>
                  <div className="bg-white border border-[#E2E8F0] p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Icon name="check_circle" className="text-[#10B981]" />
                    </div>
                    <p className="font-headline-md text-headline-md font-bold text-[#10B981] mb-1">
                      {stats?.selesai ?? 0}
                    </p>
                    <p className="font-label-md text-label-md text-[#475569]">Selesai</p>
                  </div>
                </>
              )}
            </div>
          </section>

          <section className="px-4 mb-6">
            <div className="grid grid-cols-2 gap-3">
              <Link
                to="/upload"
                className="flex items-center gap-3 p-4 bg-primary text-white rounded-lg hover:bg-[#173bab] transition-colors"
              >
                <Icon name="add_photo_alternate" className="!text-2xl" />
                <div className="flex flex-col">
                  <span className="font-semibold text-sm">Upload Laporan</span>
                  <span className="text-xs text-white/70">Ambil foto & analisis</span>
                </div>
              </Link>
              <Link
                to="/my-reports"
                className="flex items-center gap-3 p-4 bg-white border border-[#E2E8F0] rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Icon name="description" className="!text-2xl text-primary" />
                <div className="flex flex-col">
                  <span className="font-semibold text-sm text-[#0F172A]">Laporan Saya</span>
                  <span className="text-xs text-[#475569]">Lihat riwayat</span>
                </div>
              </Link>
            </div>
          </section>

          <section className="px-4 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-headline-sm text-headline-sm font-bold text-[#0F172A]">
                Laporan Terbaru
              </h3>
              <Link to="/my-reports" className="font-label-md text-label-md text-primary font-bold">
                Lihat Semua
              </Link>
            </div>
            <div className="flex flex-col divide-y divide-[#E2E8F0] bg-white border border-[#E2E8F0] rounded-lg overflow-hidden">
              {loading ? (
                <>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="p-4 animate-pulse flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-gray-200 shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-24 bg-gray-200 rounded" />
                        <div className="h-4 w-40 bg-gray-200 rounded" />
                        <div className="h-3 w-16 bg-gray-200 rounded" />
                      </div>
                    </div>
                  ))}
                </>
              ) : recent.length === 0 ? (
                <div className="p-8 text-center text-[#475569]">
                  <Icon name="inbox" className="!text-4xl mx-auto mb-2 opacity-40" />
                  <p className="font-body-md">Belum ada laporan.</p>
                  <p className="font-label-sm mt-1">Upload laporan pertama Anda untuk mulai.</p>
                </div>
              ) : (
                recent.slice(0, 5).map((r) => {
                  const sc = getSeverityColor(r.overall_severity ?? r.ai_severity);
                  return (
                    <Link
                      to={user?.role === "petugas" ? "/detail-report" : "/review"}
                      search={{ reportId: r.id }}
                      key={r.id}
                      className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start gap-4 min-w-0">
                        <div className="w-12 h-12 rounded-lg bg-gray-50 shrink-0 overflow-hidden">
                          {r.first_photo_url ? (
                            <img
                              src={r.first_photo_url}
                              alt={r.road_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Icon name="description" className="text-primary/50" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-id-code text-id-code text-[#475569] mb-[2px]">
                            {r.report_code}
                          </p>
                          <h4 className="font-label-md text-label-md font-bold text-[#0F172A] mb-1 truncate">
                            {r.road_name}
                          </h4>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-label-sm font-bold border ${sc.chip}`}
                            >
                              {sc.label}
                            </span>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-label-sm font-bold border ${statusBadgeStyle(r.status)}`}
                            >
                              {displayStatus(r.status)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Icon name="chevron_right" className="text-outline shrink-0 ml-2" />
                    </Link>
                  );
                })
              )}
            </div>
          </section>
        </main>
        <BottomNav />
      </div>
    </AppLayout>
  );
}
