import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Icon } from "@/components/jk/Icon";
import { TrustBadge } from "@/components/jk/TrustBadge";
import { useState, useEffect, Fragment } from "react";
import { PageLayout } from "@/components/jk/PageLayout";
import { API_BASE_URL } from "@/lib/aiStore";
import { getToken, getCurrentUser } from "@/lib/auth";
import type { Laporan, TrustLabel, TimelineEvent } from "@/types/laporan";
import { ImageWithLoading } from "@/components/jk/ImageWithLoading";
import { ReportMap, type ReportMapPoint } from "@/components/jk/ReportMap";
import { TimelineCard } from "@/components/jk/TimelineCard";
import { BeforeAfterSlider } from "@/components/jk/BeforeAfterSlider";

export const Route = createFileRoute("/review")({
  component: ReviewPage,
  validateSearch: (search: Record<string, unknown>) => {
    const reportId = search.reportId as string | undefined;
    return { ...(reportId ? { reportId } : {}) };
  },
  head: () => ({ meta: [{ title: "Review Laporan — DeltaJalan" }] }),
});

function ReviewPage() {
  const { reportId } = Route.useSearch();
  const navigate = useNavigate();
  const token = getToken() ?? "";
  const user = getCurrentUser();
  const dashboardUrl = user?.role === "petugas_eksekusi" ? "/petugas-eksekusi" : "/supervisor";

  const [report, setReport] = useState<Laporan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  async function fetchUprList() {
    try {
      const res = await fetch(`${API_BASE_URL}/uprs`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const json = await res.json();
        setUprList(json.data ?? json ?? []);
      }
    } catch {}
  }

  useEffect(() => {
    if (!reportId) {
      setError("ID laporan tidak ditemukan.");
      setLoading(false);
      return;
    }
    loadReport();
  }, [reportId]);

  // Supervisor membuka review → set status "Ditinjau"
  useEffect(() => {
    if (!reportId || user?.role !== "supervisor") return;
    if (!report || (report.status !== "Menunggu Review" && report.status !== "Ditinjau")) return;
    fetch(`${API_BASE_URL}/reports/${reportId}/mulai-review`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }, [report?.id, report?.status]);

  async function loadReport() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/reports/${reportId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Gagal memuat laporan.");
      const json = await res.json();
      const r = json.data ?? null;
      setReport(r);
      if (r?.priority) setPriority(r.priority);
    } catch {
      setError("Gagal memuat data laporan.");
    } finally {
      setLoading(false);
    }
  }

  function statusStep(s: string) {
    const n = s === "Ditinjau" || s === "Diedit" ? "Menunggu Review" : s;
    const steps = ["Menunggu Review", "Disetujui", "Sedang Diperbaiki", "Selesai"];
    const idx = steps.indexOf(n);
    return idx >= 0 ? idx + 1 : 0;
  }

  function isRejected(s: string) {
    return s === "Ditolak";
  }

  function severityBadge(sev: string | undefined | null) {
    const map: Record<string, string> = {
      "Rusak Berat": "bg-red-50 text-red-700 border-red-200",
      "Rusak Sedang": "bg-amber-50 text-amber-700 border-amber-200",
      "Rusak Ringan": "bg-green-50 text-green-700 border-green-200",
      Baik: "bg-green-50 text-green-700 border-green-200",
    };
    return map[sev ?? ""] ?? "bg-gray-50 text-gray-700 border-gray-200";
  }

  async function handleApprove() {
    if (!report) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/reports/${report.id}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ priority }),
      });
      const json = await res.json();
      setActionMsg(json.message ?? (res.ok ? "Disetujui" : "Gagal"));
      if (res.ok) await loadReport();
    } catch {
      setActionMsg("Gagal menyetujui.");
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
        await loadReport();
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
      if (res.ok) await loadReport();
    } catch {
      setActionMsg("Kesalahan jaringan.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleMulai() {
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
      if (res.ok) await loadReport();
    } catch {
      setActionMsg("Kesalahan jaringan.");
    } finally {
      setActionLoading(false);
    }
  }

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
        await loadReport();
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
        await loadReport();
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

  if (loading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center flex-1">
          <span className="w-8 h-8 border-4 border-primary-container/30 border-t-primary-container rounded-full animate-spin" />
        </div>
      </PageLayout>
    );
  }

  if (error || !report) {
    return (
      <PageLayout>
        <div className="flex flex-col items-center justify-center flex-1 gap-3 px-4">
          <Icon name="error" className="!text-5xl text-error opacity-50" />
          <p className="text-on-surface-variant">{error || "Laporan tidak ditemukan."}</p>
          <Link to={dashboardUrl} className="text-primary text-sm font-bold">
            Kembali ke Dashboard
          </Link>
        </div>
      </PageLayout>
    );
  }

  const step = statusStep(report.status);
  const rejected = isRejected(report.status);
  const steps = [
    { l: "Laporan Masuk", done: step > 1 || rejected, active: step === 1 },
    { l: "Review", done: step > 2 || rejected, active: !rejected && step === 2 },
    { l: "Disposisi", done: step > 3, active: !rejected && step === 3 },
    { l: "Selesai", done: step > 4, active: !rejected && step === 4 },
  ];
  const rejectedStep = { l: "Ditolak", done: false, active: rejected };

  const sev = report.overall_severity ?? report.ai_severity ?? "";

  return (
    <PageLayout
      back={dashboardUrl}
      title="Detail Laporan"
      right={<span className="font-id-code text-[12px] text-slate-400">{report.report_code}</span>}
    >
      {/* Action message */}
      {actionMsg && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 text-sm text-blue-800">
          {actionMsg}
        </div>
      )}

      {user?.role !== "supervisor" && (
        <section className="bg-surface-container-lowest px-4 py-3 flex items-center justify-between overflow-x-auto hide-scrollbar border-b border-border-subtle">
          {(rejected ? [...steps.slice(0, 2), rejectedStep] : steps).map((s, i, arr) => (
            <Fragment key={s.l}>
              <div className="flex flex-col items-center gap-1 min-w-[64px]">
                {s.l === "Ditolak" ? (
                  <div className="w-5 h-5 rounded-full bg-error flex items-center justify-center">
                    <Icon name="close" className="!text-[14px] text-white" weight={700} />
                  </div>
                ) : s.done ? (
                  <div className="w-5 h-5 rounded-full bg-selesai flex items-center justify-center">
                    <Icon name="check" className="!text-[14px] text-white" weight={700} />
                  </div>
                ) : s.active ? (
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-border-subtle" />
                )}
                <span
                  className={`font-label-sm text-[10px] text-center whitespace-nowrap ${
                    s.l === "Ditolak"
                      ? "text-error font-bold"
                      : s.active
                        ? "text-primary-container font-bold"
                        : s.done
                          ? "text-on-surface-variant"
                          : "text-slate-400"
                  }`}
                >
                  {s.l}
                </span>
              </div>
              {i < arr.length - 1 && (
                <div
                  className={`h-px flex-1 mx-1 min-w-[20px] ${
                    s.l === "Ditolak"
                      ? "bg-error"
                      : s.done
                        ? "bg-selesai"
                        : s.active
                          ? "bg-primary"
                          : "bg-border-subtle"
                  }`}
                />
              )}
            </Fragment>
          ))}
        </section>
      )}

      <div className="flex flex-col flex-1 min-h-0">
        <main className="flex-1 overflow-y-auto min-h-0 p-4 flex flex-col gap-4">
          {/* Info laporan */}
          <div className="bg-white rounded-lg border border-[#D0DAE8] p-4">
            <h2 className="font-headline-sm text-base font-bold text-on-surface mb-3">
              {report.road_name}
            </h2>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-slate-600">
                <Icon name="location_pin" className="!text-[18px]" />
                <span className="text-[13px]">Kec. {report.district}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-slate-400">
                  <Icon name="calendar_month" className="!text-[18px]" />
                  <span className="text-[12px]">
                    {report.created_at
                      ? new Date(report.created_at).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })
                      : "-"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <Icon name="person" className="!text-[18px]" />
                  <span className="text-[12px]">{report.reporter_name}</span>
                </div>
              </div>
              {report.kerusakan_panjang && (
                <div className="flex items-center gap-2 text-slate-600 mt-1">
                  <Icon name="straighten" className="!text-[18px]" />
                  <span className="text-[13px]">
                    {report.kerusakan_panjang} m
                    {report.kerusakan_lebar ? ` × ${report.kerusakan_lebar} m` : ""}
                    {report.kerusakan_lebar
                      ? ` (${(report.kerusakan_panjang * report.kerusakan_lebar).toFixed(1)} m²)`
                      : ""}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 mt-1">
                <TrustBadge
                  score={report.trust_score}
                  label={(report.trust_label as TrustLabel) ?? "merah"}
                />
                {sev && sev !== "Baik" && (
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded border ${severityBadge(sev)}`}
                  >
                    {sev}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── Foto Bukti Tambahan ── */}
          {(report as any).evidences?.length > 0 && (
            <div className="bg-white rounded-lg border border-[#D0DAE8] p-4">
              <h3 className="font-label-md font-bold text-on-surface mb-3">Foto Bukti Tambahan</h3>
              <div className="grid grid-cols-2 gap-2">
                {(report as any).evidences.map((e: any) => (
                  <ImageWithLoading
                    key={e.id}
                    src={e.image_url}
                    alt="Evidence"
                    wrapperClassName="relative bg-slate-100 rounded-lg overflow-hidden max-h-[200px]"
                    preserveAspect
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Perbandingan Original & AI ── */}
          {report.photos && report.photos.length > 0 ? (
            <div className="bg-white rounded-lg border border-[#D0DAE8] p-4">
              <div className="flex items-center gap-2 mb-3">
                <Icon name="compare_arrows" className="text-primary !text-[18px]" />
                <h3 className="font-label-md font-bold text-on-surface">
                  Perbandingan Original & AI
                </h3>
              </div>
              <div className="flex flex-col gap-4">
                {report.photos.map((photo, i) => {
                  const origUrl = photo.image_original_url ?? "";
                  const detUrl = photo.image_result_url ?? photo.image_original_url ?? "";
                  if (!origUrl) return null;
                  return (
                    <div key={photo.id}>
                      <p className="text-[11px] font-semibold text-slate-500 mb-1.5">
                        Foto #{i + 1} — {photo.ai_jenis_kerusakan ?? "Kerusakan"}
                      </p>
                      <BeforeAfterSlider
                        beforeSrc={origUrl}
                        afterSrc={detUrl}
                        beforeLabel="Original"
                        afterLabel="Deteksi AI"
                      />
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                        {(photo.kerusakan_panjang || photo.kerusakan_lebar) && (
                          <p className="text-[10px] text-slate-500">
                            {photo.kerusakan_panjang ? `${photo.kerusakan_panjang} m` : ""}
                            {photo.kerusakan_panjang && photo.kerusakan_lebar ? " × " : ""}
                            {photo.kerusakan_lebar ? `${photo.kerusakan_lebar} m` : ""}
                            {photo.kerusakan_panjang && photo.kerusakan_lebar
                              ? ` (${(photo.kerusakan_panjang * photo.kerusakan_lebar).toFixed(1)} m²)`
                              : ""}
                          </p>
                        )}
                        {photo.ai_severity ? (
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                              photo.ai_severity === "berat"
                                ? "bg-red-50 text-red-700 border-red-200"
                                : photo.ai_severity === "sedang"
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-green-50 text-green-700 border-green-200"
                            }`}
                          >
                            {photo.ai_severity === "berat"
                              ? "Rusak Berat"
                              : photo.ai_severity === "sedang"
                                ? "Rusak Sedang"
                                : "Rusak Ringan"}
                          </span>
                        ) : null}
                        {photo.ai_confidence != null && (
                          <p className="text-[10px] text-slate-400">
                            {(photo.ai_confidence * 100).toFixed(0)}% confidence
                          </p>
                        )}
                        {(photo.total_detections ?? 0) === 0 && (
                          <p className="text-[9px] text-slate-400 italic">Tidak ada kerusakan</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : report.image_original_url && report.image_result_url ? (
            <div className="bg-white rounded-lg border border-[#D0DAE8] p-4">
              <div className="flex items-center gap-2 mb-3">
                <Icon name="compare_arrows" className="text-primary !text-[18px]" />
                <h3 className="font-label-md font-bold text-on-surface">
                  Perbandingan Original & AI
                </h3>
              </div>
              <div>
                <BeforeAfterSlider
                  beforeSrc={report.image_original_url}
                  afterSrc={report.image_result_url}
                  beforeLabel="Original"
                  afterLabel="Deteksi AI"
                />
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                  {(report.kerusakan_panjang || report.kerusakan_lebar) && (
                    <p className="text-[10px] text-slate-500">
                      {report.kerusakan_panjang ? `${report.kerusakan_panjang} m` : ""}
                      {report.kerusakan_panjang && report.kerusakan_lebar ? " × " : ""}
                      {report.kerusakan_lebar ? `${report.kerusakan_lebar} m` : ""}
                      {report.kerusakan_panjang && report.kerusakan_lebar
                        ? ` (${(report.kerusakan_panjang * report.kerusakan_lebar).toFixed(1)} m²)`
                        : ""}
                    </p>
                  )}
                  {report.ai_severity ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-red-50 text-red-700 border-red-200">
                      {report.ai_severity === "berat" ? "Rusak Berat" : report.ai_severity === "sedang" ? "Rusak Sedang" : "Rusak Ringan"}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {/* Before/After Sliders */}
          <BeforeAfterSection
            report={report}
            afterPhotoUrl={(report as any).after_photo_url}
            afterPhotoNotes={(report as any).after_photo_notes}
          />

          {/* UPR & Waktu Pengerjaan */}
          {(report.status === "Disetujui" ||
            report.status === "Sedang Diperbaiki" ||
            report.status === "Selesai") && (
            <div className="bg-white rounded-lg border border-[#D0DAE8] p-4">
              <div className="flex items-center gap-2 mb-3">
                <Icon name="groups" className="text-primary !text-[18px]" />
                <h3 className="font-label-md font-bold text-on-surface">Informasi Penugasan</h3>
              </div>
              <div className="space-y-2 text-xs text-slate-700">
                {report.assigned_upr_name && (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">UPR:</span>
                    <span>{report.assigned_upr_name}</span>
                  </div>
                )}
                {(report as any).assigned_at && (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Ditugaskan:</span>
                    <span>
                      {new Date((report as any).assigned_at).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                )}
                {(report as any).perbaikan_dimulai_at && (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Mulai:</span>
                    <span>
                      {new Date((report as any).perbaikan_dimulai_at).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                )}
                {(report as any).perbaikan_selesai_at && (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Selesai:</span>
                    <span>
                      {new Date((report as any).perbaikan_selesai_at).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                )}
                {(report as any).pelaksana && (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Pelaksana:</span>
                    <span>{(report as any).pelaksana}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timeline Perbaikan */}
          {report.status_history && report.status_history.length > 0 && (
            <TimelineCard events={report.status_history as TimelineEvent[]} />
          )}

          {/* Koordinat & Map Preview */}
          {report.latitude && report.longitude && (
            <div className="bg-white rounded-lg border border-[#D0DAE8] overflow-hidden">
              <div className="p-4 pb-3">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="location_on" className="text-primary !text-[18px]" />
                  <h3 className="font-label-md font-bold text-on-surface">Lokasi</h3>
                </div>
                <p className="text-xs text-slate-700 font-mono mb-1">
                  {report.latitude.toFixed(6)}, {report.longitude.toFixed(6)}
                </p>
                <a
                  href={`https://www.google.com/maps?q=${report.latitude},${report.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 underline inline-block"
                >
                  Buka di Google Maps
                </a>
              </div>
              {(() => {
                const mapPoints: ReportMapPoint[] = [];
                if (report.latitude && report.longitude) {
                  mapPoints.push({
                    label: report.road_name,
                    lat: report.latitude,
                    lng: report.longitude,
                    reportCode: report.report_code,
                  });
                }
                if (report.photos) {
                  report.photos.forEach((photo) => {
                    if (photo.latitude && photo.longitude) {
                      mapPoints.push({
                        label: photo.ai_jenis_kerusakan ?? "Foto",
                        lat: photo.latitude,
                        lng: photo.longitude,
                        imageUrl: photo.image_result_url ?? photo.image_original_url,
                      });
                    }
                  });
                }
                return mapPoints.length > 0 ? (
                  <div className="border-t border-[#D0DAE8]">
                    <ReportMap points={mapPoints} />
                  </div>
                ) : null;
              })()}
            </div>
          )}

          {/* Catatan Petugas */}
          {report.catatan_petugas && (
            <div className="bg-white rounded-lg border border-[#D0DAE8] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="edit_note" className="text-primary !text-[18px]" />
                <h3 className="font-label-md font-bold text-on-surface">Catatan Petugas</h3>
              </div>
              <p className="text-xs text-slate-700 whitespace-pre-wrap">{report.catatan_petugas}</p>
            </div>
          )}

          {/* Penilaian Supervisor (hanya kalo masih Menunggu Review / Ditinjau) */}
          {(report.status === "Menunggu Review" || report.status === "Ditinjau") && (
            <div className="bg-white rounded-lg border border-[#D0DAE8] p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Icon name="format_text_clip" className="text-primary" />
                  <h3 className="font-label-md font-bold text-on-surface">Penilaian Supervisor</h3>
                </div>
                <span className="bg-orange-50 text-orange-600 text-[10px] font-bold px-2 py-0.5 rounded border border-orange-200 uppercase">
                  Wajib Diisi
                </span>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-[12px] font-medium text-slate-600 mb-2.5">
                    Prioritas Penanganan
                  </label>
                  <div className="flex gap-2">
                    {(["Rendah", "Sedang", "Tinggi"] as const).map((p) => {
                      const active = priority === p;
                      return (
                        <button
                          key={p}
                          onClick={() => setPriority(p)}
                          className={`flex-1 py-2 text-[12px] font-semibold rounded-lg border ${
                            active
                              ? p === "Tinggi"
                                ? "bg-rusak-berat text-white border-transparent"
                                : "bg-primary text-white border-transparent"
                              : "bg-white border-border-subtle text-slate-500"
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-slate-600 mb-1.5">
                    Catatan Supervisor
                  </label>
                  <textarea
                    value={catatan}
                    onChange={(e) => setCatatan(e.target.value)}
                    placeholder="Tambahkan instruksi khusus di sini..."
                    className="w-full border border-[#C0CEDF] rounded-lg p-3 text-sm bg-slate-50 min-h-[80px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Modal tolak */}
          {showTolak && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
              <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4 shadow-lg border border-[#D0DAE8]">
                <h3 className="font-semibold text-gray-900">Tolak Laporan</h3>
                <select
                  value={tolakAlasan}
                  onChange={(e) => setTolakAlasan(e.target.value)}
                  className="w-full border border-[#C0CEDF] rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">-- Pilih alasan --</option>
                  <option value="koordinat_tidak_valid">Koordinat tidak valid</option>
                  <option value="foto_tidak_jelas">Foto tidak jelas</option>
                  <option value="bukan_kerusakan_jalan">Bukan kerusakan jalan</option>
                  <option value="duplikat">Duplikat laporan lain</option>
                  <option value="lainnya">Lainnya</option>
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={handleTolak}
                    disabled={!tolakAlasan || actionLoading}
                    className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-[#991B1B] disabled:opacity-40"
                  >
                    {actionLoading ? "Memproses..." : "Konfirmasi Tolak"}
                  </button>
                  <button
                    onClick={() => {
                      setShowTolak(false);
                      setTolakAlasan("");
                    }}
                    className="flex-1 py-2 border border-[#C0CEDF] rounded-lg text-sm"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Footer actions */}
        <footer className="shrink-0 bg-white border-t border-[#D0DAE8] p-4 flex gap-3">
          {user?.role === "petugas_eksekusi" ? (
            <>
              {report.status === "Disetujui" && (
                <button
                  onClick={handleMulai}
                  disabled={actionLoading}
                  className="flex-1 h-11 bg-[#2563EB] text-white font-bold rounded-lg text-sm flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40"
                >
                  <Icon name="play_arrow" className="!text-[20px]" filled />
                  {actionLoading ? "Memproses..." : "Mulai Pengerjaan"}
                </button>
              )}
              {report.status === "Sedang Diperbaiki" && (
                <Link
                  to="/complete-report"
                  search={{ reportId: report.id }}
                  className="flex-1 h-11 bg-primary text-white font-bold rounded-lg text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <Icon name="check_circle" className="!text-[20px]" filled />
                  Selesaikan
                </Link>
              )}
              {report.status === "Selesai" && (
                <Link
                  to="/petugas-eksekusi"
                  className="flex-1 h-11 bg-primary text-white font-bold rounded-lg text-sm flex items-center justify-center"
                >
                  Kembali ke Tugas Saya
                </Link>
              )}
              {report.status !== "Disetujui" &&
                report.status !== "Sedang Diperbaiki" &&
                report.status !== "Selesai" && (
                  <Link
                    to="/petugas-eksekusi"
                    className="flex-1 h-11 bg-primary text-white font-bold rounded-lg text-sm flex items-center justify-center"
                  >
                    Kembali ke Tugas Saya
                  </Link>
                )}
            </>
          ) : (
            <>
              {(report.status === "Menunggu Review" || report.status === "Ditinjau") && (
                <>
                  <button
                    onClick={() => setShowTolak(true)}
                    disabled={actionLoading}
                    className="flex-1 h-11 border-2 border-rusak-berat text-rusak-berat font-bold rounded-lg text-sm active:scale-95 transition-all disabled:opacity-40"
                  >
                    Tolak Laporan
                  </button>
                  <button
                    onClick={handleSetujui}
                    disabled={actionLoading}
                    className="flex-[2] h-11 bg-primary text-white font-bold rounded-lg text-sm flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40"
                  >
                    <Icon name="check_circle" className="!text-[20px]" filled />
                    {actionLoading ? "Memproses..." : "Setujui"}
                  </button>
                </>
              )}
              {report.status === "Selesai" && (
                <>
                  <button
                    onClick={handleReopen}
                    disabled={actionLoading}
                    className="flex-1 h-11 border-2 border-amber-500 text-amber-600 font-bold rounded-lg text-sm active:scale-95 transition-all disabled:opacity-40"
                  >
                    {actionLoading ? "Memproses..." : "↺ Re-open"}
                  </button>
                  <Link
                    to="/supervisor"
                    className="flex-[2] h-11 bg-primary text-white font-bold rounded-lg text-sm flex items-center justify-center"
                  >
                    Kembali ke Dashboard
                  </Link>
                </>
              )}
              {report.status === "Disetujui" && !showSatgasPicker && (
                <button
                  onClick={() => { setShowSatgasPicker(true); fetchUprList(); }}
                  className="flex-1 h-11 bg-primary text-white font-bold rounded-lg text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <Icon name="play_arrow" className="!text-[20px]" filled />
                  Mulai Pengerjaan
                </button>
              )}
              {showSatgasPicker && (
                <div className="flex flex-col gap-3 w-full">
                  <div className="flex items-center gap-2">
                    <Icon name="groups" className="text-primary !text-[18px]" />
                    <h3 className="font-label-md font-bold text-on-surface">Pilih Satgas</h3>
                  </div>
                  <select
                    value={satgasUprId}
                    onChange={(e) => setSatgasUprId(e.target.value)}
                    className="w-full border border-[#C0CEDF] rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="">-- Pilih Satgas --</option>
                    {uprList.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                  <textarea
                    value={satgasCatatan}
                    onChange={(e) => setSatgasCatatan(e.target.value)}
                    placeholder="Catatan untuk petugas eksekusi (opsional)..."
                    className="w-full border border-[#C0CEDF] rounded-lg p-3 text-sm bg-slate-50 min-h-[64px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowSatgasPicker(false); setSatgasUprId(""); setSatgasCatatan(""); }}
                      className="flex-1 h-11 border border-[#C0CEDF] rounded-lg text-sm font-bold"
                    >
                      Batal
                    </button>
                    <button
                      onClick={handleMulaiWithSatgas}
                      disabled={!satgasUprId || actionLoading}
                      className="flex-[2] h-11 bg-primary text-white font-bold rounded-lg text-sm flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40"
                    >
                      <Icon name="play_arrow" className="!text-[20px]" filled />
                      {actionLoading ? "Memproses..." : "Mulai Pengerjaan"}
                    </button>
                  </div>
                </div>
              )}
              {report.status !== "Menunggu Review" &&
                report.status !== "Ditinjau" &&
                report.status !== "Selesai" &&
                !showSatgasPicker && (
                  <Link
                    to="/supervisor"
                    className="flex-1 h-11 bg-primary text-white font-bold rounded-lg text-sm flex items-center justify-center"
                  >
                    Kembali ke Dashboard
                  </Link>
                )}
            </>
          )}
        </footer>
      </div>
    </PageLayout>
  );
}

// ── Before/After Section ──

function BeforeAfterSection({
  report,
  afterPhotoUrl,
  afterPhotoNotes,
}: {
  report: Laporan;
  afterPhotoUrl: string | null | undefined;
  afterPhotoNotes: string | null | undefined;
}) {
  if (!afterPhotoUrl) return null;

  const damagedPhotos = (report.photos ?? []).filter(
    (p) => (p.total_detections ?? 0) > 0 && p.ai_severity,
  );
  const hasSingleBefore = report.image_original_url || report.first_photo_url;
  const hasDamaged = damagedPhotos.length > 0 || !!hasSingleBefore;

  if (!hasDamaged) {
    return (
      <div className="bg-white rounded-lg border border-[#D0DAE8] overflow-hidden">
        <div className="p-3 border-b border-[#D0DAE8]">
          <h3 className="font-label-md font-bold text-on-surface">Foto Setelah Perbaikan</h3>
        </div>
        <ImageWithLoading src={afterPhotoUrl} alt="After repair" wrapperClassName="relative bg-slate-100" preserveAspect />
        {afterPhotoNotes && (
          <div className="p-3 border-t border-[#D0DAE8]">
            <p className="text-xs text-slate-600">{afterPhotoNotes}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-[#D0DAE8] overflow-hidden">
      <div className="p-3 border-b border-[#D0DAE8]">
        <h3 className="font-label-md font-bold text-on-surface">Perbandingan Sebelum & Sesudah</h3>
      </div>
      <div className="p-3 flex flex-col gap-4">
        {damagedPhotos.length > 0 ? (
          damagedPhotos.map((p, i) => (
            <div key={p.id}>
              <p className="text-[11px] font-semibold text-slate-500 mb-1.5">
                Foto #{p.sort_order ?? i + 1} — {p.ai_jenis_kerusakan ?? "Kerusakan"}
              </p>
              <BeforeAfterSlider beforeSrc={p.image_original_url ?? ""} afterSrc={afterPhotoUrl} />
            </div>
          ))
        ) : (
          <BeforeAfterSlider beforeSrc={hasSingleBefore!} afterSrc={afterPhotoUrl} />
        )}
      </div>
      {afterPhotoNotes && (
        <div className="p-3 border-t border-[#D0DAE8]">
          <p className="text-xs text-slate-600">{afterPhotoNotes}</p>
        </div>
      )}
    </div>
  );
}
