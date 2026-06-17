import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Icon } from "@/components/jk/Icon";

import { ReportMap, type ReportMapPoint } from "@/components/jk/ReportMap";
import { TimelineCard } from "@/components/jk/TimelineCard";
import { BeforeAfterSlider } from "@/components/jk/BeforeAfterSlider";
import { ImageWithLoading } from "@/components/jk/ImageWithLoading";
import { useBlobImage } from "@/hooks/useBlobImage";
import { formatDate, severityBadgeStyle, severityDotStyle, statusBadgeStyle, displayStatus } from "@/lib/format";
import type { Laporan, TrustLabel, TimelineEvent, PriorityLevel } from "@/types/laporan";
import { BadgeStatCard, severityIcon, statusIcon, trustIcon, statusGradient, statusBorder, statusIconColor, statusTextColor, trustLabel, trustGradient, trustBorder, trustIconColor, trustTextColor } from "@/components/jk/StatCard";

// ── Types ──

interface SliderPhoto {
  url: string;
  label: string;
}

export interface ReportDetailProps {
  report: Laporan;
  userRole: string;

  // Section visibility
  showStepper?: boolean;
  showEvidence?: boolean;
  showDetailedAI?: boolean;
  showAssignment?: boolean;
  showCatatan?: boolean;

  // Supervisor evaluation form (shown when status = Menunggu Review / Ditinjau)
  priority?: string;
  catatanSupervisor?: string;
  onPriorityChange?: (p: "Rendah" | "Sedang" | "Tinggi") => void;
  onCatatanSupervisorChange?: (v: string) => void;
}

// ── Helpers ──

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

function statusStep(s: string) {
  const n = s === "Ditinjau" || s === "Diedit" ? "Menunggu Review" : s;
  const steps = ["Menunggu Review", "Disetujui", "Sedang Diperbaiki", "Selesai"];
  const idx = steps.indexOf(n);
  return idx >= 0 ? idx + 1 : 0;
}

// ── Photo Slider Sub-component ──

function SliderImg({ url, alt, onLoad, onError, className, imgRef: externalRef }: {
  url: string; alt: string; onLoad: React.ReactEventHandler<HTMLImageElement>; onError: React.ReactEventHandler<HTMLImageElement>;
  className: string; imgRef?: React.Ref<HTMLImageElement>;
}) {
  const blobSrc = useBlobImage(url);
  return (
    <img
      ref={externalRef}
      src={blobSrc}
      alt={alt}
      className={className}
      onLoad={onLoad}
      onError={onError}
    />
  );
}

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
          <SliderImg
            key={i}
            url={p.url}
            alt={p.label}
            imgRef={i === idx ? imgRef : undefined}
            className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-300 ${
              i === idx ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            onLoad={(e) => {
              setLoaded((prev) => new Set(prev).add(i));
              handleImgLoad(e);
            }}
            onError={() => {}}
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

// ── Progress Stepper ──

function ProgressStepper({ report, rejected }: { report: Laporan; rejected: boolean }) {
  const step = statusStep(report.status);
  const steps = [
    { l: "Laporan Masuk", done: step > 1 || rejected, active: step === 1 },
    { l: "Review", done: step > 2 || rejected, active: !rejected && step === 2 },
    { l: "Disposisi", done: step > 3, active: !rejected && step === 3 },
    { l: "Selesai", done: step > 4, active: !rejected && step === 4 },
  ];
  const rejectedStep = { l: "Ditolak", done: false, active: rejected };
  const displaySteps = rejected ? [...steps.slice(0, 2), rejectedStep] : steps;

  return (
    <section className="bg-surface-container-lowest px-4 py-3 flex items-center justify-between overflow-x-auto hide-scrollbar border-b border-border-subtle">
      {displaySteps.map((s, i, arr) => (
        <div key={s.l} className="flex items-center flex-1">
          <div className="flex flex-col items-center gap-1 min-w-[64px]">
            {s.l === "Ditolak" ? (
              <div className="w-5 h-5 rounded-full bg-error flex items-center justify-center">
                <Icon name="close" className="!text-[14px] text-white" />
              </div>
            ) : s.done ? (
              <div className="w-5 h-5 rounded-full bg-selesai flex items-center justify-center">
                <Icon name="check" className="!text-[14px] text-white" />
              </div>
            ) : s.active ? (
              <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-white" />
              </div>
            ) : (
              <div className="w-5 h-5 rounded-full border-2 border-border-subtle" />
            )}
            <span className={`font-label-sm text-[10px] text-center whitespace-nowrap ${
              s.l === "Ditolak" ? "text-error font-bold" :
              s.active ? "text-primary font-bold" :
              s.done ? "text-on-surface-variant" : "text-slate-400"
            }`}>
              {s.l}
            </span>
          </div>
          {i < arr.length - 1 && (
            <div className={`h-px flex-1 mx-1 min-w-[20px] ${
              s.l === "Ditolak" ? "bg-error" :
              s.done ? "bg-selesai" :
              s.active ? "bg-primary" : "bg-border-subtle"
            }`} />
          )}
        </div>
      ))}
    </section>
  );
}

// ── Report Detail Content ──

export function ReportDetail({
  report,
  userRole,
  showStepper = false,
  showEvidence = false,
  showDetailedAI = false,
  showAssignment = false,
  showCatatan = false,
  priority,
  catatanSupervisor,
  onPriorityChange,
  onCatatanSupervisorChange,
}: ReportDetailProps) {
  const sev = report.overall_severity ?? report.ai_severity;
  const detections = (report.ai_raw_output as Array<{ type: string; confidence: number }> | null) ?? [];
  const sliderPhotos = useMemo(() => collectPhotos(report), [report]);
  const hasTimeline = (report.status_history?.length ?? 0) > 0;
  const rejected = report.status === "Ditolak";
  const needsSupervisorForm = (report.status === "Menunggu Review" || report.status === "Ditinjau") && userRole === "supervisor";
  const isNonSupervisor = userRole !== "supervisor";

  // Map points
  const mapPoints: ReportMapPoint[] = [];
  if (report.latitude && report.longitude) {
    mapPoints.push({ label: report.road_name, lat: report.latitude, lng: report.longitude, reportCode: report.report_code });
  }
  if (showDetailedAI && report.photos) {
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

  return (
    <div className="flex flex-col">
      {/* Progress Stepper (non-supervisor only) */}
      {showStepper && isNonSupervisor && (
        <ProgressStepper report={report} rejected={rejected} />
      )}

      <main className="p-4 flex flex-col gap-4">
        {/* Photo Slider */}
        {sliderPhotos.length > 0 && <PhotoSlider photos={sliderPhotos} />}

        {/* Badges — Stats Cards */}
        <div className="grid grid-cols-3 gap-3">
          {/* Severity Card */}
          {sev && sev !== "Baik" && (
            <BadgeStatCard
              iconName={severityIcon(sev)}
              value={sev === "berat" ? "Berat" : sev === "sedang" ? "Sedang" : "Ringan"}
              label="Tingkat Keparahan"
              gradientFrom={sev === "berat" ? "#FEF2F2" : sev === "sedang" ? "#FFF7ED" : "#FFFBEB"}
              gradientTo="white"
              borderColor={sev === "berat" ? "#FECACA" : sev === "sedang" ? "#FED7AA" : "#FDE68A"}
              iconColor={sev === "berat" ? "#DC2626" : sev === "sedang" ? "#EA580C" : "#D97706"}
              textColor={sev === "berat" ? "#991B1B" : sev === "sedang" ? "#9A3412" : "#92400E"}
            />
          )}

          {/* Status Card */}
          <BadgeStatCard
            iconName={statusIcon(report.status)}
            value={displayStatus(report.status)}
            label="Status Laporan"
            gradientFrom={statusGradient(report.status)}
            gradientTo="white"
            borderColor={statusBorder(report.status)}
            iconColor={statusIconColor(report.status)}
            textColor={statusTextColor(report.status)}
          />

          {/* Trust Score Card */}
          <BadgeStatCard
            iconName={trustIcon(report.trust_label as TrustLabel)}
            value={`${report.trust_score}`}
            label={trustLabel(report.trust_label as TrustLabel)}
            gradientFrom={trustGradient(report.trust_label as TrustLabel)}
            gradientTo="white"
            borderColor={trustBorder(report.trust_label as TrustLabel)}
            iconColor={trustIconColor(report.trust_label as TrustLabel)}
            textColor={trustTextColor(report.trust_label as TrustLabel)}
            suffix="/100"
          />
        </div>

        {/* Info Jalan */}
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

        {/* Evidence Photos */}
        {showEvidence && (report as any).evidences?.length > 0 && (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <h3 className="font-label-md text-[13px] font-bold text-[#0F172A] mb-3">Foto Bukti Tambahan</h3>
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

        {/* Before/After Per-photo AI Comparison */}
        {showDetailedAI && report.photos && report.photos.length > 0 && (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Icon name="compare_arrows" className="text-primary !text-[18px]" />
              <h3 className="font-label-md font-bold text-[#0F172A]">Perbandingan Original & AI</h3>
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
                    <BeforeAfterSlider beforeSrc={origUrl} afterSrc={detUrl} beforeLabel="Original" afterLabel="Deteksi AI" />
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                      {(photo.kerusakan_panjang || photo.kerusakan_lebar) && (
                        <p className="text-[10px] text-slate-500">
                          {photo.kerusakan_panjang ? `${photo.kerusakan_panjang} m` : ""}
                          {photo.kerusakan_panjang && photo.kerusakan_lebar ? " × " : ""}
                          {photo.kerusakan_lebar ? `${photo.kerusakan_lebar} m` : ""}
                          {photo.kerusakan_panjang && photo.kerusakan_lebar ? ` (${(photo.kerusakan_panjang * photo.kerusakan_lebar).toFixed(1)} m²)` : ""}
                        </p>
                      )}
                      {photo.ai_severity ? (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                          photo.ai_severity === "berat" ? "bg-[#E11D48] text-white" :
                          photo.ai_severity === "sedang" ? "bg-orange-50 text-[#F97316] border border-orange-200" :
                          "bg-amber-50 text-[#F59E0B] border border-amber-200"
                        }`}>
                          {photo.ai_severity === "berat" ? "Rusak Berat" : photo.ai_severity === "sedang" ? "Rusak Sedang" : "Rusak Ringan"}
                        </span>
                      ) : null}
                      {photo.ai_confidence != null && (
                        <p className="text-[10px] text-slate-400">{(photo.ai_confidence * 100).toFixed(0)}% confidence</p>
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
        )}

        {/* Before/After Section (after_photo_url) */}
        <DetailBeforeAfter report={report} />

        {/* Assignment Info */}
        {showAssignment && (report.status === "Disetujui" || report.status === "Sedang Diperbaiki" || report.status === "Selesai") && (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Icon name="group" className="text-primary !text-[18px]" />
              <h3 className="font-label-md font-bold text-[#0F172A]">Informasi Penugasan</h3>
            </div>
            <div className="space-y-2 text-xs text-slate-700">
              {report.assigned_upr_name && (
                <div className="flex items-center gap-2"><span className="font-semibold">UPR:</span><span>{report.assigned_upr_name}</span></div>
              )}
              {(report as any).assigned_at && (
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Ditugaskan:</span>
                  <span>{formatDate((report as any).assigned_at, { withTime: true })}</span>
                </div>
              )}
              {(report as any).perbaikan_dimulai_at && (
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Mulai:</span>
                  <span>{formatDate((report as any).perbaikan_dimulai_at, { withTime: true })}</span>
                </div>
              )}
              {(report as any).perbaikan_selesai_at && (
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Selesai:</span>
                  <span>{formatDate((report as any).perbaikan_selesai_at, { withTime: true })}</span>
                </div>
              )}
              {(report as any).pelaksana && (
                <div className="flex items-center gap-2"><span className="font-semibold">Pelaksana:</span><span>{(report as any).pelaksana}</span></div>
              )}
            </div>
          </div>
        )}

        {/* Timeline */}
        {hasTimeline && <TimelineCard events={report.status_history as TimelineEvent[]} />}

        {/* AI Detections */}
        {detections.length > 0 && (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <h3 className="font-label-md text-[13px] font-bold text-[#0F172A] mb-3">Hasil Deteksi AI</h3>
            <div className="space-y-2.5">
              {detections.map((d, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-[11px] font-semibold text-[#64748B] w-5 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                  <span className="flex-1 text-[13px] text-[#0F172A] truncate">{d.type}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-16 h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                      <div className="h-full bg-[#1A4F8A] rounded-full transition-all" style={{ width: `${Math.round(d.confidence * 100)}%` }} />
                    </div>
                    <span className="text-[11px] text-[#64748B] w-8 text-right font-medium">{(d.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Catatan Petugas */}
        {showCatatan && report.catatan_petugas && (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="edit_note" className="text-primary !text-[18px]" />
              <h3 className="font-label-md font-bold text-[#0F172A]">Catatan Petugas</h3>
            </div>
            <p className="text-xs text-slate-700 whitespace-pre-wrap">{report.catatan_petugas}</p>
          </div>
        )}

        {/* Map */}
        {report.latitude && report.longitude && (
          <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
            <div className="p-4 pb-2">
              <h3 className="font-label-md text-[13px] font-bold text-[#0F172A]">Lokasi</h3>
              {report.latitude && report.longitude && (
                <p className="text-[11px] text-[#64748B] mt-0.5 font-mono">
                  {report.latitude.toFixed(6)}, {report.longitude.toFixed(6)}
                </p>
              )}
              <a
                href={`https://www.google.com/maps?q=${report.latitude},${report.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-blue-600 underline inline-block mt-0.5"
              >
                Buka di Google Maps
              </a>
            </div>
            {mapPoints.length > 0 && (
              <div className="border-t border-[#E2E8F0] h-48" style={{ isolation: "isolate" }}>
                <ReportMap points={mapPoints} />
              </div>
            )}
          </div>
        )}

        {/* Penilaian Supervisor */}
        {needsSupervisorForm && (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Icon name="edit_note" className="text-primary" />
                <h3 className="font-label-md font-bold text-[#0F172A]">Penilaian Supervisor</h3>
              </div>
              <span className="bg-orange-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">Wajib Diisi</span>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-slate-600 mb-2.5">Prioritas Penanganan</label>
                <div className="flex gap-2">
                  {(["Rendah", "Sedang", "Tinggi"] as const).map((p) => {
                    const active = priority === p;
                    return (
                      <button
                        key={p}
                        onClick={() => onPriorityChange?.(p)}
                        className={`flex-1 py-2 text-[12px] font-semibold rounded-lg border ${
                          active ? (p === "Tinggi" ? "bg-rusak-berat text-white border-transparent" : "bg-primary text-white border-transparent")
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
                <label className="block text-[12px] font-medium text-slate-600 mb-1.5">Catatan Supervisor</label>
                <textarea
                  value={catatanSupervisor ?? ""}
                  onChange={(e) => onCatatanSupervisorChange?.(e.target.value)}
                  placeholder="Tambahkan instruksi khusus di sini..."
                  className="w-full border border-[#C0CEDF] rounded-lg p-3 text-sm bg-slate-50 min-h-[80px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
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

  const damagedPhotos = (report.photos ?? []).filter((p) => (p.total_detections ?? 0) > 0 && p.ai_severity);
  const singleBefore = report.image_original_url ?? report.first_photo_url;
  if (!damagedPhotos.length && !singleBefore) return null;

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
      <div className="p-3 border-b border-[#E2E8F0]">
        <h3 className="font-label-md text-[13px] font-bold text-on-surface">Perbandingan Sebelum & Sesudah</h3>
      </div>
      <div className="p-3 flex flex-col gap-4">
        {damagedPhotos.length > 0 ? (
          damagedPhotos.map((p, i) => (
            <div key={p.id}>
              <p className="text-[11px] font-semibold text-slate-500 mb-1.5">
                Foto #{p.sort_order ?? i + 1} — {p.ai_jenis_kerusakan ?? "Kerusakan"}
              </p>
              <BeforeAfterSlider beforeSrc={p.image_original_url ?? ""} afterSrc={report.after_photo_url ?? ""} />
            </div>
          ))
        ) : (
          <BeforeAfterSlider beforeSrc={singleBefore!} afterSrc={report.after_photo_url} />
        )}
      </div>
    </div>
  );
}
