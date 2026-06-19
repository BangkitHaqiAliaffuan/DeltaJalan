import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Icon } from "@/components/jk/Icon";
import { SkeletonDetailReport } from "@/components/jk/Skeleton";
import { PageLayout } from "@/components/jk/PageLayout";
import { API_BASE_URL, normalizeSeverityKey } from "@/lib/aiStore";
import { getToken, getCurrentUser } from "@/lib/auth";
import { formatDate, statusDotStyle, displayStatus } from "@/lib/format";
import type { Laporan, TimelineEvent, TrustLabel } from "@/types/laporan";
import { ReportMap, type ReportMapPoint } from "@/components/jk/ReportMap";
import { TimelineCard } from "@/components/jk/TimelineCard";
import { BeforeAfterSlider } from "@/components/jk/BeforeAfterSlider";
import { SafeImage } from "@/components/jk/SafeImage";
import { Portal } from "@/components/jk/Portal";
import { TrustBadge } from "@/components/jk/TrustBadge";

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
  "Rusak Sedang": { badge: "bg-orange-50 text-[#F97316] border border-orange-200", dot: "bg-white" },
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
  const [backPath, setBackPath] = useState("/my-reports");
  useEffect(() => {
    setBackPath(userRole === "supervisor" ? "/supervisor" : userRole === "petugas_eksekusi" ? "/petugas-eksekusi" : "/my-reports");
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
  const [showSatgasPicker, setShowSatgasPicker] = useState(false);
  const [satgasUprId, setSatgasUprId] = useState("");
  const [satgasCatatan, setSatgasCatatan] = useState("");
  const [uprList, setUprList] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    if (!reportId) {
      setError("ID laporan tidak ditemukan.");
      setLoading(false);
      return;
    }
    loadReport();
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
      setReport(json.data ?? null);
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
        setReport(json.data ?? null);
      }
    } catch {}
  }

  // Fetch UPR list for satgas picker
  async function fetchUprList() {
    try {
      const res = await fetch(`${API_BASE_URL}/uprs`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const json = await res.json();
        setUprList(json.data ?? json ?? []);
      }
    } catch {}
  }

  // Supervisor: auto-set status to "Ditinjau" when viewing
  useEffect(() => {
    if (!reportId || userRole !== "supervisor") return;
    if (!report || (report.status !== "Menunggu Review" && report.status !== "Ditinjau")) return;
    fetch(`${API_BASE_URL}/reports/${reportId}/mulai-review`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }, [report?.id, report?.status]);

  async function handleSetujui() {
    if (!report) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/reports/${report.id}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ priority }),
      });
      const json = await res.json();
      if (res.ok) {
        await refreshReport();
        setActionMsg("Laporan disetujui.");
      } else {
        setActionMsg(json.message ?? "Gagal menyetujui.");
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
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/reports/${report.id}/mulai`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      setActionMsg(json.message ?? (res.ok ? "Pengerjaan dimulai" : "Gagal"));
      if (res.ok) await refreshReport();
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

  async function handleMulaiWithSatgas() {
    if (!report || !satgasUprId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/reports/${report.id}/mulai`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ assigned_upr_id: satgasUprId, catatan: satgasCatatan }),
      });
      const json = await res.json();
      if (res.ok) {
        await refreshReport();
        setActionMsg("Satgas ditugaskan dan pengerjaan dimulai.");
        setShowSatgasPicker(false);
      } else {
        setActionMsg(json.message ?? "Gagal memulai pengerjaan.");
      }
    } catch {
      setActionMsg("Kesalahan jaringan.");
    } finally {
      setActionLoading(false);
    }
  }


  const mapPoints: ReportMapPoint[] =
    report?.latitude && report?.longitude
      ? [{ lat: report.latitude, lng: report.longitude, label: report.road_name }]
      : [];

  const statusHistory: TimelineEvent[] = report?.status_history ?? [];

  const hasTimeline = statusHistory.length > 0;

  // ── Loading State ──

  if (loading) {
    return (
      <PageLayout back={backPath} title="Detail Laporan">
          <main aria-busy="true" aria-label="Memuat detail laporan" className="flex flex-col items-center justify-center min-h-[calc(100dvh-3.5rem)] px-4">
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
            <p className="text-[14px] font-semibold text-[#0F172A]">{error || "Laporan tidak ditemukan."}</p>
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
    const isEksekusi = userRole === "petugas_eksekusi";

    const showBack = (centered?: boolean) => (
      <Link
        to={backPath}
        className={`${centered ? 'w-[70%] flex bg-[#1A4F8A] text-white shadow-sm hover:bg-[#153d6e]' : 'flex-1 bg-[#F8FAFC] border border-[#CBD5E1] text-[#475569] hover:bg-[#F1F5F9] hover:border-[#94A3B8]'} py-2 md:py-2.5 min-h-[36px] rounded-xl text-[12px] font-semibold items-center justify-center gap-1.5 active:scale-95 transition-all`}
      >
        <Icon name="arrow_back" className="!text-[16px]" />
        Kembali
      </Link>
    );

    // Supervisor: Menunggu Review / Ditinjau → Setujui + Tolak
    if (isSupervisor && (status === "Menunggu Review" || status === "Ditinjau")) {
      return (
        <FooterWrapper>
          {actionMsg && (
            <div className="px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-[12px] text-[#0F172A] text-center">{actionMsg}</div>
          )}
          <button
            type="button"
            disabled={actionLoading}
            onClick={() => setShowSatgasPicker(true)}
            className="w-full py-2.5 md:py-3 min-h-[40px] bg-[#1A4F8A] text-white rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 hover:bg-[#153d6e] active:scale-[0.98] transition-all disabled:opacity-50 shadow-sm"
          >
            {actionLoading ? "Memproses…" : (
              <>
                <Icon name="check" className="!text-[20px]" />
                Setujui & Tugaskan
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
            {showBack()}
          </div>
        </FooterWrapper>
      );
    }

    // Supervisor: Disetujui → Mulai Pengerjaan with satgas picker
    if (isSupervisor && status === "Disetujui") {
      return (
        <FooterWrapper>
          {actionMsg && (
            <div className="px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-[12px] text-[#0F172A] text-center">{actionMsg}</div>
          )}
          <button
            type="button"
            disabled={actionLoading}
            onClick={() => setShowSatgasPicker(true)}
            className="w-full py-2.5 md:py-3 min-h-[40px] bg-[#1A4F8A] text-white rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 hover:bg-[#153d6e] active:scale-[0.98] transition-all disabled:opacity-50 shadow-sm"
          >
            {actionLoading ? "Memproses…" : (
              <>
                <Icon name="assignment" className="!text-[20px]" />
                Mulai Pengerjaan
              </>
            )}
          </button>
          <div className="flex gap-3">
            <div className="flex-1" />
            {showBack()}
          </div>
        </FooterWrapper>
      );
    }

    // Supervisor: Selesai → Re-open
    if (isSupervisor && status === "Selesai") {
      return (
        <FooterWrapper>
          {actionMsg && (
            <div className="px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-[12px] text-[#0F172A] text-center">{actionMsg}</div>
          )}
          <button
            type="button"
            disabled={actionLoading}
            onClick={handleReopen}
            className="w-full py-2 md:py-2.5 min-h-[36px] bg-[#FFF7ED] border border-[#FED7AA] text-[#C2410C] rounded-xl text-[12px] font-semibold flex items-center justify-center gap-1.5 hover:bg-[#FFF5F5] hover:border-[#FB923C] active:scale-95 transition-all disabled:opacity-50"
          >
            {actionLoading ? "Memproses…" : (
              <>
                <Icon name="refresh" className="!text-[16px]" />
                Buka Kembali
              </>
            )}
          </button>
          <div className="flex gap-3">
            <div className="flex-1" />
            {showBack()}
          </div>
        </FooterWrapper>
      );
    }

    // Petugas Eksekusi: Disetujui → Mulai
    if (isEksekusi && status === "Disetujui") {
      return (
        <FooterWrapper>
          {actionMsg && (
            <div className="px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-[12px] text-[#0F172A] text-center">{actionMsg}</div>
          )}
          <button
            type="button"
            disabled={actionLoading}
            onClick={handleMulaiEksekusi}
            className="w-full py-2.5 md:py-3 min-h-[40px] bg-[#1A4F8A] text-white rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 hover:bg-[#153d6e] active:scale-[0.98] transition-all disabled:opacity-50 shadow-sm"
          >
            {actionLoading ? "Memproses…" : (
              <>
                <Icon name="play_arrow" className="!text-[20px]" />
                Mulai Pengerjaan
              </>
            )}
          </button>
          <div className="flex gap-3">
            <div className="flex-1" />
            {showBack()}
          </div>
        </FooterWrapper>
      );
    }

    // Petugas Eksekusi: Sedang Diperbaiki → Selesaikan
    if (isEksekusi && status === "Sedang Diperbaiki") {
      return (
        <FooterWrapper>
          <button
            type="button"
            onClick={handleSelesaikan}
            className="w-full py-2.5 md:py-3 min-h-[40px] bg-[#1A4F8A] text-white rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 hover:bg-[#153d6e] active:scale-[0.98] transition-all disabled:opacity-50 shadow-sm"
          >
            <Icon name="check_circle" className="!text-[20px]" />
            Selesaikan
          </button>
          <div className="flex gap-3">
            <div className="flex-1" />
            {showBack()}
          </div>
        </FooterWrapper>
      );
    }

    // Default: Kembali
    return (
      <FooterWrapper>
        {actionMsg && (
          <div className="px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-[12px] text-[#0F172A] text-center">{actionMsg}</div>
        )}
        <div className="flex justify-center">
          {showBack(true)}
        </div>
      </FooterWrapper>
    );
  }

  // ── Content ──

  return (
    <PageLayout
      back={backPath}
      title="Detail Laporan"
      right={<span className="font-id-code text-[12px] text-[#64748B]">{report.report_code}</span>}
    >
        <main>
          <div className="max-w-2xl mx-auto p-4 pb-[140px] flex flex-col gap-4">

            {/* ── Foto & Analisis AI per foto ── */}
            {report.photos && report.photos.length > 0 ? (
              report.photos.map((photo, i) => (
                <div key={photo.id} className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
                  {photo.image_original_url && photo.image_result_url && photo.image_result_url !== photo.image_original_url ? (
                    <BeforeAfterSlider
                      beforeSrc={photo.image_original_url}
                      afterSrc={photo.image_result_url}
                      beforeLabel={`Foto ${i + 1} — Asli`}
                      afterLabel={`Foto ${i + 1} — AI`}
                      panjang={photo.kerusakan_panjang}
                      lebar={photo.kerusakan_lebar}
                    />
                  ) : photo.image_original_url ? (
                    <div className="bg-[#0F172A] flex items-center justify-center" style={{ minHeight: 280 }}>
                      <SafeImage src={photo.image_original_url} alt={`Foto ${i + 1}`} className="w-full h-full object-contain max-h-[55vh]" />
                    </div>
                  ) : null}
                  {(photo.ai_jenis_kerusakan || photo.ai_severity || photo.ai_confidence != null || photo.total_detections != null) && (
                    <div className="p-3 border-t border-[#E2E8F0]">
                      <div className="flex items-start gap-2">
                        <div className="w-7 h-7 rounded-lg bg-[#F1F5F9] flex items-center justify-center shrink-0">
                          <Icon name="insights" className="!text-[16px] text-[#1A4F8A]" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          {photo.ai_jenis_kerusakan && (
                            <p className="text-[13px] font-semibold text-[#0F172A]">{photo.ai_jenis_kerusakan}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-2">
                            {photo.ai_severity && (
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                                photo.ai_severity === "berat" ? "bg-[#E11D48] text-white border-[#E11D48]" :
                                photo.ai_severity === "sedang" ? "bg-orange-50 text-[#F97316] border-orange-200" :
                                "bg-amber-50 text-[#F59E0B] border-amber-200"
                              }`}>
                                {normalizeSeverityKey(photo.ai_severity)}
                              </span>
                            )}
                            {photo.ai_confidence != null && (
                              <span className="text-[11px] text-[#64748B] font-medium">
                                {(photo.ai_confidence * 100).toFixed(0)}% yakin
                              </span>
                            )}
                            {photo.total_detections != null && (
                              <span className="text-[11px] text-[#64748B]">
                                {photo.total_detections} area terdeteksi
                              </span>
                            )}
                          </div>

                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : report.image_original_url ? (
              <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
                {report.image_result_url && report.image_result_url !== report.image_original_url ? (
                  <BeforeAfterSlider
                    beforeSrc={report.image_original_url}
                    afterSrc={report.image_result_url}
                    beforeLabel="Foto Asli"
                    afterLabel="Hasil AI"
                    panjang={report.kerusakan_panjang}
                    lebar={report.kerusakan_lebar}
                  />
                ) : (
                  <div className="bg-[#0F172A] flex items-center justify-center" style={{ minHeight: 280 }}>
                    <SafeImage src={report.image_original_url} alt="Foto" className="w-full h-full object-contain max-h-[55vh]" />
                  </div>
                )}
              </div>
            ) : null}

            {/* ── Before/After Slider (perbaikan) ── */}
            <DetailBeforeAfter report={report} />

            {/* ── Badges ── */}
            <div className="flex flex-wrap items-center gap-2">
              {(() => {
                const sev = report.overall_severity ?? report.ai_severity;
                if (!sev) return null;
                const s = getSevStyle(normalizeSeverityKey(sev));
                return (
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${s.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                    {normalizeSeverityKey(sev)}
                  </span>
                );
              })()}
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-white border border-[#E2E8F0] text-[#475569]">
                <span className={`w-2 h-2 rounded-full ${statusDotStyle(report.status ?? "")}`} />
                {displayStatus(report.status ?? "-")}
              </span>
              {report.trust_label && (
                <TrustBadge score={report.trust_score ?? 0} label={report.trust_label as TrustLabel} compact />
              )}
            </div>

            {/* ── Info Jalan ── */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
              <h2 className="font-headline-sm text-[17px] font-bold text-[#0F172A] mb-3">
                {report.road_name}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                <InfoRow icon="location_on" value={`Kec. ${report.district}`} />
                {report.assigned_upr_name && (
                  <InfoRow icon="group" value={`UPR: ${report.assigned_upr_name}`} />
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
                {report.report_code && (
                  <InfoRow icon="tag" value={report.report_code} />
                )}
              </div>
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
                </div>
                <div className="h-48" style={{ isolation: "isolate" }}>
                  <ReportMap points={mapPoints} />
                </div>
              </div>
            )}

          </div>
        </main>

        {renderFooter()}

        {/* ── Tolak Modal ── */}
        {showTolak && (
          <Portal>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0, 0, 0, 0.55)" }} onClick={() => setShowTolak(false)} aria-hidden="true">
              <div className="w-full max-w-sm bg-white rounded-xl border border-[#D0DAE8] shadow-lg" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true">
                <div className="bg-[#E11D48] border-b border-red-700 px-5 py-4 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white/60 flex items-center justify-center shrink-0">
                    <Icon name="block" className="text-white !text-[24px]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-red-600 text-white border border-black/10 mb-1.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      TOLAK LAPORAN
                    </span>
                    <h2 className="text-[16px] font-bold text-white leading-tight">Tolak Laporan</h2>
                  </div>
                </div>
                <div className="px-5 py-4 space-y-3">
                  <div>
                    <label className="text-[12px] font-semibold text-[#0F172A] mb-1 block">Alasan Penolakan <span className="text-[#E11D48]">*</span></label>
                    <textarea
                      value={tolakAlasan}
                      onChange={(e) => setTolakAlasan(e.target.value)}
                      className="w-full h-24 px-3 py-2 rounded-lg border border-[#D0DAE8] resize-none text-[13px] text-[#0F172A] placeholder-[#94A3B8] outline-none focus:ring-2 focus:ring-[#1A4F8A]/20 focus:border-[#1A4F8A]"
                      placeholder="Jelaskan alasan mengapa laporan ini ditolak…"
                    />
                  </div>
                  <div>
                    <label className="text-[12px] font-semibold text-[#0F172A] mb-1 block">Catatan (opsional)</label>
                    <input
                      value={catatan}
                      onChange={(e) => setCatatan(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-[#D0DAE8] text-[13px] text-[#0F172A] placeholder-[#94A3B8] outline-none focus:ring-2 focus:ring-[#1A4F8A]/20 focus:border-[#1A4F8A]"
                      placeholder="Catatan tambahan…"
                    />
                  </div>
                </div>
                <div className="px-5 pb-5 flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={actionLoading || !tolakAlasan.trim()}
                    onClick={handleTolak}
                    className="w-full h-11 bg-[#E11D48] text-white rounded-lg text-[14px] font-semibold flex items-center justify-center gap-2 hover:bg-[#BE123C] active:scale-95 transition-all disabled:opacity-50"
                  >
                    {actionLoading ? "Memproses…" : (
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
                </div>
              </div>
            </div>
          </Portal>
        )}

        {/* ── Satgas Picker Modal ── */}
        {showSatgasPicker && (
          <Portal>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0, 0, 0, 0.55)" }} onClick={() => setShowSatgasPicker(false)} aria-hidden="true">
              <div className="w-full max-w-sm bg-white rounded-xl border border-[#D0DAE8] shadow-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                <div className="bg-[#1A4F8A] border-b border-[#153d6e] px-5 py-4 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white/60 flex items-center justify-center shrink-0">
                    <Icon name="assignment" className="text-white !text-[24px]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-[#153d6e] text-white border border-black/10 mb-1.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      {(userRole === "supervisor" && (report?.status === "Menunggu Review" || report?.status === "Ditinjau")) ? "SETUJUI & TUGASKAN" : "TUGASKAN SATGAS"}
                    </span>
                    <h2 className="text-[16px] font-bold text-white leading-tight">Setujui & Tugaskan</h2>
                  </div>
                </div>
                <div className="px-5 py-4 space-y-3">
                  <div>
                    <label className="text-[12px] font-semibold text-[#0F172A] mb-1 block">Prioritas</label>
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
                  <div>
                    <label className="text-[12px] font-semibold text-[#0F172A] mb-1 block">Tugaskan ke UPR/Satgas <span className="text-[#E11D48]">*</span></label>
                    <select
                      value={satgasUprId}
                      onChange={(e) => setSatgasUprId(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-[#D0DAE8] text-[13px] text-[#0F172A] outline-none focus:ring-2 focus:ring-[#1A4F8A]/20 focus:border-[#1A4F8A]"
                      onClick={() => { if (uprList.length === 0) fetchUprList(); }}
                    >
                      <option value="">Pilih UPR/Satgas…</option>
                      {uprList.map((u) => (
                        <option key={u.id} value={String(u.id)}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[12px] font-semibold text-[#0F172A] mb-1 block">Catatan (opsional)</label>
                    <input
                      value={satgasCatatan}
                      onChange={(e) => setSatgasCatatan(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-[#D0DAE8] text-[13px] text-[#0F172A] placeholder-[#94A3B8] outline-none focus:ring-2 focus:ring-[#1A4F8A]/20 focus:border-[#1A4F8A]"
                      placeholder="Instruksi untuk satgas…"
                    />
                  </div>
                </div>
                <div className="px-5 pb-5 flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={actionLoading || !satgasUprId}
                    onClick={() => {
                      const needApprove = userRole === "supervisor" && (report?.status === "Menunggu Review" || report?.status === "Ditinjau");
                      if (needApprove) {
                        handleSetujui().then(() => {
                          handleMulaiWithSatgas();
                        });
                      } else {
                        handleMulaiWithSatgas();
                      }
                    }}
                    className="w-full h-11 bg-[#1A4F8A] text-white rounded-lg text-[14px] font-semibold flex items-center justify-center gap-2 hover:bg-[#153d6e] active:scale-95 transition-all disabled:opacity-50"
                  >
                    {actionLoading ? "Memproses…" : (
                      <>
                        <Icon name="check" className="!text-[18px]" />
                        {(userRole === "supervisor" && (report?.status === "Menunggu Review" || report?.status === "Ditinjau")) ? "Setujui & Tugaskan" : "Tugaskan"}
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSatgasPicker(false)}
                    className="w-full h-10 text-[13px] text-[#64748B] font-medium hover:text-[#0F172A] transition-colors"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </div>
          </Portal>
        )}

    </PageLayout>
  );
}

// ── Sub-components ──

function FooterWrapper({ children }: { children: React.ReactNode }) {
  return (
    <footer className="fixed bottom-0 left-0 right-0 md:left-64 z-30 bg-white border-t border-[#E2E8F0] shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
      <div className="px-4 md:px-6 py-3 md:py-4 flex flex-col gap-2 md:gap-3">
        {children}
      </div>
    </footer>
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

function DetailBeforeAfter({ report }: { report: Laporan }) {
  if (!report.after_photo_url) return null;

  const damagedPhotos = (report.photos ?? []).filter(
    (p) => (p.total_detections ?? 0) > 0 && p.ai_severity,
  );
  const singleBefore = report.image_original_url ?? report.first_photo_url;
  if (!damagedPhotos.length && !singleBefore) return null;

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
      <div className="p-3 border-b border-[#E2E8F0]">
        <h3 className="font-label-md text-[13px] font-bold text-on-surface">
          Perbandingan Sebelum & Sesudah
        </h3>
      </div>
      <div className="p-3 flex flex-col gap-4">
        {damagedPhotos.length > 0 ? (
          damagedPhotos.map((p, i) => (
            <div key={p.id}>
              <p className="text-[11px] font-semibold text-slate-500 mb-1.5">
                Foto #{p.sort_order ?? i + 1} — {p.ai_jenis_kerusakan ?? "Kerusakan"}
              </p>
              <BeforeAfterSlider
                beforeSrc={p.image_original_url ?? ""}
                afterSrc={report.after_photo_url ?? ""}
                panjang={p.kerusakan_panjang}
                lebar={p.kerusakan_lebar}
              />
            </div>
          ))
        ) : (
          <BeforeAfterSlider
            beforeSrc={singleBefore!}
            afterSrc={report.after_photo_url}
            panjang={report.kerusakan_panjang}
            lebar={report.kerusakan_lebar}
          />
        )}
      </div>
    </div>
  );
}
