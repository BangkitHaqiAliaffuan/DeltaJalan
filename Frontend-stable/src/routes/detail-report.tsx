import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { Icon } from "@/components/jk/Icon";
import { SkeletonDetailReport } from "@/components/jk/Skeleton";
import { PageLayout } from "@/components/jk/PageLayout";
import { SafeImage } from "@/components/jk/SafeImage";
import { useBlobImage } from "@/hooks/useBlobImage";
import { API_BASE_URL, normalizeSeverityKey } from "@/lib/aiStore";
import { getToken, getCurrentUser } from "@/lib/auth";
import {
  formatDate,
  statusDotStyle,
  displayStatus,
  haversineDistance,
  formatDistance,
} from "@/lib/format";
import type { Laporan, TimelineEvent, ProgressUpdate } from "@/types/laporan";
import { ReportMap, type ReportMapPoint } from "@/components/jk/ReportMap";
import { TimelineCard } from "@/components/jk/TimelineCard";
import { ProgressTimeline } from "@/components/jk/ProgressTimeline";
import { ProgressUpdateModal } from "@/components/jk/ProgressUpdateModal";
import { BeforeAfterSlider } from "@/components/jk/BeforeAfterSlider";
import { DetectionList } from "@/components/jk/DetectionList";
import { Portal } from "@/components/jk/Portal";
import { ModalBase } from "@/components/jk/ModalBase";
import { ConfirmDialog } from "@/components/jk/ConfirmDialog";
import { formatCountdown, hitungProgress } from "@/lib/deadline";
import { sanitizeUrls, resolveImageUrl } from "@/lib/imageUrl";
function qualityLabel(status: string): string {
  const map: Record<string, string> = {
    blurry: "Kabur",
    too_dark: "Terlalu Gelap",
    too_bright: "Terlalu Terang",
    low_contrast: "Kontras Rendah",
    analysis_error: "Gagal Analisis",
  };
  return map[status] ?? status;
}
// ── TRUST SCORE [NONAKTIF] — import { TrustBadge } from "@/components/jk/TrustBadge";

export const Route = createFileRoute("/detail-report")({
  component: DetailReportPage,
  validateSearch: (search: Record<string, unknown>) => {
    const reportId = search.reportId as string | undefined;
    return { ...(reportId ? { reportId } : {}) };
  },
  head: () => ({ meta: [{ title: "Detail Laporan — DeltaJalan" }] }),
});

const SEVERITY_STYLES: Record<string, { badge: string; dot: string }> = {
  "Rusak Berat": { badge: "bg-[#E11D48] text-white", dot: "bg-white animate-pulse" },
  "Rusak Sedang": {
    badge: "bg-orange-50 text-[#F97316] border border-orange-200",
    dot: "bg-white",
  },
  "Rusak Ringan": { badge: "bg-amber-50 text-[#F59E0B] border border-amber-200", dot: "bg-white" },
  Baik: { badge: "bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7]", dot: "bg-[#2E7D32]" },
};

function getSevStyle(sev: string | undefined | null) {
  return SEVERITY_STYLES[sev ?? ""] ?? SEVERITY_STYLES.Baik;
}

// ── Derived State ──

function DetailReportPage() {
  const { reportId } = Route.useSearch();
  const navigate = useNavigate();
  const token = getToken() ?? "";
  const user = getCurrentUser();
  const userRole = user?.role ?? "petugas";
  const [backPath, setBackPath] = useState("/tugas-saya");
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);
  useEffect(() => {
    setBackPath(userRole === "supervisor" ? "/supervisor" : "/tugas-saya");
  }, [userRole]);

  const [report, setReport] = useState<Laporan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Action state
  const [priority, setPriority] = useState<"Rendah" | "Sedang" | "Tinggi">("Sedang");
  const [catatan, setCatatan] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [tolakAlasan, setTolakAlasan] = useState("");
  const [showTolak, setShowTolak] = useState(false);
  const [showApproval, setShowApproval] = useState(false);
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const [teams, setTeams] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [progressUpdates, setProgressUpdates] = useState<ProgressUpdate[]>([]);
  const uniqueDays = new Set(progressUpdates.map((u) => u.day_number).filter(Boolean)).size;
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showEstimasi, setShowEstimasi] = useState(false);
  const [estimasiHari, setEstimasiHari] = useState(7);
  const [estimasiMode, setEstimasiMode] = useState<"same-day" | "multi-day">("same-day");
  const [showMulaiConfirm, setShowMulaiConfirm] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!report || ["Selesai", "Ditolak"].includes(report.status)) return;
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, [report?.status]);

  useEffect(() => {
    if (!reportId) {
      setError("ID laporan tidak ditemukan.");
      setLoading(false);
      return;
    }
    loadReport();
    const interval = setInterval(refreshReport, 30_000);
    return () => clearInterval(interval);
  }, [reportId]);

  async function loadReport() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/reports/${reportId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Gagal memuat laporan.");
      }
      const json = await res.json();
      setReport(sanitizeUrls(json.data ?? null));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data laporan.");
    } finally {
      setLoading(false);
    }
  }

  // Refresh report data tanpa loading flash (untuk action handlers)
  async function refreshReport() {
    try {
      const res = await fetch(`${API_BASE_URL}/reports/${reportId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setReport(sanitizeUrls(json.data ?? null));
      }
    } catch {}
  }

  // Load progress updates + teams
  useEffect(() => {
    if (!reportId || !report) return;
    if (report.status === "Sedang Diperbaiki" || report.status === "Selesai") {
      fetch(`${API_BASE_URL}/reports/${reportId}/progress`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((json) => setProgressUpdates(json.data ?? []))
        .catch(() => {});
    }
  }, [report?.id, report?.status]);

  // Supervisor: auto-set status to "Ditinjau" when viewing
  useEffect(() => {
    if (!reportId || userRole !== "supervisor") return;
    if (
      !report ||
      (report.status !== "Menunggu Verifikasi" &&
        report.status !== "Menunggu Review" &&
        report.status !== "Ditinjau")
    )
      return;
    fetch(`${API_BASE_URL}/reports/${reportId}/mulai-review`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }, [report?.id, report?.status]);

  async function handleSetujui() {
    if (!report) return;
    setActionLoading(true);
    try {
      const isWargaTelegram = report.source && ["warga", "telegram"].includes(report.source);
      const endpoint = isWargaTelegram
        ? `${API_BASE_URL}/reports/${report.id}/approve-and-assign`
        : `${API_BASE_URL}/reports/${report.id}/approve`;

      const body: Record<string, unknown> = { priority };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.needs_team) {
          setShowApproval(false);
          setShowTeamPicker(true);
          if (teams.length === 0) {
            fetchTeams();
          }
          return;
        }
        setActionMsg(json.message ?? "Gagal memproses.");
        return;
      }

      await refreshReport();
      setActionMsg(json.message ?? "Laporan berhasil diproses.");
      setShowApproval(false);
      setShowTolak(false);
    } catch {
      setActionMsg("Kesalahan jaringan.");
    } finally {
      setActionLoading(false);
    }
  }

  async function fetchTeams() {
    try {
      const res = await fetch(`${API_BASE_URL}/teams`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setTeams(json.data ?? []);
    } catch {
      // silent — teams will be empty array
    }
  }

  async function handleAssignWithTeam() {
    if (!report || !selectedTeamId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/reports/${report.id}/approve-and-assign`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ priority, assigned_team_id: selectedTeamId }),
      });
      const json = await res.json();
      if (res.ok) {
        await refreshReport();
        setActionMsg(json.message ?? "Laporan berhasil diproses.");
        setShowTeamPicker(false);
      } else {
        setActionMsg(json.message ?? "Gagal memproses.");
      }
    } catch {
      setActionMsg("Kesalahan jaringan.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleConfirmAi() {
    if (!report) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/reports/${report.id}/confirm-ai`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (res.ok) {
        await refreshReport();
        setActionMsg("Laporan dikonfirmasi dan tim ditugaskan.");
      } else {
        setActionMsg(json.message ?? "Gagal mengonfirmasi.");
      }
    } catch {
      setActionMsg("Kesalahan jaringan.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleTolak() {
    if (!report || !tolakAlasan) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/reports/${report.id}/tolak`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ alasan: tolakAlasan, catatan }),
      });
      const json = await res.json();
      setActionMsg(json.message ?? (res.ok ? "Ditolak" : "Gagal"));
      if (res.ok) {
        setShowTolak(false);
        setTolakAlasan("");
        setCatatan("");
        await refreshReport();
      }
    } catch {
      setActionMsg("Gagal menolak.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReopen() {
    if (!report) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/reports/${report.id}/reopen`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const json = await res.json();
      setActionMsg(json.message ?? (res.ok ? "Laporan dibuka kembali" : "Gagal"));
      if (res.ok) await refreshReport();
    } catch {
      setActionMsg("Kesalahan jaringan.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleMulaiEksekusi() {
    if (!report) return;
    setShowEstimasi(false);
    setShowMulaiConfirm(true);
  }

  async function handleMulaiConfirm() {
    if (!report) return;
    setShowMulaiConfirm(false);
    setActionLoading(true);
    try {
      const estimasiValue = estimasiMode === "same-day" ? null : estimasiHari;
      const res = await fetch(`${API_BASE_URL}/reports/${report.id}/mulai`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ estimasi_selesai_hari: estimasiValue }),
      });
      const json = await res.json();
      setActionMsg(json.message ?? (res.ok ? "Pengerjaan dimulai" : "Gagal"));
      if (res.ok) {
        setShowEstimasi(false);
        await refreshReport();
      }
    } catch {
      setActionMsg("Kesalahan jaringan.");
    } finally {
      setActionLoading(false);
    }
  }

  function handleSelesaikan() {
    if (!report) return;
    navigate({ to: "/complete-report", search: { reportId: report.id } });
  }

  function loadProgress() {
    if (!reportId) return;
    fetch(`${API_BASE_URL}/reports/${reportId}/progress`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((json) => setProgressUpdates(json.data ?? []))
      .catch(() => {});
  }

  const mapPoints = useMemo<ReportMapPoint[]>(() => {
    if (!report?.latitude || !report?.longitude) return [];

    const photoPoints = (report.photos ?? [])
      .filter((p) => p.latitude != null && p.longitude != null)
      .map((p, i) => ({
        lat: p.latitude!,
        lng: p.longitude!,
        label: `Foto ${i + 1}`,
        imageUrl: p.image_original_url,
      }));

    if (photoPoints.length > 0) return photoPoints;

    return [{ lat: report.latitude, lng: report.longitude, label: report.road_name }];
  }, [report?.latitude, report?.longitude, JSON.stringify(report?.photos), report?.road_name]);

  const statusHistory: TimelineEvent[] = report?.status_history ?? [];

  const hasTimeline = statusHistory.length > 0;

  // ── Loading State ──

  if (loading) {
    return (
      <PageLayout back={backPath} title="Detail Laporan">
        <main
          aria-busy="true"
          aria-label="Memuat detail laporan"
          className="flex flex-col items-center justify-center min-h-[calc(100dvh-3.5rem)] px-4"
        >
          <SkeletonDetailReport />
        </main>
      </PageLayout>
    );
  }

  // ── Error State ──

  if (error || !report) {
    return (
      <PageLayout back={backPath} title="Detail Laporan">
        <main className="flex flex-col items-center justify-center gap-3 px-4 bg-[#F5F7FA]">
          <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center">
            <Icon name="error" className="!text-[28px] text-[#E11D48]" />
          </div>
          <p className="text-[14px] font-semibold text-[#0F172A]">
            {error || "Laporan tidak ditemukan."}
          </p>
          <Link
            to={backPath}
            className="px-5 py-2 bg-[#1A4F8A] text-white text-[13px] font-medium rounded-lg hover:bg-[#153d6e] transition-colors"
          >
            Kembali
          </Link>
        </main>
      </PageLayout>
    );
  }

  // ── Footer (role‑aware) ──

  function renderFooter() {
    const status = report?.status ?? "";
    const isSupervisor = userRole === "supervisor";
    const isEksekusi = userRole === "petugas";

    const showBack = (centered?: boolean) => (
      <Link
        to={backPath}
        className={`${centered ? "w-[70%] flex bg-[#1A4F8A] text-white shadow-sm hover:bg-[#153d6e]" : "w-full flex bg-[#F8FAFC] border border-[#CBD5E1] text-[#475569] hover:bg-[#F1F5F9] hover:border-[#94A3B8]"} py-2 md:py-2.5 min-h-[36px] rounded-xl text-[12px] font-semibold items-center justify-center gap-1.5 active:scale-95 transition-all`}
      >
        <Icon name="arrow_back" className="!text-[16px]" />
        Kembali
      </Link>
    );

    // Supervisor: Menunggu Verifikasi / Menunggu Review / Ditinjau → Setujui + Tolak
    if (
      isSupervisor &&
      (status === "Menunggu Verifikasi" || status === "Menunggu Review" || status === "Ditinjau")
    ) {
      return (
        <FooterWrapper>
          {actionMsg && (
            <div className="px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-[12px] text-[#0F172A] text-center">
              {actionMsg}
            </div>
          )}
          <button
            type="button"
            disabled={actionLoading}
            onClick={() => setShowApproval(true)}
            className="w-full py-2.5 md:py-3 min-h-[40px] bg-[#1A4F8A] text-white rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 hover:bg-[#153d6e] active:scale-[0.98] transition-all disabled:opacity-50 shadow-sm"
          >
            {actionLoading ? (
              "Memproses…"
            ) : (
              <>
                <Icon name="check" className="!text-[20px]" />
                Setujui & Tugaskan Tim
              </>
            )}
          </button>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => setShowTolak(true)}
              className="flex-1 py-2 md:py-2.5 min-h-[36px] bg-[#FFF5F5] border border-[#FECACA] text-[#DC2626] rounded-xl text-[12px] font-semibold flex items-center justify-center gap-1.5 hover:bg-[#FEF2F2] hover:border-[#F87171] active:scale-95 transition-all disabled:opacity-50"
            >
              <Icon name="close" className="!text-[16px]" />
              Tolak
            </button>
            <Link
              to={backPath}
              className="flex-1 flex py-2 md:py-2.5 min-h-[36px] rounded-xl text-[12px] font-semibold items-center justify-center gap-1.5 bg-[#F8FAFC] border border-[#CBD5E1] text-[#475569] hover:bg-[#F1F5F9] hover:border-[#94A3B8] active:scale-95 transition-all"
            >
              <Icon name="arrow_back" className="!text-[16px]" />
              Kembali
            </Link>
          </div>
        </FooterWrapper>
      );
    }

    // Supervisor: Hasil AI → Konfirmasi & Tugaskan Tim
    if (isSupervisor && status === "Hasil AI") {
      return (
        <FooterWrapper>
          {actionMsg && (
            <div className="px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-[12px] text-[#0F172A] text-center">
              {actionMsg}
            </div>
          )}
          <button
            type="button"
            disabled={actionLoading}
            onClick={handleConfirmAi}
            className="w-full py-2.5 md:py-3 min-h-[40px] bg-[#1A4F8A] text-white rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 hover:bg-[#153d6e] active:scale-[0.98] transition-all disabled:opacity-50 shadow-sm"
          >
            {actionLoading ? (
              "Memproses…"
            ) : (
              <>
                <Icon name="check" className="!text-[20px]" />
                Konfirmasi & Tugaskan Tim
              </>
            )}
          </button>
          <div className="flex gap-3">{showBack()}</div>
        </FooterWrapper>
      );
    }

    // Supervisor: Disetujui → legacy (approve langsung Ditugaskan)
    if (isSupervisor && status === "Disetujui") {
      return (
        <FooterWrapper>
          <p className="text-[12px] text-[#64748B] text-center py-1">
            Tim pelapor telah ditugaskan. Menunggu tim memulai pengerjaan.
          </p>
          {showBack()}
        </FooterWrapper>
      );
    }

    // Supervisor: Ditugaskan — lihat progress
    if (isSupervisor && status === "Ditugaskan") {
      return (
        <FooterWrapper>
          <p className="text-[12px] text-[#64748B] text-center py-1">
            Menunggu tim satgas memulai pengerjaan
          </p>
          {showBack()}
        </FooterWrapper>
      );
    }

    // Supervisor: Selesai
    if (isSupervisor && status === "Selesai") {
      return (
        <FooterWrapper>
          {actionMsg && (
            <div className="px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-[12px] text-[#0F172A] text-center">
              {actionMsg}
            </div>
          )}
          {showBack()}
        </FooterWrapper>
      );
    }

    // Petugas: Ditugaskan → Mulai Pengerjaan
    if (isEksekusi && status === "Ditugaskan") {
      return (
        <FooterWrapper>
          {actionMsg && (
            <div className="px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-[12px] text-[#0F172A] text-center">
              {actionMsg}
            </div>
          )}
          <button
            type="button"
            disabled={actionLoading}
            onClick={() => {
              const isRingan = report?.overall_severity === "Rusak Ringan";
              setEstimasiMode(isRingan ? "same-day" : "multi-day");
              setEstimasiHari(isRingan ? 1 : 7);
              setShowEstimasi(true);
            }}
            className="w-full py-2.5 md:py-3 min-h-[40px] bg-[#1A4F8A] text-white rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 hover:bg-[#153d6e] active:scale-[0.98] transition-all disabled:opacity-50 shadow-sm"
          >
            {actionLoading ? (
              "Memproses…"
            ) : (
              <>
                <Icon name="play_arrow" className="!text-[20px]" />
                Mulai Pengerjaan
              </>
            )}
          </button>
          {showBack()}
        </FooterWrapper>
      );
    }

    // Petugas: Sedang Diperbaiki → Upload Progress + Selesaikan
    if (isEksekusi && status === "Sedang Diperbaiki") {
      return (
        <FooterWrapper>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowProgressModal(true)}
              className="flex-1 py-2.5 md:py-3 min-h-[40px] bg-white border border-[#1A4F8A] text-[#1A4F8A] rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 hover:bg-[#F8FAFC] active:scale-[0.98] transition-all"
            >
              <Icon name="add_a_photo" className="!text-[20px]" />
              Progress
            </button>
            <button
              type="button"
              disabled={progressUpdates.length === 0}
              onClick={handleSelesaikan}
              className="flex-1 py-2.5 md:py-3 min-h-[40px] bg-[#1A4F8A] text-white rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 hover:bg-[#153d6e] active:scale-[0.98] transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#1A4F8A]"
            >
              <Icon name="check_circle" className="!text-[20px]" />
              Selesaikan
            </button>
          </div>
          {showBack()}
        </FooterWrapper>
      );
    }

    // Default: Kembali
    return (
      <FooterWrapper>
        {actionMsg && (
          <div className="px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-[12px] text-[#0F172A] text-center">
            {actionMsg}
          </div>
        )}
        <div className="flex justify-center">{showBack(true)}</div>
      </FooterWrapper>
    );
  }

  // ── Content ──

  return (
    <>
      <PageLayout
        back={backPath}
        title="Detail Laporan"
        right={
          <span className="font-id-code text-[12px] text-[#64748B]">{report.report_code}</span>
        }
        onRefresh={refreshReport}
      >
        <main>
          <div className="max-w-2xl mx-auto p-4 pb-[140px] flex flex-col gap-4">
            {/* ── Foto & Analisis AI per foto ── */}
            {report.photos && report.photos.length > 0 ? (
              report.photos.map((photo, i) => (
                <div
                  key={photo.id}
                  className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden"
                >
                  {photo.image_original_url &&
                  photo.image_result_url &&
                  photo.image_result_url !== photo.image_original_url ? (
                    <BeforeAfterSlider
                      beforeSrc={resolveImageUrl(photo.image_original_url) ?? ""}
                      afterSrc={resolveImageUrl(photo.image_result_url) ?? ""}
                      beforeLabel={`Foto ${i + 1} — Asli`}
                      afterLabel={`Foto ${i + 1} — AI`}
                      panjang={photo.kerusakan_panjang}
                      lebar={photo.kerusakan_lebar}
                    />
                  ) : photo.image_original_url ? (
                    <div
                      className="bg-[#0F172A] flex items-center justify-center"
                      style={{ minHeight: 280 }}
                    >
                      <SafeImage
                        src={resolveImageUrl(photo.image_original_url) ?? ""}
                        alt={`Foto ${i + 1}`}
                        className="w-full h-full object-contain max-h-[55vh]"
                      />
                    </div>
                  ) : null}
                  {photo.photo_taken_at && (
                    <div className="px-3 py-2 border-t border-[#E2E8F0] flex items-center gap-1.5 text-[11px] text-[#64748B]">
                      <Icon name="calendar_today" className="!text-[13px]" />
                      <span>
                        Photo diambil pada{" "}
                        {new Date(photo.photo_taken_at).toLocaleDateString("id-ID", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  )}
                  {photo.mobileclip_score != null && (
                    <div className="px-3 py-2 border-t border-[#E2E8F0] flex items-center gap-1.5 text-[11px]">
                      <Icon
                        name={photo.mobileclip_score >= 0.15 ? "check_circle" : "warning"}
                        className={`!text-[13px] ${photo.mobileclip_score >= 0.15 ? "text-[#16A34A]" : "text-[#F59E0B]"}`}
                      />
                      <span
                        className={
                          photo.mobileclip_score >= 0.15 ? "text-[#16A34A]" : "text-[#F59E0B]"
                        }
                      >
                        AI: {photo.mobileclip_label} ({(photo.mobileclip_score * 100).toFixed(0)}%)
                      </span>
                    </div>
                  )}
                  {photo.quality_scores?.status && photo.quality_scores.status !== "good" && (
                    <div className="px-3 py-2 border-t border-[#E2E8F0] flex items-center gap-1.5 text-[11px]">
                      <Icon
                        name={
                          photo.quality_scores.status === "blurry" ||
                          photo.quality_scores.status === "too_dark"
                            ? "visibility_off"
                            : "warning"
                        }
                        className="!text-[13px] text-[#F59E0B]"
                      />
                      <span className="text-[#F59E0B]">
                        Kualitas foto: {qualityLabel(photo.quality_scores.status)} (ketajaman:{" "}
                        {photo.quality_scores.blurScore.toFixed(0)}, kecerahan:{" "}
                        {photo.quality_scores.meanBrightness.toFixed(0)})
                      </span>
                    </div>
                  )}
                  {(() => {
                    const rawDetections = Array.isArray(photo.ai_raw_output)
                      ? photo.ai_raw_output
                      : (photo.ai_raw_output?.detections ?? []);
                    const hasDetectionData =
                      rawDetections.length > 0 ||
                      photo.ai_jenis_kerusakan ||
                      photo.ai_severity ||
                      photo.ai_confidence != null ||
                      photo.total_detections != null;
                    if (!hasDetectionData) return null;
                    return (
                      <div className="border-t border-[#E2E8F0]">
                        <DetectionList
                          detections={rawDetections}
                          totalDetections={photo.total_detections}
                          overallConfidence={photo.ai_confidence}
                          kerusakanPanjang={photo.kerusakan_panjang}
                          kerusakanLebar={photo.kerusakan_lebar}
                        />
                      </div>
                    );
                  })()}
                </div>
              ))
            ) : report.image_original_url ? (
              <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
                {report.image_result_url &&
                report.image_result_url !== report.image_original_url ? (
                  <BeforeAfterSlider
                    beforeSrc={resolveImageUrl(report.image_original_url) ?? ""}
                    afterSrc={resolveImageUrl(report.image_result_url) ?? ""}
                    beforeLabel="Foto Asli"
                    afterLabel="Hasil AI"
                    panjang={report.kerusakan_panjang}
                    lebar={report.kerusakan_lebar}
                  />
                ) : (
                  <div
                    className="bg-[#0F172A] flex items-center justify-center"
                    style={{ minHeight: 280 }}
                  >
                    <SafeImage
                      src={resolveImageUrl(report.image_original_url) ?? ""}
                      alt="Foto"
                      className="w-full h-full object-contain max-h-[55vh]"
                    />
                  </div>
                )}
              </div>
            ) : null}

            {/* ── Progress Bar (estimasi_hari > 0) ── */}
            {report.estimasi_hari != null && report.estimasi_hari > 0 && (
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-label-md text-[13px] font-bold text-[#0F172A] flex items-center gap-1.5">
                    <Icon name="progress_activity" className="!text-lg text-[#1A4F8A]" />
                    Progress Perbaikan
                  </h3>
                  <span className="text-[12px] font-semibold text-[#1A4F8A]">
                    Hari {Math.min(uniqueDays, report.estimasi_hari)} dari {report.estimasi_hari}
                  </span>
                </div>
                <div className="w-full h-2 bg-[#E2E8F0] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#1A4F8A] rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min((uniqueDays / report.estimasi_hari) * 100, 100)}%`,
                    }}
                  />
                </div>
                {uniqueDays >= report.estimasi_hari && (
                  <p className="text-[11px] text-[#10B981] font-medium mt-1.5 flex items-center gap-1">
                    <Icon name="check_circle" className="!text-[14px]" />
                    Estimasi terpenuhi, silakan selesaikan laporan
                  </p>
                )}
              </div>
            )}

            {/* ── Progress Timeline ── */}
            {progressUpdates.length > 0 && (
              <ProgressTimeline updates={progressUpdates} estimasiHari={report.estimasi_hari} />
            )}

            {/* ── After Photo Gallery ── */}
            <AfterPhotoGallery report={report} />

            {/* ── Badges ── */}
            <div className="flex flex-wrap items-center gap-2">
              {(() => {
                const sev = report.overall_severity ?? report.ai_severity;
                if (!sev) return null;
                const s = getSevStyle(normalizeSeverityKey(sev));
                return (
                  <span
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${s.badge}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                    {normalizeSeverityKey(sev)}
                  </span>
                );
              })()}
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-white border border-[#E2E8F0] text-[#475569]">
                <span className={`w-2 h-2 rounded-full ${statusDotStyle(report.status ?? "")}`} />
                {displayStatus(report.status ?? "-")}
              </span>
              {report.source === "warga" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-50 text-[#7C3AED] border border-purple-200 whitespace-nowrap">
                  Warga
                </span>
              )}
              {report.source === "telegram" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-sky-50 text-[#0284C7] border border-sky-200 whitespace-nowrap">
                  Telegram
                </span>
              )}
              <DeadlineCard report={report} isClient={isClient} now={now} compact />
            </div>

            {/* ── Info Jalan ── */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
              <h2 className="font-headline-sm text-[17px] font-bold text-[#0F172A] mb-3">
                {report.road_name}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                <InfoRow icon="location_on" value={`Kec. ${report.district}`} />
                {report.assigned_team_name && (
                  <InfoRow icon="group" value={`Tim: ${report.assigned_team_name}`} />
                )}
                {report.kerusakan_panjang != null && (
                  <InfoRow
                    icon="straighten"
                    value={
                      report.kerusakan_lebar != null
                        ? `${report.kerusakan_panjang}m × ${report.kerusakan_lebar}m (${(report.kerusakan_panjang * report.kerusakan_lebar).toFixed(1)} m²)`
                        : `${report.kerusakan_panjang}m`
                    }
                  />
                )}
                <InfoRow
                  icon="calendar_month"
                  value={report.created_at ? formatDate(report.created_at) : "-"}
                />
                <InfoRow icon="person" value={report.reporter_name} />
                {report.report_code && <InfoRow icon="tag" value={report.report_code} />}
              </div>
              {report.description && (
                <div className="mt-3 pt-3 border-t border-[#E2E8F0]">
                  <p className="text-[11px] font-semibold text-[#475569] mb-1 flex items-center gap-1">
                    <Icon name="description" className="!text-[14px]" />
                    Deskripsi Laporan
                  </p>
                  <p className="text-[13px] text-[#0F172A] leading-relaxed whitespace-pre-wrap">
                    {report.description}
                  </p>
                </div>
              )}
            </div>

            {/* ── Timeline Perbaikan ── */}
            {hasTimeline && <TimelineCard events={statusHistory} />}

            {/* ── Lokasi ── */}
            {mapPoints.length > 0 && (
              <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
                <div className="p-4 pb-2">
                  <h3 className="font-label-md text-[13px] font-bold text-[#0F172A]">Lokasi</h3>
                  {report.latitude && report.longitude && (
                    <p className="text-[11px] text-[#64748B] mt-0.5 font-mono">
                      {report.latitude.toFixed(6)}, {report.longitude.toFixed(6)}
                    </p>
                  )}
                  {report.full_address && (
                    <p className="text-[12px] text-[#475569] mt-1 flex items-start gap-1">
                      <Icon name="map" className="!text-[14px] mt-0.5 shrink-0" />
                      <span>{report.full_address}</span>
                    </p>
                  )}
                </div>
                <div className="h-48 overflow-hidden" style={{ isolation: "isolate" }}>
                  <ReportMap
                    points={mapPoints}
                    onPointClick={(pt) => {
                      if (userRole === "supervisor") {
                        const url = `https://www.google.com/maps?q=${pt.lat},${pt.lng}`;
                        window.open(url, "_blank", "noopener,noreferrer");
                      } else {
                        navigate({
                          to: "/map",
                          search: { highlight: report.id, lat: pt.lat, lng: pt.lng },
                        });
                      }
                    }}
                  />
                </div>
              </div>
            )}

            {/* ── Duplikasi ── */}
            {report.duplicate_of && (
              <div className="bg-white border border-[#FDE68A] rounded-xl overflow-hidden">
                <div className="flex items-start gap-3 p-4">
                  <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                    <span className="text-[18px]">⚠️</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[13px] font-bold text-[#92400E] mb-1">
                      Terindikasi Duplikat
                    </h3>
                    <p className="text-[12px] text-[#92400E]/80 mb-2">
                      Laporan ini memiliki kemiripan dengan laporan{" "}
                      <strong>{report.duplicate_of.report_code}</strong> (
                      {report.duplicate_of.road_name}, {report.duplicate_of.district}).
                    </p>
                    {report.latitude != null &&
                      report.longitude != null &&
                      report.duplicate_of.latitude != null &&
                      report.duplicate_of.longitude != null && (
                        <p className="text-[12px] text-[#92400E]/80 mb-2">
                          Jarak:{" "}
                          {formatDistance(
                            haversineDistance(
                              report.latitude,
                              report.longitude,
                              report.duplicate_of.latitude,
                              report.duplicate_of.longitude,
                            ),
                          )}{" "}
                          dari laporan tersebut
                        </p>
                      )}
                    <div className="flex items-center gap-2">
                      {report.duplicate_of.latitude && report.duplicate_of.longitude && (
                        <button
                          type="button"
                          onClick={() => {
                            navigate({
                              to: "/map",
                              search: {
                                highlight: report.duplicate_of!.id,
                                lat: report.duplicate_of!.latitude!,
                                lng: report.duplicate_of!.longitude!,
                              },
                            });
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-[11px] font-semibold text-[#92400E] hover:bg-amber-100 transition-colors"
                        >
                          Lihat di Peta
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>

        {renderFooter()}

        {/* ── Tolak Modal ── */}
        {showTolak && (
          <ModalBase
            onClose={() => setShowTolak(false)}
            icon="block"
            badge="TOLAK LAPORAN"
            title="Tolak Laporan"
            footer={
              <>
                <button
                  type="button"
                  disabled={actionLoading || !tolakAlasan.trim()}
                  onClick={handleTolak}
                  className="w-full h-11 bg-[#E11D48] text-white rounded-lg text-[14px] font-semibold flex items-center justify-center gap-2 hover:bg-[#BE123C] active:scale-95 transition-all disabled:opacity-50"
                >
                  {actionLoading ? (
                    "Memproses…"
                  ) : (
                    <>
                      <Icon name="close" className="!text-[18px]" />
                      Tolak Laporan
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowTolak(false)}
                  className="w-full h-10 text-[13px] text-[#64748B] font-medium hover:text-[#0F172A] transition-colors"
                >
                  Batal
                </button>
              </>
            }
          >
            <div>
              <label className="text-[12px] font-semibold text-[#0F172A] mb-1 block">
                Alasan Penolakan <span className="text-[#E11D48]">*</span>
              </label>
              <textarea
                value={tolakAlasan}
                onChange={(e) => setTolakAlasan(e.target.value)}
                className="w-full h-24 px-3 py-2 rounded-lg border border-[#D0DAE8] resize-none text-[13px] text-[#0F172A] placeholder-[#94A3B8] outline-none focus:ring-2 focus:ring-[#1A4F8A]/20 focus:border-[#1A4F8A]"
                placeholder="Jelaskan alasan mengapa laporan ini ditolak…"
              />
            </div>
            <div>
              <label className="text-[12px] font-semibold text-[#0F172A] mb-1 block">
                Catatan (opsional)
              </label>
              <input
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#D0DAE8] text-[13px] text-[#0F172A] placeholder-[#94A3B8] outline-none focus:ring-2 focus:ring-[#1A4F8A]/20 focus:border-[#1A4F8A]"
                placeholder="Catatan tambahan…"
              />
            </div>
          </ModalBase>
        )}

        {/* ── Approve Modal ── */}
        {showApproval && (
          <ModalBase
            onClose={() => setShowApproval(false)}
            icon="check_circle"
            badge="SETUJUI & TUGASKAN"
            title="Setujui & Tugaskan Tim"
            footer={
              <>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleSetujui}
                  className="w-full h-11 bg-[#1A4F8A] text-white rounded-lg text-[14px] font-semibold flex items-center justify-center gap-2 hover:bg-[#153d6e] active:scale-95 transition-all disabled:opacity-50"
                >
                  {actionLoading ? (
                    "Memproses…"
                  ) : (
                    <>
                      <Icon name="check" className="!text-[18px]" />
                      Setujui & Tugaskan
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowApproval(false)}
                  className="w-full h-10 text-[13px] text-[#64748B] font-medium hover:text-[#0F172A] transition-colors"
                >
                  Batal
                </button>
              </>
            }
          >
            <div className="space-y-4">
              <p className="text-[13px] text-[#475569] leading-relaxed">
                Laporan akan disetujui, dianalisis AI, dan secara otomatis ditugaskan ke tim satgas
                yang sesuai.
              </p>
              <div>
                <label className="text-[12px] font-semibold text-[#0F172A] mb-1 block">
                  Prioritas
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as "Rendah" | "Sedang" | "Tinggi")}
                  className="w-full h-10 px-3 rounded-lg border border-[#D0DAE8] text-[13px] text-[#0F172A] outline-none focus:ring-2 focus:ring-[#1A4F8A]/20 focus:border-[#1A4F8A]"
                >
                  <option value="Rendah">Rendah</option>
                  <option value="Sedang">Sedang</option>
                  <option value="Tinggi">Tinggi</option>
                </select>
              </div>
            </div>
          </ModalBase>
        )}

        {/* ── Estimasi Modal (mulai perbaikan) ── */}
        {showEstimasi && report && (
          <ModalBase
            onClose={() => setShowEstimasi(false)}
            icon="play_arrow"
            badge="MULAI PENGERJAAN"
            title="Estimasi Waktu Penyelesaian"
            footer={
              <>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleMulaiEksekusi}
                  className="w-full h-11 bg-[#1A4F8A] text-white rounded-lg text-[14px] font-semibold flex items-center justify-center gap-2 hover:bg-[#153d6e] active:scale-95 transition-all disabled:opacity-50"
                >
                  {actionLoading ? (
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
                  onClick={() => setShowEstimasi(false)}
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
                        if (raw === "") {
                          setEstimasiHari(1);
                          return;
                        }
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

        {/* ── Confirm Mulai Modal ── */}
        <ConfirmDialog
          open={showMulaiConfirm}
          title="Mulai Pengerjaan?"
          message={
            report
              ? `Mulai perbaikan ${report.report_code} — ${report.road_name}?${
                  estimasiMode === "same-day"
                    ? "\nEstimasi: Selesai hari ini"
                    : `\nEstimasi: ${estimasiHari} hari`
                }`
              : ""
          }
          confirmText="Ya, Mulai"
          cancelText="Batal"
          confirmLoading={actionLoading}
          onConfirm={handleMulaiConfirm}
          onCancel={() => {
            setShowMulaiConfirm(false);
            setShowEstimasi(true);
          }}
          icon="play_arrow"
          confirmClassName="flex-1 px-4 py-2.5 text-[13px] font-bold text-white bg-[#1A4F8A] rounded-xl hover:bg-[#153d6e] disabled:opacity-40 transition-all flex items-center justify-center gap-1.5"
        />

        {/* ── Progress Update Modal ── */}
        {showProgressModal && report && (
          <ProgressUpdateModal
            reportId={report.id}
            reportCode={report.report_code}
            token={token}
            onClose={() => {
              setShowProgressModal(false);
              loadProgress();
            }}
            onSuccess={() => {
              loadProgress();
              setActionMsg("Progress berhasil diupload.");
            }}
          />
        )}
      </PageLayout>

      {/* ── Team Picker Modal ── */}
      {showTeamPicker && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="px-5 pt-5 pb-2">
                <div className="w-11 h-11 rounded-full bg-[#EFF6FF] flex items-center justify-center mb-3">
                  <Icon name="group" className="!text-[22px] text-[#1A4F8A]" />
                </div>
                <h2 className="text-[16px] font-bold text-[#0F172A] mb-1">Pilih Tim Satgas</h2>
                <p className="text-[13px] text-[#475569] leading-relaxed mb-4">
                  Kecamatan ini belum memiliki tim satgas otomatis. Silakan pilih tim secara manual.
                </p>
              </div>
              <div className="px-5 pb-2">
                <select
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="w-full h-11 px-3 rounded-lg border border-[#D0DAE8] text-[13px] text-[#0F172A] outline-none focus:ring-2 focus:ring-[#1A4F8A]/20 focus:border-[#1A4F8A]"
                >
                  <option value="">Pilih tim…</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="px-5 pb-5 pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={actionLoading || !selectedTeamId}
                  onClick={handleAssignWithTeam}
                  className="w-full h-11 bg-[#1A4F8A] text-white rounded-lg text-[14px] font-semibold flex items-center justify-center gap-2 hover:bg-[#153d6e] active:scale-95 transition-all disabled:opacity-50"
                >
                  {actionLoading ? (
                    "Memproses…"
                  ) : (
                    <>
                      <Icon name="check" className="!text-[18px]" />
                      Tugaskan ke Tim Ini
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowTeamPicker(false)}
                  className="w-full h-10 text-[13px] text-[#64748B] font-medium hover:text-[#0F172A] transition-colors"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}

// ── Sub-components ──

function FooterWrapper({ children }: { children: React.ReactNode }) {
  return (
    <footer className="fixed bottom-0 left-0 right-0 md:left-64 z-30 bg-white border-t border-[#E2E8F0] shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
      <div className="px-4 md:px-6 py-3 md:py-4 flex flex-col gap-2 md:gap-3">{children}</div>
    </footer>
  );
}

function DeadlineCard({
  report,
  isClient,
  now,
  compact,
}: {
  report: Laporan;
  isClient: boolean;
  now: number;
  compact?: boolean;
}) {
  const status = report.status ?? "";

  function pilihDeadline(): { deadline: string; label: string; icon: string } | null {
    if (["Menunggu Review", "Ditinjau"].includes(status) && report.deadline_review) {
      return { deadline: report.deadline_review, label: "Deadline Review", icon: "rate_review" };
    }
    if (status === "Sedang Diperbaiki" && report.deadline_resolusi) {
      return { deadline: report.deadline_resolusi, label: "Deadline Resolusi", icon: "build" };
    }
    if (["Selesai", "Ditolak"].includes(status)) {
      const last = report.deadline_resolusi || report.deadline_review;
      if (last) return { deadline: last, label: "Deadline", icon: "check_circle" };
      return null;
    }
    return null;
  }

  const info = pilihDeadline();
  if (!info) return null;

  const deadlineDate = new Date(info.deadline);
  const sisaMs = deadlineDate.getTime() - now;
  const isSelesai = ["Selesai", "Ditolak"].includes(status);

  function getStartTime(): string {
    if (status === "Sedang Diperbaiki") return report.perbaikan_dimulai_at || report.created_at;
    if (["Disetujui", "Ditugaskan"].includes(status))
      return report.assigned_at || report.created_at;
    return report.created_at;
  }

  const startTime = getStartTime();

  const terlambatFlag =
    (status === "Sedang Diperbaiki" && report.terlambat_resolusi) ||
    (["Menunggu Review", "Ditinjau"].includes(status) && report.terlambat_review);

  let deadlineStatus: "tepat_waktu" | "mendekati" | "terlambat" | "selesai" = "tepat_waktu";
  if (isSelesai) {
    deadlineStatus = "selesai";
  } else if (terlambatFlag || sisaMs < 0) {
    deadlineStatus = "terlambat";
  } else if (isClient) {
    const startMs = new Date(startTime).getTime();
    const totalMs = deadlineDate.getTime() - startMs || 1;
    const warningWindow = Math.max(8, totalMs * 0.25);
    if (sisaMs < warningWindow && sisaMs > 0) {
      deadlineStatus = "mendekati";
    }
  }

  const colorMap = {
    tepat_waktu: {
      dot: "bg-[#10B981]",
      text: "text-[#10B981]",
      bg: "bg-emerald-50 border-emerald-200",
      hex: "#10B981",
      label: "Tepat Waktu",
    },
    mendekati: {
      dot: "bg-[#F59E0B]",
      text: "text-[#F59E0B]",
      bg: "bg-amber-50 border-amber-200",
      hex: "#F59E0B",
      label: "Mendekati",
    },
    terlambat: {
      dot: "bg-[#E11D48]",
      text: "text-[#E11D48]",
      bg: "bg-red-50 border-red-200",
      hex: "#E11D48",
      label: "Terlewat",
    },
    selesai: {
      dot: "bg-[#64748B]",
      text: "text-[#64748B]",
      bg: "bg-slate-50 border-slate-200",
      hex: "#64748B",
      label: "Selesai",
    },
  };
  const colors = colorMap[deadlineStatus];

  const { persen } = hitungProgress(info.deadline, startTime, now);

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold bg-white border border-[#E2E8F0]">
        <Icon name={info.icon} className="!text-[14px] text-[#64748B]" />
        <span className="text-[#475569]">{info.label}:</span>
        <span className={`font-bold ${colors.text}`}>
          {isClient ? formatCountdown(sisaMs) : "Memuat..."}
        </span>
        <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
        <span className={colors.text}>{colors.label}</span>
      </span>
    );
  }

  function formatHariTanggal(iso: string): string {
    const d = new Date(iso);
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
    const dayName = days[d.getDay()];
    const date = d.getDate();
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const hour = d.getHours().toString().padStart(2, "0");
    const min = d.getMinutes().toString().padStart(2, "0");
    return `${dayName}, ${date} ${month} ${year} pukul ${hour}:${min} WIB`;
  }

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon name="timer" className="!text-[18px] text-[#64748B]" />
          <h3 className="font-label-md text-[13px] font-bold text-[#0F172A]">Batas Waktu</h3>
        </div>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
          {colors.label}
        </span>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <Icon name={info.icon} className="!text-[16px] text-[#64748B]" />
        <span className="text-[12px] font-semibold text-[#0F172A]">{info.label}</span>
      </div>

      <p className="text-[13px] text-[#0F172A] mb-3">{formatHariTanggal(info.deadline)}</p>

      {!isSelesai && (
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 h-2 bg-[#E2E8F0] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${persen}%`, backgroundColor: colors.hex }}
            />
          </div>
          <span className={`text-[11px] font-semibold ${colors.text}`}>{Math.round(persen)}%</span>
        </div>
      )}

      <div className="border-t border-[#E2E8F0] pt-3">
        {isSelesai ? (
          <div>
            <span className="text-[12px] text-[#64748B]">Tidak ada tenggat aktif</span>
            {status === "Ditolak" && (
              <div className="flex items-center gap-1 mt-2 text-[11px] text-[#94A3B8]">
                <Icon name="info" className="!text-[12px] shrink-0" />
                <span>Dihapus otomatis 3 hari setelah ditolak</span>
              </div>
            )}
          </div>
        ) : !isClient ? (
          <span className="text-[12px] text-[#64748B]">Memuat...</span>
        ) : (
          <span className={`text-[15px] font-bold ${colors.text}`}>{formatCountdown(sisaMs)}</span>
        )}
      </div>
    </div>
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

function AfterPhotoGallery({ report }: { report: Laporan }) {
  const photos =
    (report.after_photos ?? []).length > 0
      ? report.after_photos!
      : report.after_photo_url
        ? [{ id: 0, url: report.after_photo_url, sort_order: 0 }]
        : [];

  if (photos.length === 0) return null;

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selectedUrl = selectedIndex != null ? photos[selectedIndex]?.url : undefined;
  const blobSelectedUrl = useBlobImage(selectedUrl);

  const prev = () => setSelectedIndex((i) => (i != null && i > 0 ? i - 1 : i));
  const next = () => setSelectedIndex((i) => (i != null && i < photos.length - 1 ? i + 1 : i));

  return (
    <>
      <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
        <div className="p-3 border-b border-[#E2E8F0]">
          <h3 className="font-label-md text-[13px] font-bold text-on-surface">
            Foto Setelah Perbaikan
          </h3>
          {report.after_photo_notes && (
            <p className="text-[12px] text-[#475569] mt-0.5">{report.after_photo_notes}</p>
          )}
        </div>
        <div className="p-3">
          <div className="flex flex-wrap gap-2.5">
            {photos.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedIndex(i)}
                className="w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden border border-[#E2E8F0] hover:border-[#1A4F8A] hover:ring-2 hover:ring-[#1A4F8A]/20 transition-all shrink-0"
              >
                <SafeImage
                  src={p.url}
                  alt={`Foto setelah perbaikan ${i + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      {selectedIndex != null && (
        <Portal>
          <style>{`
            @keyframes gallery-fade {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            .gallery-fade { animation: gallery-fade 0.2s ease-out; }
          `}</style>
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm gallery-fade"
            onClick={() => setSelectedIndex(null)}
          >
            <button
              type="button"
              onClick={() => setSelectedIndex(null)}
              className="absolute top-4 right-4 w-10 h-10 bg-black/40 text-white rounded-full flex items-center justify-center hover:bg-black/60 transition-all z-10"
            >
              <Icon name="close" className="!text-[24px]" />
            </button>

            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    prev();
                  }}
                  disabled={selectedIndex === 0}
                  className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/40 text-white rounded-full flex items-center justify-center hover:bg-black/60 transition-all disabled:opacity-20 z-10"
                >
                  <Icon name="chevron_left" className="!text-[28px]" />
                </button>
                <span className="absolute top-4 left-4 px-3 py-1 bg-black/40 text-white text-[13px] font-semibold rounded-full z-10">
                  {selectedIndex + 1} / {photos.length}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    next();
                  }}
                  disabled={selectedIndex === photos.length - 1}
                  className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/40 text-white rounded-full flex items-center justify-center hover:bg-black/60 transition-all disabled:opacity-20 z-10"
                >
                  <Icon name="chevron_right" className="!text-[28px]" />
                </button>
              </>
            )}

            <img
              src={blobSelectedUrl ?? selectedUrl}
              alt={`Foto setelah perbaikan ${selectedIndex + 1}`}
              className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg select-none"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </Portal>
      )}
    </>
  );
}
