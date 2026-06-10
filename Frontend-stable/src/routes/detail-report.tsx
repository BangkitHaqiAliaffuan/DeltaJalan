import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Icon } from "@/components/jk/Icon";
import { TrustBadge } from "@/components/jk/TrustBadge";
import { SkeletonDetailReport } from "@/components/jk/Skeleton";
import { PageLayout } from "@/components/jk/PageLayout";
import { API_BASE_URL } from "@/lib/aiStore";
import { getToken, getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import type { Laporan, TimelineEvent, TrustLabel } from "@/types/laporan";
import { ReportMap, type ReportMapPoint } from "@/components/jk/ReportMap";
import { TimelineCard } from "@/components/jk/TimelineCard";
import { BeforeAfterSlider } from "@/components/jk/BeforeAfterSlider";

export const Route = createFileRoute("/detail-report")({
  component: DetailReportPage,
  validateSearch: (search: Record<string, unknown>) => {
    const reportId = search.reportId as string | undefined;
    return { ...(reportId ? { reportId } : {}) };
  },
  head: () => ({ meta: [{ title: "Detail Laporan — DeltaJalan" }] }),
});

function displayStatus(s: string): string {
  return s === "Ditinjau" ? "Menunggu Review" : s;
}

interface SliderPhoto {
  url: string;
  label: string;
}

function collectPhotos(r: Laporan): SliderPhoto[] {
  const photos: SliderPhoto[] = [];
  if (r.photos && r.photos.length > 0) {
    r.photos.forEach((p, i) => {
      if (p.image_original_url) photos.push({ url: p.image_original_url, label: `Foto ${i + 1}` });
      if (p.image_result_url && p.image_result_url !== p.image_original_url)
        photos.push({ url: p.image_result_url, label: `Hasil AI ${i + 1}` });
    });
  } else {
    if (r.image_original_url) photos.push({ url: r.image_original_url, label: "Foto Asli" });
    if (r.image_result_url && r.image_result_url !== r.image_original_url)
      photos.push({ url: r.image_result_url, label: "Hasil Deteksi AI" });
  }
  if (r.after_photo_url) photos.push({ url: r.after_photo_url, label: "Setelah Perbaikan" });
  return photos;
}

const SEVERITY_STYLES: Record<string, { badge: string; dot: string }> = {
  "Rusak Berat": { badge: "bg-[#E11D48] text-white", dot: "bg-white animate-pulse" },
  "Rusak Sedang": { badge: "bg-orange-50 text-[#F97316] border border-orange-200", dot: "bg-white" },
  "Rusak Ringan": { badge: "bg-amber-50 text-[#F59E0B] border border-amber-200", dot: "bg-white" },
  Baik: { badge: "bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7]", dot: "bg-[#2E7D32]" },
};

function getSevStyle(sev: string | undefined | null) {
  return SEVERITY_STYLES[sev ?? ""] ?? SEVERITY_STYLES.Baik;
}

const STATUS_STYLES: Record<string, string> = {
  "Menunggu Review": "bg-amber-50 text-[#F59E0B] border border-amber-200",
  Ditinjau: "bg-amber-50 text-[#F59E0B] border border-amber-200",
  Disetujui: "bg-blue-50 text-[#2563EB] border border-blue-200",
  Ditolak: "bg-[#E11D48] text-white",
  "Sedang Diperbaiki": "bg-orange-50 text-[#F97316] border border-orange-200",
  Selesai: "bg-[#10B981] text-white",
  Diedit: "bg-slate-50 text-[#64748B] border border-slate-200",
};

function getStatusStyle(s: string): string {
  return STATUS_STYLES[s] ?? STATUS_STYLES["Menunggu Review"];
}

// ── Photo Slider Component ──

function PhotoSlider({ photos }: { photos: SliderPhoto[] }) {
  const [idx, setIdx] = useState(0);
  const [loaded, setLoaded] = useState<Set<number>>(new Set([0]));
  const [naturalAspect, setNaturalAspect] = useState<number | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const goTo = useCallback((i: number) => {
    const next = (i + photos.length) % photos.length;
    setIdx(next);
    setNaturalAspect(null);
    setLoaded((prev) => new Set(prev).add(next));
  }, [photos.length]);

  const prev = useCallback(() => goTo(idx - 1), [goTo, idx]);
  const next = useCallback(() => goTo(idx + 1), [goTo, idx]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prev, next]);

  function handleImgLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight && !naturalAspect) {
      setNaturalAspect(img.naturalWidth / img.naturalHeight);
    }
  }

  if (photos.length === 0) return null;

  return (
    <div className="relative bg-[#0F172A] rounded-xl overflow-hidden">
      <div
        className="relative w-full"
        style={naturalAspect ? { aspectRatio: `${naturalAspect}` } : { aspectRatio: "16 / 9" }}
      >
        {photos.map((p, i) => (
          <img
            key={i}
            ref={i === idx ? imgRef : undefined}
            src={p.url}
            alt={p.label}
            loading={loaded.has(i) ? "eager" : "lazy"}
            className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-300 ${
              i === idx ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            onLoad={(e) => {
              setLoaded((prev) => new Set(prev).add(i));
              handleImgLoad(e);
            }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ))}
        {!loaded.has(idx) && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}
      </div>

      {photos.length > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center transition-colors"
            aria-label="Foto sebelumnya"
          >
            <Icon name="chevron_left" className="!text-[20px] text-white" />
          </button>
          <button
            type="button"
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center transition-colors"
            aria-label="Foto berikutnya"
          >
            <Icon name="chevron_right" className="!text-[20px] text-white" />
          </button>

          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
            <div className="flex items-center justify-between">
              <p className="text-white text-[12px] font-medium">{photos[idx].label}</p>
              <p className="text-white/60 text-[11px]">{idx + 1}/{photos.length}</p>
            </div>
            <div className="flex gap-1.5 mt-2">
              {photos.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => goTo(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === idx ? "w-5 bg-white" : "w-1.5 bg-white/40 hover:bg-white/60"
                  }`}
                  aria-label={`Foto ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Page ──

function DetailReportPage() {
  const { reportId } = Route.useSearch();
  const token = getToken() ?? "";
  const [backPath, setBackPath] = useState("/my-reports");
  useEffect(() => {
    const u = getCurrentUser();
    setBackPath(u?.role === "supervisor" ? "/supervisor" : u?.role === "petugas_eksekusi" ? "/petugas-eksekusi" : "/my-reports");
  }, []);

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

  const sliderPhotos = useMemo(() => (report ? collectPhotos(report) : []), [report]);

  const sev = report?.overall_severity ?? report?.ai_severity;
  const sevStyle = getSevStyle(sev);
  const statusStyle = getStatusStyle(report?.status ?? "");

  const detections =
    (report?.ai_raw_output as Array<{ type: string; confidence: number }> | null) ?? [];

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
          <main aria-busy="true" aria-label="Memuat detail laporan">
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

  // ── Content ──

  return (
    <PageLayout
      back={backPath}
      title="Detail Laporan"
      right={<span className="font-id-code text-[12px] text-[#64748B]">{report.report_code}</span>}
    >
        <main>
          <div className="max-w-2xl mx-auto p-4 flex flex-col gap-4">

            {/* ── Photo Slider ── */}
            <PhotoSlider photos={sliderPhotos} />

            {/* ── Before/After Slider ── */}
            <DetailBeforeAfter report={report} />

            {/* ── Badges ── */}
            <div className="flex flex-wrap items-center gap-2">
              {sev && (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${sevStyle.badge}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${sevStyle.dot}`} />
                  {sev}
                </span>
              )}
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${statusStyle}`}>
                {displayStatus(report.status)}
              </span>
              <TrustBadge
                score={report.trust_score}
                label={(report.trust_label as TrustLabel) ?? "merah"}
              />
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

            {/* ── Hasil Deteksi AI ── */}
            {detections.length > 0 && (
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
                <h3 className="font-label-md text-[13px] font-bold text-[#0F172A] mb-3">
                  Hasil Deteksi AI
                </h3>
                <div className="space-y-2.5">
                  {detections.map((d, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-[11px] font-semibold text-[#64748B] w-5 shrink-0">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="flex-1 text-[13px] text-[#0F172A] truncate">{d.type}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="w-16 h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#1A4F8A] rounded-full transition-all"
                            style={{ width: `${Math.round(d.confidence * 100)}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-[#64748B] w-8 text-right font-medium">
                          {(d.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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

        {/* ── Footer ── */}
        <footer className="shrink-0 bg-white border-t border-[#E2E8F0] p-4">
          <Link
            to={backPath}
            className="w-full h-11 bg-[#1A4F8A] text-white rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 hover:bg-[#153d6e] transition-colors"
          >
            <Icon name="arrow_back" className="!text-[18px]" />
            Kembali
          </Link>
        </footer>
    </PageLayout>
  );
}

// ── Sub-components ──

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
              />
            </div>
          ))
        ) : (
          <BeforeAfterSlider
            beforeSrc={singleBefore!}
            afterSrc={report.after_photo_url}
          />
        )}
      </div>
    </div>
  );
}
