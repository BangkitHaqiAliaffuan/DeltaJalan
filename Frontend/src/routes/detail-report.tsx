import { createFileRoute, Link } from "@tanstack/react-router";
import { Icon } from "@/components/jk/Icon";
import { TrustBadge } from "@/components/jk/TrustBadge";
import { useState, useEffect } from "react";
import { AppLayout } from "@/components/jk/AppLayout";
import { API_BASE_URL } from "@/lib/aiStore";
import { getToken, getCurrentUser } from "@/lib/auth";
import type { Laporan, TrustLabel } from "@/types/laporan";
import { ImageWithLoading } from "@/components/jk/ImageWithLoading";
import { ReportMap, type ReportMapPoint } from "@/components/jk/ReportMap";

export const Route = createFileRoute("/detail-report")({
  component: DetailReportPage,
  validateSearch: (search: Record<string, unknown>) => {
    const reportId = search.reportId as string | undefined;
    return { ...(reportId ? { reportId } : {}) };
  },
  head: () => ({ meta: [{ title: "Detail Laporan — DeltaJalan" }] }),
});

function DetailReportPage() {
  const { reportId } = Route.useSearch();
  const token = getToken() ?? "";
  const user = getCurrentUser();

  const [report, setReport] = useState<Laporan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      if (!res.ok) throw new Error("Gagal memuat laporan.");
      const json = await res.json();
      setReport(json.data ?? null);
    } catch {
      setError("Gagal memuat data laporan.");
    } finally {
      setLoading(false);
    }
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

  function statusBadge(s: string) {
    const map: Record<string, string> = {
      "Menunggu Review": "bg-amber-50 text-amber-700 border-amber-200",
      Ditinjau: "bg-amber-50 text-amber-700 border-amber-200",
      Disetujui: "bg-blue-50 text-blue-700 border-blue-200",
      Ditolak: "bg-red-50 text-red-700 border-red-200",
      "Sedang Diperbaiki": "bg-blue-50 text-blue-700 border-blue-200",
      Selesai: "bg-green-50 text-green-700 border-green-200",
      Diedit: "bg-gray-50 text-gray-700 border-gray-200",
    };
    return map[s] ?? "bg-gray-50 text-gray-600 border-gray-200";
  }

  function displayStatus(s: string) {
    return s === "Ditinjau" ? "Menunggu Review" : s;
  }

  const detections: { type: string; confidence: number }[] =
    (report?.ai_raw_output as Array<{ type: string; confidence: number }> | null) ?? [];

  const topDetection = detections[0] ?? null;
  const hasImage = report?.image_original_url || report?.image_result_url;
  const sev = report?.overall_severity ?? report?.ai_severity;

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <span className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (error || !report) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-screen gap-3 px-4">
          <Icon name="error" className="!text-5xl text-red-400 opacity-50" />
          <p className="text-[#476788]">{error || "Laporan tidak ditemukan."}</p>
          <Link
            to={user?.role === "petugas" ? "/home" : "/"}
            className="text-primary text-sm font-bold"
          >
            Kembali
          </Link>
        </div>
      </AppLayout>
    );
  }

  const mapPoints: ReportMapPoint[] =
    report.latitude && report.longitude
      ? [{ lat: report.latitude, lng: report.longitude, label: report.road_name }]
      : [];

  return (
    <AppLayout>
      <div className="flex flex-col h-screen w-full">
        <header className="shrink-0 bg-white border-b border-[#D0DAE8] flex justify-between items-center px-4 h-14">
          <div className="flex items-center gap-3">
            <Link to="/my-reports">
              <Icon name="arrow_back" className="text-primary" />
            </Link>
            <h1 className="font-headline-sm text-[17px] font-bold text-on-surface">
              Detail Laporan
            </h1>
          </div>
          <span className="font-id-code text-[12px] text-slate-400">{report.report_code}</span>
        </header>

        <main className="flex-1 overflow-y-auto min-h-0 p-4 flex flex-col gap-4">
          {/* Status */}
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-lg text-label-sm font-bold border ${statusBadge(report.status)}`}
            >
              {displayStatus(report.status)}
            </span>
            {sev && sev !== "Baik" && (
              <span
                className={`px-3 py-1 rounded-lg text-label-sm font-bold border ${severityBadge(sev)}`}
              >
                {sev}
              </span>
            )}
            <TrustBadge
              score={report.trust_score}
              label={(report.trust_label as TrustLabel) ?? "merah"}
            />
          </div>

          {/* Info laporan */}
          <div className="bg-white rounded-lg border border-[#D0DAE8] p-4">
            <h2 className="font-headline-sm text-base font-bold text-on-surface mb-3">
              {report.road_name}
            </h2>
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-[#476788]">
                <Icon name="location_pin" className="!text-[18px]" />
                <span className="text-[13px]">Kec. {report.district}</span>
              </div>
              {report.assigned_upr_name && (
                <div className="flex items-center gap-2 text-[#476788]">
                  <Icon name="group" className="!text-[18px]" />
                  <span className="text-[13px]">UPR: {report.assigned_upr_name}</span>
                </div>
              )}
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
                <div className="flex items-center gap-2 text-[#476788]">
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
              {report.catatan_petugas && (
                <div className="flex items-start gap-2 text-[#476788]">
                  <Icon name="edit_note" className="!text-[18px] shrink-0 mt-0.5" />
                  <span className="text-[13px]">{report.catatan_petugas}</span>
                </div>
              )}
              {report.perbaikan_dimulai_at && (
                <div className="flex items-center gap-2 text-[#476788]">
                  <Icon name="construction" className="!text-[18px]" />
                  <span className="text-[13px]">
                    Dimulai:{" "}
                    {new Date(report.perbaikan_dimulai_at).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
              )}
              {report.perbaikan_selesai_at && (
                <div className="flex items-center gap-2 text-[#476788]">
                  <Icon name="check_circle" className="!text-[18px]" />
                  <span className="text-[13px]">
                    Selesai:{" "}
                    {new Date(report.perbaikan_selesai_at).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Foto & Hasil AI */}
          {hasImage && (
            <div className="bg-white rounded-lg border border-[#D0DAE8] overflow-hidden">
              <ImageWithLoading
                src={report.image_result_url ?? report.image_original_url ?? ""}
                alt="Road damage"
                wrapperClassName="relative aspect-video bg-slate-100"
              />
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-label-md text-on-surface font-bold">Hasil Deteksi AI</h3>
                </div>
                {topDetection ? (
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-[11px] text-on-surface-variant mb-1">Jenis Kerusakan</p>
                      <p className="text-sm font-semibold text-on-surface">{topDetection.type}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-on-surface-variant mb-1">Confidence</p>
                      <p className="text-sm font-semibold text-on-surface">
                        {(topDetection.confidence * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-on-surface-variant">Tidak ada deteksi AI</p>
                )}
                {detections.length > 0 && (
                  <div className="space-y-2">
                    {detections.map((d, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between py-1.5 border-t border-gray-100"
                      >
                        <span className="text-[13px] text-on-surface-variant">{d.type}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${Math.round(d.confidence * 100)}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-on-surface-variant w-9 text-right">
                            {(d.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Lokasi */}
          {mapPoints.length > 0 && (
            <div className="bg-white rounded-lg border border-[#D0DAE8] overflow-hidden">
              <div className="p-4 pb-0">
                <h3 className="font-label-md text-on-surface font-bold mb-1">Informasi Lokasi</h3>
                {report.latitude && report.longitude && (
                  <p className="text-[11px] text-on-surface-variant mb-3">
                    {report.latitude.toFixed(6)}, {report.longitude.toFixed(6)}
                  </p>
                )}
              </div>
              <div className="h-48" style={{ isolation: "isolate" }}>
                <ReportMap
                  points={mapPoints}
                  center={[report.latitude!, report.longitude!]}
                  zoom={16}
                />
              </div>
            </div>
          )}

          {/* Batch photos */}
          {report.photos && report.photos.length > 0 && (
            <div className="bg-white rounded-lg border border-[#D0DAE8] p-4">
              <h3 className="font-label-md text-on-surface font-bold mb-3">
                Foto Batch ({report.photos.length})
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {report.photos.map((p) => (
                  <div key={p.id} className="aspect-square rounded-lg overflow-hidden bg-gray-50">
                    {p.image_original_url ? (
                      <img
                        src={p.image_original_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Icon name="photo" className="text-gray-300" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>

        {/* Footer — back button only */}
        <footer className="shrink-0 bg-white border-t border-[#D0DAE8] p-4">
          <Link
            to="/my-reports"
            className="w-full h-11 bg-primary text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#163F6E] transition-colors"
          >
            <Icon name="arrow_back" className="!text-lg" />
            Kembali ke Laporan Saya
          </Link>
        </footer>
      </div>
    </AppLayout>
  );
}
