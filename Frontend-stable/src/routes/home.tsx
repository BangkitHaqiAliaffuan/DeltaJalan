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
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-headline-sm text-headline-sm font-bold text-[#0F172A]">
              Laporan Terbaru
            </h3>
            <Link to="/my-reports" className="font-label-md text-label-md text-primary font-bold">
              Lihat Semua
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3" aria-busy="true" aria-label="Memuat laporan terbaru">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white border border-[#E2E8F0] rounded-xl p-4 animate-pulse">
                  <div className="flex gap-4">
                    <div className="w-16 h-16 rounded-lg bg-[#D0DAE8] shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="w-3/4 h-4 bg-[#D0DAE8] rounded" />
                      <div className="w-1/2 h-3 bg-[#E8F0FA] rounded" />
                      <div className="w-1/3 h-2.5 bg-[#E8F0FA] rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-white border border-[#E2E8F0] rounded-xl">
              <div className="w-12 h-12 rounded-xl bg-[#F1F5F9] border border-[#E2E8F0] flex items-center justify-center mb-4">
                <Icon name="inbox" className="text-[#475569] !text-[22px]" />
              </div>
              <p className="font-body-md font-semibold text-[#0F172A] mb-1">Belum ada laporan</p>
              <p className="font-body-sm text-body-sm text-[#475569]">
                Upload laporan pertama Anda untuk mulai.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recent.slice(0, 5).map((r) => {
                  const sc = getSeverityLabel(r.overall_severity ?? r.ai_severity);
                  return (
                    <Link
                      to={!isClient ? "/my-reports" : user?.role === "petugas" ? "/detail-report" : "/review"}
                      search={{ reportId: r.id }}
                      key={r.id}
                      className={`flex gap-4 bg-white border border-[#E2E8F0] rounded-xl p-4 hover:shadow-md transition-shadow border-l-4 ${severityBorder(r.overall_severity ?? r.ai_severity)}`}
                    >
                      <div className="w-24 h-24 shrink-0 rounded-lg overflow-hidden bg-gray-100">
                        {r.first_photo_url ? (
                          <img
                            src={r.first_photo_url}
                            alt=""
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
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
                               {r.created_at ? formatDateRelative(r.created_at, isClient) : "-"}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${severityBadgeStyle(sc.label)}`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${severityDotStyle(sc.label)}`}
                            />
                            {sc.label}
                          </span>
                          <span
                             className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${statusBadgeStyle(r.status)}`}
                          >
                            <span
                               className={`w-1.5 h-1.5 rounded-full ${statusDotStyle(r.status)}`}
                            />
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
