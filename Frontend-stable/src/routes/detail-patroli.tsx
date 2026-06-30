import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Icon } from "@/components/jk/Icon";
import { PageLayout } from "@/components/jk/PageLayout";
import { SafeImage } from "@/components/jk/SafeImage";
import { getCurrentUser } from "@/lib/auth";
import { formatDate, displayStatus, statusDotStyle } from "@/lib/format";
import { useSurveyDetail } from "@/hooks/useSurveyQueries";
import type { PatrolSession } from "@/types/survey";

export const Route = createFileRoute("/detail-patroli")({
  component: DetailPatroliPage,
  validateSearch: (search: Record<string, unknown>) => {
    const taskId = search.taskId as string | undefined;
    return { ...(taskId ? { taskId } : {}) };
  },
  head: () => ({ meta: [{ title: "Detail Patroli — DeltaJalan" }] }),
});

const STATUS_STYLES: Record<string, string> = {
  aktif: "bg-blue-50 text-[#1e40af] border border-blue-200",
  selesai: "bg-green-50 text-[#10B981] border border-green-200",
  dibatalkan: "bg-gray-50 text-[#64748B] border border-gray-200",
};

function formatJam(jam?: string | null): string {
  if (!jam) return "—";
  return jam.slice(0, 5);
}

function DetailPatroliPage() {
  const { taskId } = Route.useSearch();
  const navigate = useNavigate();
  const user = getCurrentUser();
  const userRole = user?.role ?? "petugas";

  const { data: rawTask, isFetching, error, refetch } = useSurveyDetail(taskId);
  const task = rawTask as PatrolSession | undefined;

  if (!task) {
    if (isFetching) {
      return (
        <PageLayout back="/" title="Detail Patroli">
          <main className="flex flex-col gap-4 p-4 animate-pulse" aria-busy="true">
            <div className="bg-white border border-[#D0DAE8] rounded-xl p-4 space-y-3">
              <div className="w-3/4 h-6 bg-[#D0DAE8] rounded" />
              <div className="w-1/2 h-4 bg-[#E8F0FA] rounded" />
              <div className="flex gap-2">
                <div className="w-20 h-5 bg-[#D0DAE8] rounded-full" />
                <div className="w-20 h-5 bg-[#D0DAE8] rounded-full" />
              </div>
            </div>
            <div className="bg-white border border-[#D0DAE8] rounded-xl h-48" />
          </main>
        </PageLayout>
      );
    }
    return (
      <PageLayout back="/" title="Detail Patroli">
        <main className="flex flex-col items-center justify-center gap-3 px-4 min-h-[50vh]">
          <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center">
            <Icon name="error" className="!text-[28px] text-[#E11D48]" />
          </div>
          <p className="text-[14px] font-semibold text-[#0F172A]">
            {error?.message || "Sesi patroli tidak ditemukan."}
          </p>
          <Link
            to={userRole === "supervisor" ? "/supervisor" : "/tugas-saya"}
            className="px-5 py-2 bg-[#1A4F8A] text-white text-[13px] font-medium rounded-lg hover:bg-[#153d6e] transition-colors"
          >
            Kembali
          </Link>
        </main>
      </PageLayout>
    );
  }

  const isPetugas = userRole === "petugas";
  const isAktif = task.status === "aktif";
  const canUpload = isPetugas && isAktif;
  const reports = task.reports ?? [];

  const sessionSummary = {
    total: reports.length,
    selesai: reports.filter((r) => r.status === "Selesai").length,
    diperbaiki: reports.filter((r) => r.status === "Sedang Diperbaiki").length,
    menunggu: reports.filter((r) => r.status === "Menunggu Review").length,
  };

  return (
    <PageLayout
      back={userRole === "supervisor" ? "/supervisor" : "/tugas-saya"}
      title="Detail Patroli"
    >
      <main>
        <div className="max-w-2xl mx-auto p-4 flex flex-col gap-4">
          {/* Sesi Info Card */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[17px] font-bold text-[#0F172A]">
                Patroli {task.tanggal_patroli ? formatDate(task.tanggal_patroli) : ""}
              </h2>
              <span
                className={`px-3 py-1 rounded-full text-[11px] font-bold ${STATUS_STYLES[task.status] ?? ""}`}
              >
                {task.status === "aktif"
                  ? "Aktif"
                  : task.status === "selesai"
                    ? "Selesai"
                    : "Dibatalkan"}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              <InfoRow icon="location_on" value={task.kecamatan ? `Kec. ${task.kecamatan}` : "—"} />
              <InfoRow icon="group" value={task.team?.name ? `Tim: ${task.team.name}` : "—"} />
              <InfoRow
                icon="schedule"
                value={`${formatJam(task.jam_mulai)} — ${formatJam(task.jam_selesai)}`}
              />
              {task.tanggal_patroli && (
                <InfoRow icon="event" value={formatDate(task.tanggal_patroli)} />
              )}
              {task.alasan_tugas && (
                <InfoRow icon="info" value={task.alasan_tugas.replace("_", " ")} />
              )}
            </div>
            {reports.length > 0 && (
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#E2E8F0] text-[12px] text-[#64748B]">
                <span className="font-semibold text-[#0F172A]">{sessionSummary.total} laporan</span>
                {sessionSummary.selesai > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                    {sessionSummary.selesai} selesai
                  </span>
                )}
                {sessionSummary.diperbaiki > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#F97316]" />
                    {sessionSummary.diperbaiki} diperbaiki
                  </span>
                )}
                {sessionSummary.menunggu > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                    {sessionSummary.menunggu} menunggu
                  </span>
                )}
              </div>
            )}
            {task.catatan && (
              <p className="mt-3 text-[13px] text-[#64748B] bg-[#F8FAFC] rounded-lg p-3 border border-[#E2E8F0]">
                <span className="font-semibold">Catatan:</span> {task.catatan}
              </p>
            )}
          </div>

          {/* Upload Section */}
          {canUpload && (
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
              <h3 className="text-[14px] font-bold text-[#0F172A] mb-3">Tambah Laporan</h3>
              <button
                type="button"
                onClick={() => navigate({ to: "/upload", search: { taskId } })}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#1A4F8A] text-white rounded-lg text-[13px] font-semibold hover:bg-[#153d6e] transition-colors"
              >
                <Icon name="add_a_photo" className="!text-lg" />
                Tambah Laporan Patroli
              </button>
            </div>
          )}

          {/* Reports list */}
          {reports.length > 0 && (
            <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center justify-between">
                <h3 className="text-[14px] font-bold text-[#0F172A]">
                  <Icon name="list_alt" className="!text-lg text-[#1e40af] inline mr-1" />
                  Laporan ({reports.length})
                </h3>
              </div>
              <div className="divide-y divide-[#E2E8F0]">
                {reports.map((r) => (
                  <div
                    key={r.id}
                    className="px-4 py-3 flex items-center gap-3 hover:bg-[#F8FAFC] transition-colors"
                  >
                    {r.first_photo_url || r.image_original_url ? (
                      <SafeImage
                        src={r.first_photo_url ?? r.image_original_url!}
                        alt=""
                        className="w-14 h-14 rounded-lg object-cover shrink-0 border border-[#E2E8F0]"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-[#EEF3FA] flex items-center justify-center shrink-0">
                        <Icon name="photo" className="!text-xl text-[#94A3B8]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-medium text-[#0F172A] truncate">
                          {r.report_code || "Laporan"}
                        </p>
                        {r.overall_severity && (
                          <SeverityBadge severity={r.overall_severity} />
                        )}
                      </div>
                      {r.road_name && (
                        <p className="text-[11px] text-[#64748B] mt-0.5 truncate">
                          <Icon name="road" className="!text-[11px] inline mr-0.5" />
                          {r.road_name}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${statusDotStyle(r.status)}`} />
                        <span className="text-[11px] text-[#64748B]">
                          {displayStatus(r.status)}
                        </span>
                        <span className="text-[#E2E8F0]">·</span>
                        <span className="text-[11px] text-[#64748B]">
                          {formatDate(r.created_at)}
                        </span>
                      </div>
                    </div>
                    <Link
                      to="/detail-report"
                      search={{ reportId: r.id }}
                      className="shrink-0 px-2.5 py-1 bg-[#EEF3FA] text-[#476788] rounded-lg text-[11px] font-semibold hover:bg-[#E2E8F0] transition-colors"
                    >
                      Detail
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {reports.length === 0 && !canUpload && (
            <div className="text-center py-8 text-[#64748B]">
              <Icon name="photo_camera" className="!text-4xl mb-2 opacity-30" />
              <p className="text-[13px]">Belum ada laporan untuk sesi patroli ini</p>
            </div>
          )}
        </div>
      </main>
    </PageLayout>
  );
}

const SEVERITY_COLORS: Record<string, string> = {
  "Rusak Berat": "bg-[#E11D48] text-white",
  "Rusak Sedang": "bg-orange-50 text-[#F97316] border border-orange-200",
  "Rusak Ringan": "bg-amber-50 text-[#F59E0B] border border-amber-200",
};

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span
      className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${SEVERITY_COLORS[severity] ?? "bg-gray-50 text-gray-600 border border-gray-200"}`}
    >
      {severity}
    </span>
  );
}

function InfoRow({ icon, value }: { icon: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon name={icon} className="!text-[18px] text-[#64748B] shrink-0" />
      <span className="text-[13px] text-[#0F172A]">{value}</span>
    </div>
  );
}

export default DetailPatroliPage;
