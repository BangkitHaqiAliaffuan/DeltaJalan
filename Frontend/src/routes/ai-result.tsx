import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Icon } from "@/components/jk/Icon";
import { TopBar } from "@/components/jk/TopBar";
import { AppLayout } from "@/components/jk/AppLayout";
import {
  getAiResult, getFormData, getBatchResult,
  SEVERITY_CONFIG,
  type Detection, type BatchPhotoResult,
} from "@/lib/aiStore";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/ai-result")({
  component: AiResultPage,
  head: () => ({ meta: [{ title: "Hasil Deteksi AI — JalanKita" }] }),
});

// ── Warna bounding box per kelas ───────────────────────────────────────────
const CLASS_COLORS: Record<string, string> = {
  "Lubang Besar":      "#C85000",
  "Lubang Kecil":      "#00A0C8",
  "Retak Kulit Buaya": "#C87800",
  "Retak Memanjang":   "#A000A0",
};

// ── Sub-komponen ───────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: string }) {
  const cfg = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG["Baik"];
  return (
    <span className={`px-3 py-1 rounded-full font-label-md text-[12px] font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {cfg.label}
    </span>
  );
}

function DetectionCard({ det, index }: { det: Detection; index: number }) {
  const color = CLASS_COLORS[det.class] ?? "#6B7280";
  const pct   = Math.round(det.confidence * 100);
  return (
    <div className="flex items-start gap-3 p-3 bg-surface-container rounded-xl border border-border-subtle">
      <div className="w-3 h-3 rounded-full shrink-0 mt-1" style={{ backgroundColor: color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="font-label-md text-[13px] font-bold text-on-surface truncate">
            #{index + 1} {det.class}
          </span>
          <SeverityBadge severity={det.severity} />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-selesai" style={{ width: `${pct}%` }} />
          </div>
          <span className="font-id-code text-[11px] text-on-surface-variant shrink-0">{pct}%</span>
        </div>
      </div>
    </div>
  );
}

// ── Kartu foto per item batch ──────────────────────────────────────────────

function BatchPhotoCard({
  photo,
  index,
  isActive,
  onClick,
}: {
  photo:    BatchPhotoResult;
  index:    number;
  isActive: boolean;
  onClick:  () => void;
}) {
  const [imgErr, setImgErr] = useState(false);
  const sevCfg = SEVERITY_CONFIG[photo.severity] ?? SEVERITY_CONFIG["Baik"];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-shrink-0 w-20 flex flex-col items-center gap-1 p-1 rounded-xl transition-all ${
        isActive ? 'ring-2 ring-primary-container bg-primary-container/10' : 'hover:bg-surface-container'
      }`}
    >
      <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-surface-container-high">
        {photo.imageResult && !imgErr ? (
          <img
            src={`data:image/jpeg;base64,${photo.imageResult}`}
            alt={`Foto ${index + 1}`}
            className="w-full h-full object-cover"
            onError={() => setImgErr(true)}
          />
        ) : photo.previewUrl ? (
          <img
            src={photo.previewUrl}
            alt={`Foto ${index + 1}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Icon name="image" className="text-on-surface-variant !text-[24px]" />
          </div>
        )}
        {/* Severity dot */}
        <div className={`absolute bottom-1 right-1 w-3 h-3 rounded-full border border-white ${
          photo.severity === 'Rusak Berat'  ? 'bg-red-500'    :
          photo.severity === 'Rusak Sedang' ? 'bg-orange-400' :
          photo.severity === 'Rusak Ringan' ? 'bg-yellow-400' : 'bg-green-400'
        }`} />
      </div>
      <span className={`text-[10px] font-medium ${isActive ? 'text-primary-container' : 'text-on-surface-variant'}`}>
        Foto {index + 1}
      </span>
      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${sevCfg.bg} ${sevCfg.text}`}>
        {photo.detections.length} titik
      </span>
    </button>
  );
}

// ── Halaman utama ──────────────────────────────────────────────────────────

function AiResultPage() {
  const navigate    = useNavigate();
  const result      = getAiResult();
  const formData    = getFormData();
  const batchResult = getBatchResult();

  const isBatch = batchResult !== null && batchResult.photos.length > 1;

  const [activeIdx, setActiveIdx] = useState(0);
  const [imgError,  setImgError]  = useState(false);

  // Reset imgError saat foto aktif berubah
  useEffect(() => { setImgError(false); }, [activeIdx]);

  // Guard: redirect ke upload jika tidak ada data
  useEffect(() => {
    if (!result) navigate({ to: "/upload" });
  }, [result, navigate]);

  if (!result || !formData) {
    return (
      <AppLayout>
        <div className="flex flex-col min-h-screen w-full items-center justify-center gap-4 p-8">
          <Icon name="hourglass_empty" className="text-on-surface-variant !text-[48px]" />
          <p className="font-body-md text-body-md text-on-surface-variant text-center">
            Tidak ada hasil analisis. Silakan upload foto terlebih dahulu.
          </p>
          <Link to="/upload" className="h-11 px-6 bg-primary-container text-white rounded-xl flex items-center gap-2 font-label-md text-[14px] font-bold">
            <Icon name="arrow_back" className="!text-[18px]" />
            Kembali ke Upload
          </Link>
        </div>
      </AppLayout>
    );
  }

  // Data yang ditampilkan — batch pakai foto aktif, single pakai result langsung
  const activePhoto    = isBatch ? batchResult!.photos[activeIdx] : null;
  const displayImage   = isBatch ? (activePhoto!.imageResult || '') : result.image_result;
  const displayDets    = isBatch ? (activePhoto!.detections)        : result.detections;
  const displaySev     = isBatch ? (activePhoto!.severity)          : result.overall_severity;
  const overallSev     = isBatch ? batchResult!.overallSeverity     : result.overall_severity;
  const totalDets      = isBatch ? batchResult!.totalDetections      : result.total;
  const overallCfg     = SEVERITY_CONFIG[overallSev] ?? SEVERITY_CONFIG["Baik"];
  const activeSevCfg   = SEVERITY_CONFIG[displaySev] ?? SEVERITY_CONFIG["Baik"];

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen w-full">
        <TopBar
          title={isBatch ? `Hasil Batch (${batchResult!.photos.length} Foto)` : "Hasil Deteksi AI"}
          back="/upload"
          right={
            <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-low">
              <Icon name="share" className="text-on-surface-variant" />
            </button>
          }
        />

        <main className="flex-1 overflow-y-auto px-4 pt-4 pb-6 w-full">
          <div style={{ maxWidth: "42rem", marginLeft: "auto", marginRight: "auto" }} className="flex flex-col gap-4">

            {/* ── Ringkasan batch (hanya untuk mode batch) ── */}
            {isBatch && (
              <section className="bg-surface-container-lowest border border-border-subtle rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon name="burst_mode" className="text-primary-container !text-[20px]" />
                    <h3 className="font-headline-sm text-[14px] font-bold text-on-surface">
                      Ringkasan Batch
                    </h3>
                  </div>
                  {batchResult!.reportCode && (
                    <span className="font-id-code text-[11px] text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">
                      {batchResult!.reportCode}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <p className="text-[22px] font-bold text-on-surface">{batchResult!.photos.length}</p>
                    <p className="text-[11px] text-on-surface-variant">Foto</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[22px] font-bold text-on-surface">{totalDets}</p>
                    <p className="text-[11px] text-on-surface-variant">Total Kerusakan</p>
                  </div>
                  <div className="text-center flex flex-col items-center gap-1">
                    <SeverityBadge severity={overallSev} />
                    <p className="text-[11px] text-on-surface-variant">Terparah</p>
                  </div>
                </div>

                {/* Trust score */}
                {batchResult!.trustScore > 0 && (
                  <div className="mt-3 pt-3 border-t border-border-subtle flex items-center justify-between">
                    <span className="text-[12px] text-on-surface-variant">Trust Score</span>
                    <span className={`text-[12px] font-bold px-2 py-0.5 rounded-full ${
                      batchResult!.trustLabel === 'hijau'  ? 'bg-green-100 text-green-800'  :
                      batchResult!.trustLabel === 'kuning' ? 'bg-yellow-100 text-yellow-800' :
                                                             'bg-red-100 text-red-800'
                    }`}>
                      {batchResult!.trustLabel === 'hijau'  ? '🟢' :
                       batchResult!.trustLabel === 'kuning' ? '🟡' : '🔴'}{' '}
                      {batchResult!.trustScore}/100
                    </span>
                  </div>
                )}
              </section>
            )}

            {/* ── Carousel thumbnail (hanya batch) ── */}
            {isBatch && (
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {batchResult!.photos.map((photo, idx) => (
                  <BatchPhotoCard
                    key={idx}
                    photo={photo}
                    index={idx}
                    isActive={activeIdx === idx}
                    onClick={() => setActiveIdx(idx)}
                  />
                ))}
              </div>
            )}

            {/* ── Gambar hasil deteksi ── */}
            <section className="bg-surface-container-lowest border border-border-subtle rounded-xl overflow-hidden shadow-sm">
              {isBatch && (
                <div className="px-4 py-2 border-b border-border-subtle flex items-center justify-between">
                  <span className="font-label-md text-[12px] font-semibold text-on-surface">
                    Foto {activeIdx + 1} dari {batchResult!.photos.length}
                  </span>
                  <span className="font-id-code text-[11px] text-on-surface-variant truncate max-w-[160px]">
                    {activePhoto!.fileName}
                  </span>
                </div>
              )}

              <div className="relative w-full bg-surface-container-high">
                {displayImage && !imgError ? (
                  <img
                    src={`data:image/jpeg;base64,${displayImage}`}
                    alt="Hasil deteksi AI dengan bounding box"
                    className="w-full object-contain max-h-[360px]"
                    onError={() => setImgError(true)}
                  />
                ) : activePhoto?.previewUrl ? (
                  /* Fallback ke preview asli jika tidak ada image_result */
                  <img
                    src={activePhoto.previewUrl}
                    alt="Foto asli"
                    className="w-full object-contain max-h-[360px] opacity-80"
                  />
                ) : (
                  <div className="w-full h-48 flex items-center justify-center text-on-surface-variant">
                    <Icon name="broken_image" className="!text-[48px]" />
                  </div>
                )}

                {/* Severity badge overlay */}
                <div className="absolute top-3 left-3">
                  <span className={`px-3 py-1.5 rounded-lg font-label-md text-[12px] font-bold border shadow-sm ${activeSevCfg.bg} ${activeSevCfg.text} ${activeSevCfg.border}`}>
                    {displaySev}
                  </span>
                </div>

                {/* Detection count badge */}
                <div className="absolute top-3 right-3 bg-black/60 text-white px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                  <Icon name="search" className="!text-[14px]" />
                  <span className="font-label-md text-[12px] font-bold">
                    {displayDets.length} deteksi
                  </span>
                </div>

                {/* Navigasi prev/next untuk batch */}
                {isBatch && batchResult!.photos.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setActiveIdx(i => Math.max(0, i - 1))}
                      disabled={activeIdx === 0}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center disabled:opacity-30 transition-colors"
                    >
                      <Icon name="chevron_left" className="!text-[20px]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveIdx(i => Math.min(batchResult!.photos.length - 1, i + 1))}
                      disabled={activeIdx === batchResult!.photos.length - 1}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center disabled:opacity-30 transition-colors"
                    >
                      <Icon name="chevron_right" className="!text-[20px]" />
                    </button>
                  </>
                )}
              </div>

              {/* Summary stats */}
              {!isBatch && (
                <div className="p-4 grid grid-cols-2 gap-3 border-t border-border-subtle">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-label-sm text-[11px] text-on-surface-variant">Total Kerusakan</span>
                    <span className="font-headline-sm text-[18px] font-bold text-on-surface">{result.total} titik</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-label-sm text-[11px] text-on-surface-variant">Tingkat Keparahan</span>
                    <SeverityBadge severity={result.overall_severity} />
                  </div>
                </div>
              )}
            </section>

            {/* ── Daftar deteksi foto aktif ── */}
            {displayDets.length > 0 ? (
              <section className="bg-surface-container-lowest border border-border-subtle rounded-xl p-4 flex flex-col gap-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <Icon name="manage_search" className="text-primary !text-[20px]" />
                  <h3 className="font-headline-sm text-[14px] font-bold text-on-surface">
                    {isBatch ? `Detail Deteksi — Foto ${activeIdx + 1}` : 'Detail Deteksi'}
                  </h3>
                </div>
                <div className="flex flex-col gap-2">
                  {displayDets.map((det, i) => (
                    <DetectionCard key={i} det={det} index={i} />
                  ))}
                </div>
              </section>
            ) : (
              <section className="bg-[#D1FAE5] border border-[#6EE7B7] rounded-xl p-4 flex gap-3 items-start">
                <Icon name="check_circle" className="text-[#065F46] !text-[22px] shrink-0" filled />
                <div>
                  <p className="font-label-md text-[13px] font-bold text-[#065F46]">
                    {isBatch ? `Foto ${activeIdx + 1}: Tidak Ada Kerusakan` : 'Tidak Ada Kerusakan Terdeteksi'}
                  </p>
                  <p className="font-body-md text-[12px] text-[#065F46]/80 mt-0.5">
                    AI tidak menemukan kerusakan pada foto ini.
                  </p>
                </div>
              </section>
            )}

            {/* ── Informasi Lokasi ── */}
            <section className="bg-surface-container-lowest border border-border-subtle rounded-xl p-4 flex flex-col gap-2 shadow-sm">
              <div className="flex items-center gap-2">
                <Icon name="location_on" className="text-primary !text-[20px]" filled />
                <h3 className="font-headline-sm text-[14px] font-bold text-primary">Lokasi Laporan</h3>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-1">
                <div>
                  <p className="font-label-sm text-[11px] text-on-surface-variant mb-0.5">Nama Jalan</p>
                  <p className="font-label-md text-[13px] font-semibold text-on-surface">{formData.namaJalan}</p>
                </div>
                <div>
                  <p className="font-label-sm text-[11px] text-on-surface-variant mb-0.5">Kecamatan</p>
                  <p className="font-label-md text-[13px] font-semibold text-on-surface">Kec. {formData.kecamatan}</p>
                </div>
                <div>
                  <p className="font-label-sm text-[11px] text-on-surface-variant mb-0.5">Tanggal</p>
                  <p className="font-label-md text-[13px] font-semibold text-on-surface">{formData.tanggal}</p>
                </div>
                <div>
                  <p className="font-label-sm text-[11px] text-on-surface-variant mb-0.5">
                    {isBatch ? 'Jumlah Foto' : 'File Foto'}
                  </p>
                  <p className="font-id-code text-[11px] text-on-surface truncate">{formData.fileName}</p>
                </div>
              </div>
              {formData.catatan && (
                <div className="mt-1 pt-3 border-t border-border-subtle">
                  <p className="font-label-sm text-[11px] text-on-surface-variant mb-0.5">Catatan</p>
                  <p className="font-body-md text-[13px] text-on-surface">{formData.catatan}</p>
                </div>
              )}
            </section>

            {/* ── Disclaimer ── */}
            <div className="flex items-start gap-2 bg-[#FEF3C7] border border-[#FCD34D] rounded-xl px-4 py-3">
              <Icon name="warning" className="text-[#92400E] !text-[20px] shrink-0 mt-0.5" />
              <p className="font-label-md text-[12px] text-[#92400E] leading-relaxed">
                Hasil ini merupakan deteksi awal AI (confidence threshold 60%). Mohon verifikasi sebelum membuat laporan resmi.
              </p>
            </div>

            {/* ── Action Buttons ── */}
            <div className="flex flex-col gap-3 pb-4">
              {isBatch ? (
                /* Batch sudah tersimpan — tombol ke laporan saya */
                <Link
                  to="/my-reports"
                  className="w-full h-[52px] bg-primary-container text-white rounded-xl flex items-center justify-center gap-2 font-headline-sm text-[15px] font-bold active:scale-[0.98] transition-transform shadow-md shadow-primary-container/20"
                >
                  <Icon name="check_circle" className="!text-[20px]" />
                  Lihat Laporan Tersimpan
                </Link>
              ) : (
                <Link
                  to="/create-report"
                  className="w-full h-[52px] bg-primary-container text-white rounded-xl flex items-center justify-center gap-2 font-headline-sm text-[15px] font-bold active:scale-[0.98] transition-transform shadow-md shadow-primary-container/20"
                >
                  <Icon name="check_circle" className="!text-[20px]" />
                  Konfirmasi & Buat Laporan
                </Link>
              )}
              <button
                type="button"
                onClick={() => navigate({ to: "/upload" })}
                className="w-full h-[48px] border border-primary-container text-primary-container rounded-xl flex items-center justify-center gap-2 font-label-md text-[14px] font-bold hover:bg-primary-container/5 transition-colors"
              >
                <Icon name="refresh" className="!text-[20px]" />
                {isBatch ? 'Upload Batch Baru' : 'Analisis Ulang dengan Foto Baru'}
              </button>
            </div>

          </div>
        </main>
      </div>
    </AppLayout>
  );
}
