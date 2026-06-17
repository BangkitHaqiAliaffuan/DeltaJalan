import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Icon } from "@/components/jk/Icon";
import { PageLayout } from "@/components/jk/PageLayout";
import { SkeletonCard } from "@/components/jk/Skeleton";
import { getCurrentUser, getToken } from "@/lib/auth";
import { listDrafts, type OfflineDraft } from "@/lib/offlineDrafts";
import { useStats, useRecentReports } from "@/hooks/useReportQueries";
import { ReportCard } from "@/components/jk/ReportCard";
import { ConfirmDialog } from "@/components/jk/ConfirmDialog";
import { formatDateRelative } from "@/lib/format";
import { API_BASE_URL } from "@/lib/aiStore";

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
  const { data: recent = [], isLoading: reportsLoading, refetch: refetchReports } = useRecentReports(token);
  const [drafts, setDrafts] = useState<OfflineDraft[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    listDrafts().then((d) => {
      setDrafts(d);
      setDraftsLoading(false);
    });
  }, []);

  const loading = !isClient || statsLoading || reportsLoading;

  function handleDeleteClick(id: string) {
    setDeleteTarget(id);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/reports/${deleteTarget}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setDeleteTarget(null);
        refetchReports();
      } else {
        const json = await res.json();
        alert(json.message ?? "Gagal menghapus laporan.");
        setDeleteTarget(null);
      }
    } catch {
      alert("Terjadi kesalahan jaringan.");
      setDeleteTarget(null);
    } finally {
      setDeleteLoading(false);
    }
  }

  const greeting = !isClient ? "Selamat Pagi" : (() => {
    const h = new Date().getHours();
    if (h < 10) return "Selamat Pagi";
    if (h < 15) return "Selamat Siang";
    return "Selamat Sore";
  })();

  const rusakCount = recent.filter((r) => {
    const s = r.overall_severity ?? r.ai_severity ?? "";
    return s.toLowerCase().includes("berat");
  }).length;

  return (
    <PageLayout showBrand withBottomNav>
      <main className="pb-4">
        <section className="bg-gradient-to-br from-[#1e40af] to-[#2e68d8] p-6 text-white mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                {greeting}, {user?.name ?? "Petugas"}
              </h1>
              <p className="text-sm text-blue-200 mt-1">
                Status pelaporan jalan Kab. Sidoarjo hari ini
              </p>
            </div>
            <span className="px-2.5 py-1 bg-white/15 text-xs font-semibold text-blue-200 uppercase tracking-wide">
              Petugas
            </span>
          </div>
          </section>

          <div className="max-w-5xl mx-auto px-4">
          <section className="mb-6">
            <h3 className="text-[15px] font-bold text-[#0F172A] mb-3 flex items-center gap-2">
              <Icon name="bar_chart" className="!text-lg text-[#1e40af]" />
              Overview Operasional
            </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {loading ? (
              <>
                {Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </>
            ) : (
              <>
                {[
                  { icon: "warning", label: "Rusak Berat", value: rusakCount, color: "text-[#DC2626]" },
                  { icon: "check_circle", label: "Selesai Diperbaiki", value: stats?.selesai ?? 0, color: "text-[#059669]" },
                  { icon: "pending_actions", label: "Sedang Diproses", value: (stats?.menunggu_review ?? 0) + (stats?.sedang_diperbaiki ?? 0), color: "text-[#D97706]" },
                  { icon: "dataset", label: "Total Laporan", value: stats?.total ?? 0, color: "text-[#1e40af]" },
                ].map((c) => (
                  <div key={c.label} className="bg-gradient-to-br from-[#EEF2FF] to-white border border-[#C7D2FE] rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 aspect-square group transition-all duration-200 ease-out hover:scale-[1.03] hover:shadow-md hover:border-[#A5B4FC]">
                      <div className="flex items-center justify-center gap-1.5">
                        <Icon name={c.icon} className={`${c.color} !text-2xl group-hover:scale-110 group-hover:-translate-y-0.5 transition-transform duration-200`} />
                        <span className={`text-2xl font-bold ${c.color}`}>{c.value}</span>
                      </div>
                      <p className={`text-sm font-medium ${c.color} opacity-80`}>{c.label}</p>
                    </div>
                ))}
              </>
            )}
          </div>
        </section>

        <section className="mb-6">
          <div className="bg-white border border-[#E2E8F0] overflow-hidden">
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
          </section>

        <section className="mb-6">
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
          <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
              <h4 className="text-[15px] font-bold text-[#0F172A]">Laporan Terbaru</h4>
              <Link to="/my-reports" className="text-[13px] font-semibold text-[#1e40af] hover:text-[#173bab] transition-colors flex items-center gap-1">
                Lihat Semua
                <Icon name="chevron_right" className="!text-[18px]" />
              </Link>
            </div>

            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-lg border border-[#E2E8F0] animate-pulse">
                    <div className="flex gap-4 p-4">
                      <div className="w-[100px] h-[100px] rounded-sm bg-slate-200 shrink-0" />
                      <div className="flex-1 space-y-3">
                        <div className="flex justify-between">
                          <div className="h-4 w-28 bg-slate-200 rounded" />
                          <div className="h-4 w-20 bg-slate-200 rounded" />
                        </div>
                        <div className="h-5 w-44 bg-slate-200 rounded" />
                        <div className="h-3 w-32 bg-slate-200 rounded" />
                        <div className="flex gap-2">
                          <div className="h-6 w-20 bg-slate-200 rounded" />
                          <div className="h-6 w-24 bg-slate-200 rounded" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : recent.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-xl bg-[#F1F5F9] flex items-center justify-center mb-4">
                  <Icon name="inbox" className="text-[#475569] !text-[22px]" />
                </div>
                <p className="text-[14px] font-semibold text-[#0F172A] mb-1">Belum ada laporan</p>
                <p className="text-[13px] text-[#475569]">Upload laporan pertama Anda untuk mulai.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 p-4">
                {recent.slice(0, 5).map((r) => (
                  <ReportCard key={r.id} variant="home" report={r} extra={{ isClient }} actions={{ onDelete: handleDeleteClick }} />
                ))}
              </div>
            )}
            {recent.length > 0 && (
              <div className="px-4 py-3 border-t border-[#E2E8F0] bg-[#F8FAFC]">
                <p className="text-[12px] font-medium text-[#475569]">
                  Menampilkan {Math.min(recent.length, 5)} dari {stats?.total ?? 0} laporan
                </p>
              </div>
            )}
          </div>
        </section>
        </div>
      </main>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Hapus Laporan?"
        message="Laporan yang dihapus tidak bisa dikembalikan. Semua foto dan data terkait akan dihapus permanen."
        confirmText="Ya, Hapus"
        cancelText="Batal"
        confirmLoading={deleteLoading}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </PageLayout>
  );
}

