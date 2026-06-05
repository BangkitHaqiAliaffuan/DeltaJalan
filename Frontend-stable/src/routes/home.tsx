import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Icon } from "@/components/jk/Icon";
import { PageLayout } from "@/components/jk/PageLayout";
import { getCurrentUser, getToken } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/aiStore";
import { listDrafts, type OfflineDraft } from "@/lib/offlineDrafts";
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

function severityBorder(severity?: string | null): string {
  const s = (severity ?? "").toLowerCase();
  if (s.includes("berat")) return "border-l-[#E11D48]";
  if (s.includes("sedang")) return "border-l-[#F97316]";
  if (s.includes("ringan")) return "border-l-[#F59E0B]";
  return "border-l-[#2E7D32]";
}

function severityBadgeStyle(label: string): string {
  if (label === "Rusak Berat") return "bg-[#E11D48] text-white shadow-sm";
  if (label === "Rusak Sedang") return "bg-[#F97316] text-white shadow-sm";
  if (label === "Rusak Ringan") return "bg-[#F59E0B] text-white shadow-sm";
  return "bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7] shadow-sm";
}

function severityDotStyle(label: string): string {
  if (label === "Rusak Berat") return "bg-white animate-pulse";
  if (label === "Rusak Sedang") return "bg-white";
  if (label === "Rusak Ringan") return "bg-white";
  return "bg-[#2E7D32]";
}

function statusBadgeNewStyle(status: string): string {
  const map: Record<string, string> = {
    "Menunggu Review": "bg-[#F1F5F9] text-[#475569] border border-[#cbd5e1] shadow-sm",
    Ditinjau: "bg-[#F1F5F9] text-[#475569] border border-[#cbd5e1] shadow-sm",
    Disetujui: "bg-[#EFF6FF] text-[#1e40af] border border-[#bfdbfe] shadow-sm",
    Ditolak: "bg-[#FEF2F2] text-[#dc2626] border border-[#fecaca] shadow-sm",
    "Sedang Diperbaiki": "bg-[#FFFBEB] text-[#D97706] border border-[#fde68a] shadow-sm",
    Selesai: "bg-[#F0FDF4] text-[#16a34a] border border-[#bbf7d0] shadow-sm",
    Diedit: "bg-[#F1F5F9] text-[#475569] border border-[#cbd5e1] shadow-sm",
  };
  return map[status] ?? "bg-[#F1F5F9] text-[#475569] border border-[#cbd5e1] shadow-sm";
}

function statusDotNewStyle(status: string): string {
  const map: Record<string, string> = {
    "Menunggu Review": "bg-[#475569]",
    Ditinjau: "bg-[#475569]",
    Disetujui: "bg-[#1e40af]",
    Ditolak: "bg-[#dc2626] animate-pulse",
    "Sedang Diperbaiki": "bg-[#D97706]",
    Selesai: "bg-[#16a34a]",
    Diedit: "bg-[#475569]",
  };
  return map[status] ?? "bg-[#475569]";
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

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) {
      return `Hari ini, ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
    }
    if (days === 1) return "Kemarin";
    const months = [
      "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
      "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
    ];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
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
  const [drafts, setDrafts] = useState<OfflineDraft[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(true);

  useEffect(() => {
    listDrafts().then((d) => {
      setDrafts(d);
      setDraftsLoading(false);
    });
  }, []);

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
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const rusakCount = recent.filter((r) => {
    const s = r.overall_severity ?? r.ai_severity ?? "";
    return s.toLowerCase().includes("berat");
  }).length;

  return (
    <PageLayout showBrand withBottomNav>
          <main className="flex-1 overflow-y-auto min-h-0 pb-4 pt-4">

          <section className="px-4 mb-6">
             <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-headline-sm text-headline-sm font-bold text-[#0F172A]">
                      Overview Operasional
                    </h3>
                    <p className="font-body-sm text-body-sm text-[#475569] mt-0.5">
                      Status pelaporan jalan Kab. Sidoarjo hari ini.
                    </p>
                  </div>
                </div>
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="lg:w-1/2">
               

                <div className="grid grid-cols-2 gap-3">
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="bg-white border border-[#E2E8F0] rounded-xl p-4 animate-pulse">
                        <div className="h-8 w-16 bg-gray-200 rounded mb-2" />
                        <div className="h-3 w-20 bg-gray-200 rounded" />
                      </div>
                    ))
                  ) : (
                    <>
                      <div className="bg-[#BA1A1A] rounded-xl p-4 relative overflow-hidden"
                        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                        <Icon name="dangerous" className="absolute bottom-0 right-0 !text-[72px] text-[#C84848] -mb-3 -mr-3" />
                        <div className="relative z-10 flex items-center justify-between mb-3">
                          <span className="font-label-sm text-label-sm font-semibold text-white/90 uppercase tracking-wider">
                            Rusak Berat
                          </span>
                          <Icon name="warning" className="!text-[18px] text-white/80" />
                        </div>
                        <p className="relative z-10 font-headline-lg text-headline-lg font-bold text-white leading-none mb-1">
                          {rusakCount}
                        </p>
                      </div>

                      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4"
                        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-label-sm text-label-sm font-semibold text-[#10B981] uppercase tracking-wider">
                            Selesai Diperbaiki
                          </span>
                          <Icon name="check_circle" className="!text-[18px] text-[#10B981]" />
                        </div>
                        <p className="font-headline-lg text-headline-lg font-bold text-[#0F172A] leading-none mb-1">
                          {stats?.selesai ?? 0}
                        </p>
                      </div>

                      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4"
                        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-label-sm text-label-sm font-semibold text-[#F59E0B] uppercase tracking-wider">
                            Sedang Diproses
                          </span>
                          <Icon name="pending_actions" className="!text-[18px] text-[#F59E0B]" />
                        </div>
                        <p className="font-headline-lg text-headline-lg font-bold text-[#0F172A] leading-none mb-1">
                          {(stats?.menunggu_review ?? 0) + (stats?.sedang_diperbaiki ?? 0)}
                        </p>

                      </div>

                      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4"
                        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-label-sm text-label-sm font-semibold text-[#475569] uppercase tracking-wider">
                            Total
                          </span>
                          <Icon name="dataset" className="!text-[18px] text-[#475569]" />
                        </div>
                        <p className="font-headline-lg text-headline-lg font-bold text-[#0F172A] leading-none mb-1">
                          {stats?.total ?? 0}
                        </p>
                        <p className="font-label-sm text-label-sm text-[#475569]">Total Laporan Aktif</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="lg:w-1/2">
                <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                  <div className="flex items-center justify-between px-4 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                    <h3 className="font-headline-sm text-headline-sm font-bold text-[#0F172A]">
                      Draf Laporan Terbaru
                    </h3>
                    {drafts.length > 0 && (
                      <Link
                        to="/drafts"
                        className="text-[13px] font-semibold text-[#1e40af] hover:text-[#173bab] transition-colors"
                      >
                        Lihat Semua
                      </Link>
                    )}
                  </div>

                  {draftsLoading ? (
                    [1, 2, 3].map((i) => (
                      <div key={i} className="p-4 animate-pulse border-b border-[#E2E8F0] last:border-b-0">
                        <div className="flex gap-3">
                          <div className="w-14 h-14 bg-gray-200 rounded-lg shrink-0" />
                          <div className="flex-1 space-y-2">
                            <div className="h-4 w-32 bg-gray-200 rounded" />
                            <div className="h-3 w-20 bg-gray-200 rounded" />
                          </div>
                        </div>
                      </div>
                    ))
                  ) : drafts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <div className="w-10 h-10 rounded-lg bg-[#F1F5F9] border border-[#E2E8F0] flex items-center justify-center mb-3">
                        <Icon name="edit_note" className="text-[#475569] !text-[20px]" />
                      </div>
                      <p className="font-body-md font-semibold text-[#0F172A] mb-1">Belum ada draf</p>
                      <p className="font-body-sm text-body-sm text-[#475569]">Buat laporan baru untuk mulai.</p>
                    </div>
                  ) : (
                    drafts.slice(0, 4).map((draft) => {
                      const draftDate = formatDate(draft.updatedAt);
                      return (
                        <Link
                          key={draft.id}
                          to="/upload"
                          search={{ draftId: draft.id }}
                          className="flex items-center gap-4 p-4 border-b border-[#E2E8F0] last:border-b-0 hover:bg-[#F8FAFC] transition-colors"
                        >
                          <div className="w-14 h-14 shrink-0 rounded-xl overflow-hidden bg-gray-100 border border-[#E2E8F0]">
                            {draft.photos[0]?.thumbnail ? (
                              <img src={draft.photos[0].thumbnail} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Icon name="photo" className="text-gray-300 !text-[18px]" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-semibold text-[#0F172A] truncate">
                              {draft.roadName || "(tanpa nama jalan)"}
                            </p>
                            <p className="text-[12px] text-[#475569] mt-0.5">{draftDate}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#475569] mr-1" />
                              Draf
                            </span>
                            <span className="text-[10px] text-[#475569] font-medium">
                              {draft.district || draft.photos.length + " foto"}
                            </span>
                          </div>
                        </Link>
                      );
                    })
                  )}
                </div>
              </div>
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

            {loading ? (
              <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-4 animate-pulse border-b border-[#E2E8F0] last:border-b-0">
                    <div className="h-4 w-40 bg-gray-200 rounded mb-2" />
                    <div className="h-3 w-24 bg-gray-200 rounded" />
                  </div>
                ))}
              </div>
            ) : recent.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center bg-white border border-[#E2E8F0] rounded-xl">
                <div className="w-12 h-12 rounded-xl bg-[#F1F5F9] border border-[#E2E8F0] flex items-center justify-center mb-4">
                  <Icon name="inbox" className="text-[#475569] !text-[22px]" />
                </div>
                <p className="font-body-md font-semibold text-[#0F172A] mb-1">Belum ada laporan</p>
                <p className="font-body-sm text-body-sm text-[#475569]">Upload laporan pertama Anda untuk mulai.</p>
              </div>
            ) : (
              <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recent.slice(0, 5).map((r) => {
                  const sc = getSeverityColor(r.overall_severity ?? r.ai_severity);
                  return (
                    <Link
                      to={user?.role === "petugas" ? "/detail-report" : "/review"}
                      search={{ reportId: r.id }}
                      key={r.id}
                      className={`flex gap-4 bg-white border border-[#E2E8F0] rounded-xl p-4 hover:shadow-md transition-shadow border-l-4 ${severityBorder(r.overall_severity ?? r.ai_severity)}`}
                    >
                      <div className="w-24 h-24 shrink-0 rounded-lg overflow-hidden bg-gray-100">
                        {r.first_photo_url ? (
                          <img src={r.first_photo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Icon name="photo" className="text-gray-300 !text-[24px]" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <p className="font-id-code text-id-code text-[#475569] mb-0.5">
                            {r.report_code}
                          </p>
                          <h4 className="font-body-md text-body-md font-semibold text-[#0F172A] truncate">
                            {r.road_name}
                          </h4>
                          <div className="flex items-center gap-3 mt-1 font-body-sm text-body-sm text-[#475569]">
                            <span className="flex items-center gap-1">
                              <Icon name="location_on" className="!text-[14px]" />
                              {r.district ?? "-"}
                            </span>
                            <span className="flex items-center gap-1">
                              <Icon name="calendar_today" className="!text-[14px]" />
                              {r.created_at ? formatDate(r.created_at) : "-"}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${severityBadgeStyle(sc.label)}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${severityDotStyle(sc.label)}`} />
                            {sc.label}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${statusBadgeNewStyle(r.status)}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusDotNewStyle(r.status)}`} />
                            {displayStatus(r.status)}
                          </span>
                          <span className="ml-auto">
                            <Icon name="visibility" className="text-primary !text-[20px]" />
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
              <div className="mt-4 px-5 py-3 bg-[#F1F5F9] border border-[#E2E8F0] rounded-xl">
                <p className="font-label-sm text-label-sm text-[#475569]">
                  Menampilkan {Math.min(recent.length, 5)} dari {stats?.total ?? 0} laporan
                </p>
              </div>
              </>
            )}
          </section>
        </main>
    </PageLayout>
  );
}
