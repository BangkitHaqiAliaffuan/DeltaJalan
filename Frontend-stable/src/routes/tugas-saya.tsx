import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { Icon } from "@/components/jk/Icon";
import { PageLayout } from "@/components/jk/PageLayout";
import { getCurrentUser, getToken } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { useSurveyList } from "@/hooks/useSurveyQueries";
import { usePatrolSchedules } from "@/hooks/usePatrolScheduleQueries";
import { PatrolScheduleCard } from "@/components/jk/PatrolScheduleCard";
import type { SurveyTask, PatrolSchedule } from "@/types/survey";
import { API_BASE_URL } from "@/lib/aiStore";
import { ReportCard } from "@/components/jk/ReportCard";
import { ModalBase } from "@/components/jk/ModalBase";
import { ConfirmDialog } from "@/components/jk/ConfirmDialog";
import { ProgressUpdateModal } from "@/components/jk/ProgressUpdateModal";
import type { Laporan } from "@/types/laporan";
import type { ActionButton } from "@/components/jk/report-card/types";

export const Route = createFileRoute("/tugas-saya")({
  component: TugasSayaPage,
  head: () => ({ meta: [{ title: "Tugas Saya — DeltaJalan" }] }),
});

// ── Constants & Helpers ──

const PRIORITY_STYLES: Record<string, string> = {
  Tinggi: "bg-[#E11D48] text-white",
  Sedang: "bg-orange-50 text-[#F97316] border border-orange-200",
  Rendah: "bg-green-50 text-[#10B981] border border-green-200",
};

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayFormatted(isClient: boolean): string {
  if (!isClient) return "";
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const months = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  const d = new Date();
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ── Main Component ──

function TugasSayaPage() {
  const user = getCurrentUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const token = getToken() ?? "";
  const [isClient, setIsClient] = useState(false);
  const [tab, setTab] = useState<"patroli" | "perbaikan">("patroli");
  const today = todayStr();
  const teamId = user?.team_id;

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (user?.role !== "petugas") navigate({ to: "/masuk" });
  }, [user, navigate]);

  // ── Patroli hooks ──

  const { data: tasks = [], isFetching: isFetchingPatroli } = useSurveyList(
    teamId ? { team_id: teamId, tanggal_patroli: today } : undefined,
  );

  const schedulesQuery = usePatrolSchedules(teamId ? { team_id: teamId } : undefined);
  const schedules: PatrolSchedule[] = schedulesQuery.data?.data ?? [];

  // ── Perbaikan hooks ──

  const [laporan, setLaporan] = useState<Laporan[]>([]);
  const [loadingPerbaikan, setLoadingPerbaikan] = useState(true);
  const [errorPerbaikan, setErrorPerbaikan] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string>("semua");
  const [sortBy, setSortBy] = useState<string>("prioritas");
  const [showEstimasi, setShowEstimasi] = useState(false);
  const [estimasiHari, setEstimasiHari] = useState(7);
  const [estimasiMode, setEstimasiMode] = useState<"same-day" | "multi-day">("same-day");
  const [estimasiTargetId, setEstimasiTargetId] = useState<string | null>(null);
  const [showMulaiConfirm, setShowMulaiConfirm] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressTargetId, setProgressTargetId] = useState<string | null>(null);
  const [progressTargetCode, setProgressTargetCode] = useState("");

  useEffect(() => {
    if (tab === "perbaikan") {
      loadReports();
      const interval = setInterval(loadReports, 30_000);
      return () => clearInterval(interval);
    }
  }, [tab]);

  async function loadReports() {
    setLoadingPerbaikan(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const reportsRes = await fetch(`${API_BASE_URL}/reports?limit=50&team_tasks=1`, { headers });
      if (reportsRes.ok) {
        const json = await reportsRes.json();
        setLaporan(json.data ?? []);
      } else {
        setErrorPerbaikan("Gagal memuat data.");
      }
    } catch {
      setErrorPerbaikan("Terjadi kesalahan jaringan.");
    } finally {
      setLoadingPerbaikan(false);
    }
  }

  async function handleMulai(id: string) {
    const report = laporan.find((r) => r.id === id);
    const isRingan = report?.overall_severity === "Rusak Ringan";
    setEstimasiTargetId(id);
    setEstimasiHari(isRingan ? 1 : 7);
    setEstimasiMode(isRingan ? "same-day" : "multi-day");
    setShowEstimasi(true);
  }

  function handleMulaiOpenConfirm() {
    setShowMulaiConfirm(true);
  }

  async function handleMulaiConfirm() {
    if (!estimasiTargetId) return;
    setShowMulaiConfirm(false);
    setActionLoading(estimasiTargetId);
    try {
      const estimasiValue = estimasiMode === "same-day" ? null : estimasiHari;
      const res = await fetch(`${API_BASE_URL}/reports/${estimasiTargetId}/mulai`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ estimasi_selesai_hari: estimasiValue }),
      });
      if (res.ok) {
        setShowEstimasi(false);
        setEstimasiTargetId(null);
        await loadReports();
      } else {
        const json = await res.json();
        alert(json.message ?? "Gagal memulai pengerjaan.");
      }
    } catch {
      alert("Terjadi kesalahan jaringan.");
    } finally {
      setActionLoading(null);
    }
  }

  function handleProgressClick(id: string, code: string) {
    setProgressTargetId(id);
    setProgressTargetCode(code);
    setShowProgressModal(true);
  }

  const byFilter = useMemo(() => {
    return (r: Laporan) => {
      if (priorityFilter !== "semua") {
        if ((r.priority ?? "") !== priorityFilter) return false;
      }
      return true;
    };
  }, [priorityFilter]);

  const sortFn = useMemo(() => {
    return (a: Laporan, b: Laporan) => {
      if (sortBy === "prioritas") {
        const prioOrder: Record<string, number> = { Tinggi: 0, Sedang: 1, Rendah: 2 };
        const ap = prioOrder[a.priority ?? ""] ?? 3;
        const bp = prioOrder[b.priority ?? ""] ?? 3;
        if (ap !== bp) return ap - bp;
      }
      if (sortBy === "deadline") {
        const aDeadline = a.deadline_resolusi ?? a.deadline_review;
        const bDeadline = b.deadline_resolusi ?? b.deadline_review;
        if (aDeadline && bDeadline)
          return new Date(aDeadline).getTime() - new Date(bDeadline).getTime();
        if (aDeadline) return -1;
        if (bDeadline) return 1;
      }
      return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
    };
  }, [sortBy]);

  const { tugasBaru, tugasBerjalan, tugasSelesai, stats } = useMemo(() => {
    const baru: typeof laporan = [];
    const berjalan: typeof laporan = [];
    const selesai: typeof laporan = [];
    let berat = 0;
    for (const r of laporan) {
      const pass = byFilter(r);
      if (r.status === "Ditugaskan" && pass) baru.push(r);
      if (r.status === "Sedang Diperbaiki" && pass) berjalan.push(r);
      if (r.status === "Selesai" && pass) selesai.push(r);

      const s = r.overall_severity ?? r.ai_severity ?? "";
      if (s.toLowerCase().includes("berat")) berat++;
    }
    const sort = (arr: typeof laporan) => arr.sort(sortFn);
    return {
      tugasBaru: sort(baru),
      tugasBerjalan: sort(berjalan),
      tugasSelesai: sort(selesai),
      stats: { total: laporan.length, berat },
    };
  }, [laporan, byFilter, sortFn]);

  const hasAny = tugasBaru.length > 0 || tugasBerjalan.length > 0 || tugasSelesai.length > 0;

  // ── No team guard ──

  if (!teamId) {
    return (
      <PageLayout showBrand withBottomNav>
        <main className="pb-4">
          <section className="bg-gradient-to-br from-[#1e40af] to-[#2e68d8] p-6 text-white mb-6">
            <h1 className="text-xl font-bold tracking-tight">Tugas Saya</h1>
            <p className="text-sm text-blue-200 mt-1">Belum tergabung dalam tim</p>
          </section>
          <div className="max-w-5xl mx-auto px-4">
            <div className="text-center py-12 text-[#476788]">
              <Icon name="group_off" className="!text-5xl mb-3 opacity-30" />
              <p className="font-body-md text-body-md">Anda belum ditugaskan ke tim manapun</p>
            </div>
          </div>
        </main>
      </PageLayout>
    );
  }

  async function handleRefresh() {
    if (tab === "perbaikan") {
      await loadReports();
    } else {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["survey-list"] }),
        queryClient.invalidateQueries({ queryKey: ["patrol-schedules"] }),
      ]);
    }
  }

  // ── Render ──

  return (
    <PageLayout showBrand withBottomNav onRefresh={handleRefresh}>
      <main className="pb-4">
        <section className="bg-gradient-to-br from-[#1e40af] to-[#2e68d8] p-6 text-white mb-6">
          <h1 className="text-xl font-bold tracking-tight">Tugas Saya</h1>
          {user?.team_name && <p className="text-sm text-blue-200 mt-1">{user.team_name}</p>}
          <div className="flex gap-1 bg-white/20 rounded-lg p-1 mt-3">
            <button
              onClick={() => setTab("patroli")}
              className={`flex-1 px-4 py-1.5 rounded-md text-[12px] font-semibold transition-colors ${
                tab === "patroli"
                  ? "bg-white text-[#1e40af] shadow-sm"
                  : "text-white/80 hover:text-white"
              }`}
            >
              Patroli
            </button>
            <button
              onClick={() => setTab("perbaikan")}
              className={`flex-1 px-4 py-1.5 rounded-md text-[12px] font-semibold transition-colors ${
                tab === "perbaikan"
                  ? "bg-white text-[#1e40af] shadow-sm"
                  : "text-white/80 hover:text-white"
              }`}
            >
              Perbaikan
            </button>
          </div>
        </section>

        <div className="max-w-5xl mx-auto px-4">
          {tab === "patroli" ? (
            <>
              <PatrolScheduleCard schedules={schedules} isFetching={schedulesQuery.isFetching} />
              <PatroliSection isFetching={isFetchingPatroli} tasks={tasks} />
            </>
          ) : (
            <PerbaikanSection
              loading={loadingPerbaikan}
              error={errorPerbaikan}
              priorityFilter={priorityFilter}
              setPriorityFilter={setPriorityFilter}
              sortBy={sortBy}
              setSortBy={setSortBy}
              tugasBerjalan={tugasBerjalan}
              tugasBaru={tugasBaru}
              tugasSelesai={tugasSelesai}
              stats={stats}
              hasAny={hasAny}
              actionLoading={actionLoading}
              handleMulai={handleMulai}
              isClient={isClient}
              onProgressClick={handleProgressClick}
            />
          )}
        </div>
      </main>

      {showEstimasi && (
        <ModalBase
          onClose={() => { setShowEstimasi(false); setEstimasiTargetId(null); }}
          icon="play_arrow"
          badge="MULAI PENGERJAAN"
          title="Estimasi Waktu Penyelesaian"
          footer={
            <>
              <button
                type="button"
                disabled={actionLoading === estimasiTargetId}
                onClick={handleMulaiOpenConfirm}
                className="w-full h-11 bg-[#1A4F8A] text-white rounded-lg text-[14px] font-semibold flex items-center justify-center gap-2 hover:bg-[#153d6e] active:scale-95 transition-all disabled:opacity-50"
              >
                {actionLoading === estimasiTargetId ? (
                  "Memproses…"
                ) : (
                  <>
                    <Icon name="play_arrow" className="!text-[18px]" />
                    Mulai Pengerjaan
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => { setShowEstimasi(false); setEstimasiTargetId(null); }}
                className="w-full h-10 text-[13px] text-[#64748B] font-medium hover:text-[#0F172A] transition-colors"
              >
                Batal
              </button>
            </>
          }
        >
          <div>
            <p className="text-[13px] text-[#475569] mb-4 leading-relaxed">
              Perkirakan waktu yang dibutuhkan untuk menyelesaikan perbaikan laporan ini.
            </p>
            <div className="space-y-3">
              <label
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  estimasiMode === "same-day"
                    ? "border-[#1A4F8A] bg-[#EFF6FF]"
                    : "border-[#D0DAE8] bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="estimasi"
                  checked={estimasiMode === "same-day"}
                  onChange={() => setEstimasiMode("same-day")}
                  className="accent-[#1A4F8A]"
                />
                <div>
                  <p className="text-[13px] font-semibold text-[#0F172A]">Same day</p>
                  <p className="text-[11px] text-[#64748B]">Selesai hari ini juga</p>
                </div>
              </label>
              <label
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  estimasiMode === "multi-day"
                    ? "border-[#1A4F8A] bg-[#EFF6FF]"
                    : "border-[#D0DAE8] bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="estimasi"
                  checked={estimasiMode === "multi-day"}
                  onChange={() => setEstimasiMode("multi-day")}
                  className="accent-[#1A4F8A]"
                />
                <div>
                  <p className="text-[13px] font-semibold text-[#0F172A]">Estimasi hari</p>
                  <p className="text-[11px] text-[#64748B]">Butuh beberapa hari pengerjaan</p>
                </div>
              </label>
              {estimasiMode === "multi-day" && (
                <div className="pl-8">
                  <label className="text-[12px] font-semibold text-[#0F172A] mb-1 block">
                    Berapa hari?
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={90}
                    value={estimasiHari}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === "") { setEstimasiHari(1); return; }
                      const num = parseInt(raw, 10);
                      if (!isNaN(num)) setEstimasiHari(Math.max(1, Math.min(90, num)));
                    }}
                    className="w-full h-10 px-3 rounded-lg border border-[#D0DAE8] text-[13px] text-[#0F172A] outline-none focus:ring-2 focus:ring-[#1A4F8A]/20 focus:border-[#1A4F8A] appearance-none [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden"
                  />
                </div>
              )}
            </div>
          </div>
        </ModalBase>
      )}

      {/* ── Confirm Mulai ── */}
      {estimasiTargetId && (
        <ConfirmDialog
          open={showMulaiConfirm}
          title="Mulai Pengerjaan?"
          message={
            (() => {
              const r = laporan.find((x) => x.id === estimasiTargetId);
              const code = r?.report_code ?? estimasiTargetId;
              const road = r?.road_name ?? "";
              return `Mulai perbaikan ${code} — ${road}?${
                estimasiMode === "same-day"
                  ? "\nEstimasi: Selesai hari ini"
                  : `\nEstimasi: ${estimasiHari} hari`
              }`;
            })()
          }
          confirmText="Ya, Mulai"
          cancelText="Batal"
          confirmLoading={actionLoading === estimasiTargetId}
          onConfirm={handleMulaiConfirm}
          onCancel={() => { setShowMulaiConfirm(false); setShowEstimasi(true); }}
          icon="play_arrow"
          confirmClassName="flex-1 px-4 py-2.5 text-[13px] font-bold text-white bg-[#1A4F8A] rounded-xl hover:bg-[#153d6e] disabled:opacity-40 transition-all flex items-center justify-center gap-1.5"
        />
      )}

      {showProgressModal && progressTargetId && (
        <ProgressUpdateModal
          reportId={progressTargetId}
          reportCode={progressTargetCode}
          token={token}
          onClose={() => { setShowProgressModal(false); setProgressTargetId(null); setProgressTargetCode(""); }}
          onSuccess={loadReports}
        />
      )}
    </PageLayout>
  );
}

export default TugasSayaPage;

// ── Patroli Section ──

function PatroliSection({ isFetching, tasks }: { isFetching: boolean; tasks: SurveyTask[] }) {
  return (
    <>
      {isFetching && (
        <div className="flex flex-col gap-2" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white border border-[#D0DAE8] rounded-xl p-4 animate-pulse">
              <div className="w-3/4 h-5 bg-[#D0DAE8] rounded mb-2" />
              <div className="w-1/2 h-4 bg-[#E8F0FA] rounded" />
            </div>
          ))}
        </div>
      )}

      {!isFetching && tasks.length === 0 && (
        <div className="text-center py-12 text-[#476788]">
          <Icon name="inbox" className="!text-5xl mb-3 opacity-30" />
          <p className="font-body-md text-body-md">Tidak ada shift untuk hari ini</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {tasks.map((task) => (
          <Link
            key={task.id}
            to="/detail-patroli"
            search={{ taskId: task.id }}
            className="bg-white border border-[#D0DAE8] rounded-xl p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 block"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0 mr-2">
                <h4 className="text-[14px] font-bold text-[#0F172A] truncate">{task.road_name}</h4>
                <div className="flex items-center gap-2 text-[12px] text-[#64748B] mt-0.5">
                  {task.kecamatan && <span>Kec. {task.kecamatan}</span>}
                  {task.alasan_tugas && (
                    <span className="px-1.5 py-0.5 bg-[#EEF3FA] rounded text-[10px] text-[#476788]">
                      {task.alasan_tugas.replace("_", " ")}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {task.priority && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${PRIORITY_STYLES[task.priority] ?? ""}`}
                  >
                    {task.priority}
                  </span>
                )}
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    task.status === "aktif"
                      ? "bg-blue-50 text-[#1e40af] border border-blue-200"
                      : "bg-green-50 text-[#10B981] border border-green-200"
                  }`}
                >
                  {task.status === "aktif" ? "Aktif" : "Selesai"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-[12px] text-[#64748B]">
              {task.team?.name && (
                <span className="flex items-center gap-1">
                  <Icon name="group" className="!text-sm" />
                  {task.team.name}
                </span>
              )}
              {task.reports_count != null && (
                <span className="ml-auto">{task.reports_count} laporan</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

// ── Perbaikan Section ──

function PerbaikanSection({
  loading,
  error,
  priorityFilter,
  setPriorityFilter,
  sortBy,
  setSortBy,
  tugasBerjalan,
  tugasBaru,
  tugasSelesai,
  stats,
  hasAny,
  actionLoading,
  handleMulai,
  isClient,
  onProgressClick,
}: {
  loading: boolean;
  error: string;
  priorityFilter: string;
  setPriorityFilter: (f: string) => void;
  sortBy: string;
  setSortBy: (s: string) => void;
  tugasBerjalan: Laporan[];
  tugasBaru: Laporan[];
  tugasSelesai: Laporan[];
  stats: { total: number; berat: number };
  hasAny: boolean;
  actionLoading: string | null;
  handleMulai: (id: string) => Promise<void>;
  isClient: boolean;
  onProgressClick: (id: string, code: string) => void;
}) {
  if (loading) {
    return (
      <div aria-busy="true" aria-label="Memuat data tugas">
        <section className="mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 aspect-square bg-[#EEF2FF] border border-[#C7D2FE] animate-pulse"
              >
                <div className="w-8 h-8 bg-[#C7D2FE] rounded" />
                <div className="w-16 h-7 bg-[#C7D2FE] rounded mt-1" />
                <div className="w-24 h-4 bg-[#C7D2FE] rounded" />
              </div>
            ))}
          </div>
        </section>
        <section className="space-y-3 mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden animate-pulse"
            >
              <div className="flex flex-col md:flex-row">
                <div className="w-full md:w-36 h-44 md:h-auto bg-[#E8F0FA]" />
                <div className="flex-1 p-4 space-y-3">
                  <div className="w-28 h-4 bg-[#D0DAE8] rounded" />
                  <div className="w-3/4 h-5 bg-[#D0DAE8] rounded" />
                  <div className="flex gap-2">
                    <div className="w-20 h-5 bg-[#E8F0FA] rounded" />
                    <div className="w-24 h-5 bg-[#E8F0FA] rounded" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </section>
      </div>
    );
  }

  return (
    <>
      <section className="mb-6">
        <h3 className="text-[15px] font-bold text-[#0F172A] mb-3 flex items-center gap-2">
          <Icon name="bar_chart" className="!text-lg text-[#1e40af]" />
          Ringkasan Tugas Hari Ini
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: "error", label: "Rusak Berat", value: stats.berat, color: "text-[#DC2626]" },
            {
              icon: "sync",
              label: "Dalam Proses",
              value: tugasBerjalan.length,
              color: "text-[#D97706]",
            },
            {
              icon: "check_circle",
              label: "Selesai Hari Ini",
              value: tugasSelesai.length,
              color: "text-[#059669]",
            },
            {
              icon: "assignment",
              label: "Total Penugasan",
              value: stats.total,
              color: "text-[#1e40af]",
            },
          ].map((c) => (
            <div
              key={c.label}
              className="bg-gradient-to-br from-[#EEF2FF] to-white border border-[#C7D2FE] rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 aspect-square group transition-all duration-200 ease-out hover:scale-[1.03] hover:shadow-md hover:border-[#A5B4FC]"
            >
              <div className="flex items-center justify-center gap-1.5">
                <Icon
                  name={c.icon}
                  className={`${c.color} !text-2xl group-hover:scale-110 group-hover:-translate-y-0.5 transition-transform duration-200`}
                />
                <span className={`text-2xl font-bold ${c.color}`}>{c.value}</span>
              </div>
              <p className={`text-sm font-medium ${c.color} opacity-80`}>{c.label}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-4">
          <span className="font-label-md text-label-md text-[#475569] font-semibold">
            Prioritas:
          </span>
          {(["semua", "Rendah", "Sedang", "Tinggi"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setPriorityFilter(f)}
              className={`px-3 py-1 rounded-full text-label-sm font-semibold border transition-all ${
                priorityFilter === f
                  ? f === "Tinggi"
                    ? "bg-red-50 text-[#E11D48] border-red-200"
                    : f === "Sedang"
                      ? "bg-amber-50 text-[#F97316] border-amber-200"
                      : f === "Rendah"
                        ? "bg-green-50 text-[#10B981] border-green-200"
                        : "bg-primary text-white border-primary"
                  : "bg-white text-[#475569] border-gray-200 hover:bg-gray-50"
              }`}
            >
              {f === "semua" ? "Semua" : f}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm bg-red-50 border border-red-200 text-[#E11D48]">
          {error}
        </div>
      )}

      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-headline-sm text-headline-sm font-bold text-[#0F172A]">
            Tugas Aktif (Queue)
          </h3>
          <div className="flex items-center gap-2">
            <span className="font-label-sm text-label-sm text-[#475569]">Urutkan:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="font-label-sm text-label-sm text-[#0F172A] bg-white border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20 focus:border-[#1e40af]"
            >
              <option value="prioritas">Prioritas Tertinggi</option>
              <option value="deadline">Paling Mendesak</option>
              <option value="terdekat">Terdekat</option>
              <option value="waktu">Waktu Laporan</option>
            </select>
          </div>
        </div>

        {tugasBaru.length > 0 && (
          <div className="mb-6">
            <h3 className="font-label-md font-bold text-[#0F172A] mb-3 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
              Baru Ditugaskan ({tugasBaru.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {tugasBaru.map((r) => {
                const ac: ActionButton[] = [];
                if (r.status === "Ditugaskan")
                  ac.push({
                    label: "Mulai",
                    icon: "play_arrow",
                    variant: "primary",
                    onClick: () => handleMulai(r.id),
                    disabled: actionLoading === r.id,
                  });
                ac.push({
                  label: "Lihat Detail",
                  icon: "arrow_forward",
                  variant: "secondary",
                  to: "/detail-report",
                  search: { reportId: r.id },
                });
                return (
                  <ReportCard
                    key={r.id}
                    report={r}
                    options={{ showDeadline: true, isClient }}
                    actions={ac}
                  />
                );
              })}
            </div>
          </div>
        )}

        {tugasBerjalan.length > 0 && (
          <div className="mb-6">
            <h3 className="font-label-md font-bold text-[#0F172A] mb-3 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
              Sedang Dikerjakan ({tugasBerjalan.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {tugasBerjalan.map((r) => {
                const ac: ActionButton[] = [];
                if (r.status === "Sedang Diperbaiki") {
                  const hasProgress = (r.progress_updates_count ?? 0) > 0;
                  if (hasProgress) {
                    ac.push({
                      label: "Selesai",
                      icon: "check_circle",
                      variant: "primary",
                      to: "/complete-report",
                      search: { reportId: r.id },
                    });
                  } else {
                    ac.push({
                      label: "Foto Progress",
                      icon: "add_a_photo",
                      variant: "primary",
                      onClick: () => onProgressClick(r.id, r.report_code),
                    });
                  }
                }
                ac.push({
                  label: "Lihat Detail",
                  icon: "arrow_forward",
                  variant: "secondary",
                  to: "/detail-report",
                  search: { reportId: r.id },
                });
                return (
                  <ReportCard
                    key={r.id}
                    report={r}
                    options={{ showDeadline: true, isClient }}
                    actions={ac}
                  />
                );
              })}
            </div>
          </div>
        )}

        {!hasAny && (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-white border border-[#E2E8F0] rounded-xl">
            <div className="w-12 h-12 rounded-xl bg-[#F1F5F9] border border-[#E2E8F0] flex items-center justify-center mb-4">
              <Icon name="assignment" className="text-[#475569] !text-[22px]" />
            </div>
            <p className="font-body-md font-semibold text-[#0F172A] mb-1">Belum ada tugas</p>
            <p className="font-body-sm text-body-sm text-[#475569]">
              Laporan yang ditugaskan supervisor akan muncul di sini sebagai "Baru Ditugaskan".
            </p>
          </div>
        )}

        {tugasSelesai.length > 0 && (
          <div className="mb-6">
            <h3 className="font-label-md font-bold text-[#0F172A] mb-3 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
              Riwayat Selesai ({tugasSelesai.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {tugasSelesai.map((r) => {
                const ac: ActionButton[] = [
                  {
                    label: "Lihat Detail",
                    icon: "arrow_forward",
                    variant: "secondary",
                    to: "/detail-report",
                    search: { reportId: r.id },
                  },
                ];
                return (
                  <ReportCard
                    key={r.id}
                    report={r}
                    options={{ showDeadline: true, isClient }}
                    actions={ac}
                  />
                );
              })}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
