import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Icon } from "@/components/jk/Icon";
import { PageLayout } from "@/components/jk/PageLayout";
import { Skeleton, SkeletonCard } from "@/components/jk/Skeleton";
import { getCurrentUser, getToken } from "@/lib/auth";
import { listDrafts, type OfflineDraft } from "@/lib/offlineDrafts";
import { useStats, useRecentReports } from "@/hooks/useReportQueries";
import {
  getSeverityLabel,
  severityBadgeStyle,
  severityDotStyle,
  severityBorder,
  statusBadgeStyle,
  statusDotStyle,
  formatDateRelative,
  displayStatus,
} from "@/lib/format";

export const Route = createFileRoute("/home")({
  component: HomePage,
  head: () => ({ meta: [{ title: "Beranda Petugas — DeltaJalan" }] }),
});



function HomePage() {
  const user = getCurrentUser();
  const token = getToken() ?? "";
  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);

  const { data: stats, isLoading: statsLoading } = useStats(token);
  const { data: recent = [], isLoading: reportsLoading } = useRecentReports(token);
  const [drafts, setDrafts] = useState<OfflineDraft[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(true);

  useEffect(() => {
    listDrafts().then((d) => {
      setDrafts(d);
      setDraftsLoading(false);
    });
  }, []);

  const loading = !isClient || statsLoading || reportsLoading;

  const rusakCount = recent.filter((r) => {
    const s = r.overall_severity ?? r.ai_severity ?? "";
    return s.toLowerCase().includes("berat");
  }).length;

  return (
    <PageLayout showBrand withBottomNav>
      <main className="pb-4 pt-4">
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
                  <div className="grid grid-cols-2 gap-3 col-span-2" aria-busy="true" aria-label="Memuat statistik">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <SkeletonCard key={i} />
                    ))}
                  </div>
                ) : (
                  <>
                    <div
                      className="bg-[#BA1A1A] rounded-xl p-4 relative overflow-hidden"
                      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
                    >
                      <Icon
                        name="dangerous"
                        className="absolute bottom-0 right-0 !text-[72px] text-[#C84848] -mb-3 -mr-3"
                      />
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

                    <div
                      className="bg-white border border-[#E2E8F0] rounded-xl p-4"
                      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
                    >
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

                    <div
                      className="bg-white border border-[#E2E8F0] rounded-xl p-4"
                      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
                    >
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

                    <div
                      className="bg-white border border-[#E2E8F0] rounded-xl p-4"
                      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-label-sm text-label-sm font-semibold text-[#475569] uppercase tracking-wider">
                          Total
                        </span>
                        <Icon name="dataset" className="!text-[18px] text-[#475569]" />
                      </div>
                      <p className="font-headline-lg text-headline-lg font-bold text-[#0F172A] leading-none mb-1">
                        {stats?.total ?? 0}
                      </p>
                      <p className="font-label-sm text-label-sm text-[#475569]">
                        Total Laporan Aktif
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="lg:w-1/2">
              <div
                className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden"
                style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
              >
                <div className="flex items-center justify-between px-4 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  <h3 className="font-headline-sm text-headline-sm font-bold text-[#0F172A] flex items-center gap-2">
                    Draf Laporan Terbaru
                    {drafts.length > 0 && (
                      <span className="bg-[#E2E8F0] text-[#475569] text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {drafts.length}
                      </span>
                    )}
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
                    <div
                      key={i}
                      className="p-4 animate-pulse border-b border-[#E2E8F0] last:border-b-0"
                    >
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
                    <p className="font-body-sm text-body-sm text-[#475569]">
                      Buat laporan baru untuk mulai.
                    </p>
                  </div>
                ) : (
                  drafts.slice(0, 4).map((draft) => {
                    const draftDate = formatDateRelative(draft.updatedAt, isClient);
                    return (
                      <Link
                        key={draft.id}
                        to="/upload"
                        search={{ draftId: draft.id }}
                        className="flex items-center gap-4 p-4 border-b border-[#E2E8F0] last:border-b-0 hover:bg-[#F8FAFC] transition-colors"
                      >
                        <div className="w-14 h-14 shrink-0 rounded-xl overflow-hidden bg-gray-100 border border-[#E2E8F0]">
                          {draft.photos[0]?.thumbnail ? (
                            <img
                              src={draft.photos[0].thumbnail}
                              alt=""
                              loading="lazy"
                              className="w-full h-full object-cover"
                            />
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
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between bg-surface-container-low/50">
              <h4 className="font-headline-md text-headline-md text-on-surface">Laporan Terbaru</h4>
              <Link to="/my-reports" className="text-primary font-label-md hover:underline flex items-center gap-1">
                Lihat Semua
                <Icon name="chevron_right" className="!text-[18px]" />
              </Link>
            </div>

            {loading ? (
              <div className="space-y-3 p-6" aria-busy="true" aria-label="Memuat laporan terbaru">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex gap-4 animate-pulse">
                    <div className="w-12 h-4 bg-surface-container-high rounded" />
                    <div className="flex-1 space-y-2">
                      <div className="w-3/4 h-4 bg-surface-container-high rounded" />
                      <div className="w-1/2 h-3 bg-surface-container rounded" />
                    </div>
                    <div className="w-20 h-4 bg-surface-container-high rounded" />
                    <div className="w-16 h-6 bg-surface-container-high rounded-full" />
                    <div className="w-24 h-4 bg-surface-container-high rounded" />
                  </div>
                ))}
              </div>
            ) : recent.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-xl bg-surface-container-low flex items-center justify-center mb-4">
                  <Icon name="inbox" className="text-on-surface-variant !text-[22px]" />
                </div>
                <p className="font-body-md font-semibold text-on-surface mb-1">Belum ada laporan</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Upload laporan pertama Anda untuk mulai.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-surface-container-low/30">
                    <tr>
                      <th className="px-6 py-3 font-label-md text-on-surface-variant uppercase tracking-wider text-[11px] whitespace-nowrap">No</th>
                      <th className="px-6 py-3 font-label-md text-on-surface-variant uppercase tracking-wider text-[11px] whitespace-nowrap">Foto</th>
                      <th className="px-6 py-3 font-label-md text-on-surface-variant uppercase tracking-wider text-[11px] whitespace-nowrap">Judul</th>
                      <th className="px-6 py-3 font-label-md text-on-surface-variant uppercase tracking-wider text-[11px] whitespace-nowrap">Lokasi</th>
                      <th className="px-6 py-3 font-label-md text-on-surface-variant uppercase tracking-wider text-[11px] whitespace-nowrap">Status</th>
                      <th className="px-6 py-3 font-label-md text-on-surface-variant uppercase tracking-wider text-[11px] whitespace-nowrap">Tanggal</th>
                      <th className="px-6 py-3 font-label-md text-on-surface-variant uppercase tracking-wider text-[11px] text-right whitespace-nowrap">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {recent.slice(0, 5).map((r) => {
                      const sc = getSeverityLabel(r.overall_severity ?? r.ai_severity);
                      const reportPath = !isClient ? "/my-reports" : user?.role === "petugas" ? "/detail-report" : "/review";
                      return (
                        <tr key={r.id} className="hover:bg-surface-container-low transition-colors group">
                          <td className="px-6 py-3">
                            <Link to={reportPath} search={{ reportId: r.id }} className="text-body-md text-on-surface no-underline block">
                              {r.report_code}
                            </Link>
                          </td>
                          <td className="px-6 py-3">
                            <Link to={reportPath} search={{ reportId: r.id }} className="no-underline block">
                              <div className="w-9 h-9 rounded-lg overflow-hidden bg-surface-container-high">
                                {r.first_photo_url ? (
                                  <img src={r.first_photo_url} alt="" loading="lazy" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Icon name="photo" className="text-surface-container-highest !text-[14px]" />
                                  </div>
                                )}
                              </div>
                            </Link>
                          </td>
                          <td className="px-6 py-3">
                            <Link to={reportPath} search={{ reportId: r.id }} className="no-underline block">
                              <div className="font-semibold text-on-surface truncate max-w-[180px]">{r.road_name}</div>
                            </Link>
                          </td>
                          <td className="px-6 py-3 text-on-surface-variant whitespace-nowrap">{r.district ?? "-"}</td>
                          <td className="px-6 py-3 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold leading-none ${statusBadgeStyle(r.status)}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${statusDotStyle(r.status)}`} />
                              {displayStatus(r.status)}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-on-surface-variant whitespace-nowrap">{r.created_at ? formatDateRelative(r.created_at, isClient) : "-"}</td>
                          <td className="px-6 py-3 text-right whitespace-nowrap">
                            <Link
                              to={reportPath}
                              search={{ reportId: r.id }}
                              className="p-1 text-outline hover:text-primary inline-flex"
                            >
                              <Icon name="visibility" className="!text-[20px]" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {recent.length > 0 && (
              <div className="px-6 py-3 border-t border-outline-variant bg-surface-container-low/30">
                <p className="font-label-md text-label-md text-on-surface-variant">
                  Menampilkan {Math.min(recent.length, 5)} dari {stats?.total ?? 0} laporan
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    </PageLayout>
  );
}
