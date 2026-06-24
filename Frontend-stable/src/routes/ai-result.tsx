import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Icon } from "@/components/jk/Icon";
import { PageLayout } from "@/components/jk/PageLayout";
import { Portal } from "@/components/jk/Portal";
import { FraudWarningModal } from "@/components/jk/FraudWarningModal";
import {
  getAiResult,
  getFormData,
  getBatchResult,
  setAiResult,
  setFormData,
  setBatchResult,
  updateBatchPhoto,
  clearAiStore,
  getPendingBatchFiles,
  SEVERITY_CONFIG,
  getSeverityConfig,
  type Detection,
  type BatchPhotoResult,
} from "@/lib/aiStore";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { getCurrentUser, getToken } from "@/lib/auth";
import { validatePhotoDate, isExifBlocking, type PhotoDateValidationStatus } from "@/lib/validatePhotoDate";
import { readExifGps } from "@/hooks/useLocationFromPhoto";
import { snapToRoad } from "@/lib/geo";
import "leaflet/dist/leaflet.css";

export const Route = createFileRoute("/ai-result")({
  component: AiResultPage,
  head: () => ({ meta: [{ title: "Hasil Deteksi AI — DeltaJalan" }] }),
});

// ── Warna bounding box per kelas ───────────────────────────────────────────
const CLASS_COLORS: Record<string, string> = {
  "Lubang Besar": "#C85000",
  "Lubang Kecil": "#00A0C8",
  "Retak Kulit Buaya": "#C87800",
  "Retak Memanjang": "#A000A0",
};

// ── Sub-komponen ───────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: string }) {
  const cfg = getSeverityConfig(severity);
  return (
    <span
      className={`px-3 py-1 rounded-lg font-label-md text-[12px] font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}
    >
      {cfg.label}
    </span>
  );
}

function DetectionCard({ det, index }: { det: Detection; index: number }) {
  const color = CLASS_COLORS[det.class] ?? "#6B7280";
  const pct = Math.round(det.confidence * 100);
  return (
    <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-[#D0DAE8]">
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
  photo: BatchPhotoResult;
  index: number;
  isActive: boolean;
  onClick: () => void;
}) {
  const [imgErr, setImgErr] = useState(false);
  const sevCfg = getSeverityConfig(photo.severity);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-shrink-0 w-20 mt-1 flex flex-col items-center gap-1 p-1 rounded-lg transition-all ${
        isActive
          ? "ring-2 ring-primary-container bg-primary-container/10"
          : "hover:bg-surface-container"
      }`}
    >
      <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-surface-container-high">
        {photo.isDuplicate ? (
          <div className="w-full h-full flex items-center justify-center bg-amber-50">
            <Icon name="content_copy" className="text-amber-400 !text-[28px]" />
          </div>
        ) : photo.imageResult && !imgErr ? (
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
        {photo.isDuplicate ? (
          <div className="absolute bottom-1 right-1 bg-amber-400 text-white text-[8px] font-bold px-1 py-0.5 rounded">
            duplikat
          </div>
        ) : (
          <div
            className={`absolute bottom-1 right-1 w-3 h-3 rounded-full border border-white ${
              photo.severity === "Rusak Berat"
                ? "bg-red-500"
                : photo.severity === "Rusak Sedang"
                  ? "bg-orange-400"
                  : photo.severity === "Rusak Ringan"
                    ? "bg-yellow-400"
                    : "bg-green-400"
            }`}
          />
        )}
      </div>
      <span
        className={`text-[10px] font-medium ${isActive ? "text-primary-container" : "text-on-surface-variant"}`}
      >
        Foto {index + 1}
      </span>
      {!photo.isDuplicate && (
        <span
          className={`text-[9px] px-1.5 py-0.5 rounded-lg font-bold border ${sevCfg.bg} ${sevCfg.text}`}
        >
          {photo.detections.length} titik
        </span>
      )}
    </button>
  );
}

// ── DeteksiFoto — original photo + bbox overlay ───────────────────────────

function DeteksiFoto({
  previewUrl,
  displayImage,
  displayImageError,
  onDisplayImageError,
  detections,
  severity,
  sevCfg,
}: {
  previewUrl: string;
  displayImage: string;
  displayImageError: boolean;
  onDisplayImageError: () => void;
  detections: Detection[];
  severity: string;
  sevCfg: { bg: string; text: string; border: string };
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [naturalAspect, setNaturalAspect] = useState<number | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    setNaturalAspect(null);
    setImgLoaded(false);
  }, [displayImage, previewUrl]);

  function handleLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      setNaturalAspect(img.naturalWidth / img.naturalHeight);
    }
    setImgLoaded(true);
  }

  return (
    <div
      className="relative w-full bg-[#0F172A]"
      style={naturalAspect ? { aspectRatio: `${naturalAspect}`, maxHeight: 360 } : { minHeight: 300 }}
    >
      {displayImage && !displayImageError ? (
        <img
          src={`data:image/jpeg;base64,${displayImage}`}
          alt="Hasil deteksi AI"
          className="absolute inset-0 w-full h-full object-contain"
          onLoad={handleLoad}
          onError={onDisplayImageError}
        />
      ) : previewUrl ? (
        <>
          <img
            ref={imgRef}
            src={previewUrl}
            alt="Foto asli"
            className="absolute inset-0 w-full h-full object-contain"
            onLoad={handleLoad}
            onError={() => {}}
          />
          {detections.map((det, i) => {
            const color = CLASS_COLORS[det.class] ?? "#6B7280";
            return (
              <div
                key={i}
                className="absolute border-2 rounded-sm pointer-events-none"
                style={{
                  left: `${det.bbox.x1 * 100}%`,
                  top: `${det.bbox.y1 * 100}%`,
                  width: `${Math.max((det.bbox.x2 - det.bbox.x1) * 100, 1)}%`,
                  height: `${Math.max((det.bbox.y2 - det.bbox.y1) * 100, 1)}%`,
                  borderColor: color,
                }}
              >
                <span
                  className="absolute -top-4 left-0 text-[9px] font-bold px-1 py-0.5 rounded-t leading-tight whitespace-nowrap z-10"
                  style={{ backgroundColor: color, color: "white" }}
                >
                  {det.class} {(det.confidence * 100).toFixed(0)}%
                </span>
              </div>
            );
          })}
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-[#64748B]">
          <Icon name="broken_image" className="!text-[48px]" />
        </div>
      )}

      {!imgLoaded && !displayImageError && displayImage && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0F172A]/50">
          <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}

      <div className="absolute top-3 left-3">
        <span
          className={`px-3 py-1.5 rounded-lg font-label-md text-[12px] font-bold border ${sevCfg.bg} ${sevCfg.text} ${sevCfg.border}`}
        >
          {severity}
        </span>
      </div>

      <div className="absolute top-3 right-3 bg-black/60 text-white px-2.5 py-1 rounded-lg flex items-center gap-1.5">
        <Icon name="search" className="!text-[14px]" />
        <span className="font-label-md text-[12px] font-bold">{detections.length} deteksi</span>
      </div>
    </div>
  );
}

// ── Halaman utama ──────────────────────────────────────────────────────────

type SubmitState = "idle" | "loading" | "success" | "error";

function normSev(s: string): string {
  const lower = s.toLowerCase();
  if (lower === "berat" || lower === "rusak berat") return "Rusak Berat";
  if (lower === "sedang" || lower === "rusak sedang") return "Rusak Sedang";
  if (lower === "ringan" || lower === "rusak ringan") return "Rusak Ringan";
  return "Baik";
}

async function computeFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function reconstructAnalyses(photos: BatchPhotoResult[]): string {
  const analyses = photos.map((p) => ({
    file_index: p.fileIndex,
    file_name: p.fileName,
    detections: p.detections.map((d) => ({
      type: d.class,
      confidence: d.confidence,
      bbox: [d.bbox.x1, d.bbox.y1, d.bbox.x2, d.bbox.y2],
    })),
    severity: p.severity,
    confidence: p.confidence,
    image_result: p.imageResult,
    has_exif_gps: p.hasExifGps ?? false,
    ...(p.lat != null && p.lng != null
      ? { photo_lat: p.lat, photo_lng: p.lng }
      : {}),
    ...(p.hasExifGps && p.lat != null && p.lng != null
      ? { exif_lat: p.lat, exif_lng: p.lng }
      : {}),
    ...(p.hasError ? { error: "error" } : {}),
  }));
  return JSON.stringify(analyses);
}

function AiResultPage() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const result = getAiResult();
  const formData = getFormData();
  const batchResult = getBatchResult();

  const isBatch = batchResult !== null && batchResult.photos.length > 1;

  // Guard: jika single mode (tidak aktif) atau tidak ada data sama sekali
  if (!isBatch && !result) {
    return (
      <PageLayout back="/upload" title="Hasil Deteksi AI" withBottomNav>
        <main className="flex flex-col items-center justify-center py-20 px-4">
          <Icon name="info" className="!text-5xl text-[#64748B] mb-4 opacity-30" />
          <p className="text-[#475569] text-center">Mode laporan tunggal tidak tersedia. Gunakan galeri untuk memilih minimal 2 foto.</p>
        </main>
      </PageLayout>
    );
  }

  const [activeIdx, setActiveIdx] = useState(0);
  const [imgError, setImgError] = useState(false);
  const [fullscreenIdx, setFullscreenIdx] = useState<number | null>(null);

  // Reset imgError saat foto aktif berubah
  useEffect(() => {
    setImgError(false);
  }, [activeIdx]);

  // Guard: redirect ke upload jika tidak ada data (single maupun batch)
  useEffect(() => {
    if (!result && !batchResult) navigate({ to: "/upload" });
  }, [result, batchResult, navigate]);

  // ── Editable Dimensions ─────────────────────────────────────────────────
  const [editPanjang, setEditPanjang] = useState(formData?.kerusakanPanjang ?? "");
  const [editLebar, setEditLebar] = useState(formData?.kerusakanLebar ?? "");
  const [batchEditDimensi, setBatchEditDimensi] = useState<Record<number, { panjang: string; lebar: string }>>(() => {
    if (!batchResult) return {};
    const dims: Record<number, { panjang: string; lebar: string }> = {};
    batchResult.photos.forEach((p, i) => {
      dims[i] = { panjang: p.kerusakanPanjang ?? "", lebar: p.kerusakanLebar ?? "" };
    });
    return dims;
  });

  // ── Editable Lokasi ─────────────────────────────────────────────────────
  const [editNamaJalan, setEditNamaJalan] = useState(formData?.namaJalan ?? "");
  const [editKecamatan, setEditKecamatan] = useState(formData?.kecamatan ?? "");
  const [editCatatan, setEditCatatan] = useState(formData?.catatan ?? "");
  const [gpsRoadLoading, setGpsRoadLoading] = useState(false);
  const hasGps = isBatch
    ? (batchResult!.photos[0]?.lat ?? formData?.lat) != null
    : formData?.lat != null;

  // Auto-fill nama jalan & kecamatan dari reverse geocode GPS
  useEffect(() => {
    const gpsLat = isBatch ? (batchResult!.photos[0]?.lat ?? formData?.lat) : formData?.lat;
    const gpsLng = isBatch ? (batchResult!.photos[0]?.lng ?? formData?.lng) : formData?.lng;
    if (!gpsLat || !gpsLng) return;
    if (editNamaJalan && editNamaJalan !== formData?.namaJalan) return; // already edited by user
    setGpsRoadLoading(true);
    import("@/hooks/useLocationFromPhoto").then(({ reverseGeocode }) => {
      reverseGeocode(gpsLat!, gpsLng!).then((geo) => {
        if (geo.namaJalan) setEditNamaJalan(geo.namaJalan);
        if (geo.kecamatan) setEditKecamatan(geo.kecamatan);
      }).finally(() => setGpsRoadLoading(false));
    }).catch(() => setGpsRoadLoading(false));
  }, [isBatch]);

  // ── 2-detik Timer ───────────────────────────────────────────────────────
  const [confirmEnabled, setConfirmEnabled] = useState(false);
  const [countdown, setCountdown] = useState(2);

  useEffect(() => {
    setConfirmEnabled(false);
    setCountdown(2);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setConfirmEnabled(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Submit State ────────────────────────────────────────────────────────
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitError, setSubmitError] = useState("");
  const [savedCode, setSavedCode] = useState<string | null>(null);

  // ── Ganti Foto ──────────────────────────────────────────────────────────
  const [gantiFotoLoading, setGantiFotoLoading] = useState(false);
  const [fraudModal, setFraudModal] = useState<{
    isOpen: boolean;
    status: PhotoDateValidationStatus;
    title: string;
    message: string;
    isWarningOnly: boolean;
  }>({ isOpen: false, status: "no_exif_date", title: "", message: "", isWarningOnly: false });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gantiFotoTargetRef = useRef<number | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  function closeFraudModal() {
    setFraudModal((s) => ({ ...s, isOpen: false }));
  }

  async function handleReplacePhoto(index: number | null) {
    if (gantiFotoLoading) return;
    gantiFotoTargetRef.current = index;
    fileInputRef.current?.click();
  }

  async function handleFileReplace(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    // Guard 1: File type & size
    if (!["image/jpeg", "image/jpg", "image/png"].includes(file.type)) {
      toast.error("Format file tidak didukung. Gunakan JPEG atau PNG.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran file maksimal 5MB.");
      return;
    }

    // Konversi ke in-memory File SEBELUM operasi apapun yang membaca blob.
    // Di Android WebView, content:// URI permission bisa kedaluwarsa setelah
    // beberapa operasi async. Buf dipertahankan di scope agar tidak di-GC
    // sebelum Chromium selesai mentransfer data ke blob store.
    let safeFile: File;
    let _buf: ArrayBuffer;
    try {
      _buf = await file.arrayBuffer();
      safeFile = new File([_buf], file.name, { type: file.type });
    } catch {
      toast.error("Gagal membaca file foto. Silakan coba kembali.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Guard 2: EXIF Date validation (pakai safeFile — in-memory)
    const dateValidation = await validatePhotoDate(safeFile);
    if (dateValidation.status !== "valid") {
      if (isExifBlocking(dateValidation.status)) {
        setFraudModal({ isOpen: true, status: dateValidation.status, title: dateValidation.title, message: dateValidation.message, isWarningOnly: false });
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      setFraudModal({ isOpen: true, status: dateValidation.status, title: dateValidation.title, message: dateValidation.message, isWarningOnly: true });
    }

    // Guard 3: EXIF GPS (non-blocking, pakai safeFile)
    await readExifGps(safeFile);

    // Guard 4: Duplication check (non-blocking, pakai safeFile)
    try {
      const hash = await computeFileHash(safeFile);
      const token = getToken() ?? "";
      const url = new URL(`${window.location.origin}${import.meta.env.VITE_API_BASE_URL ?? "/api"}/v1/reports/check-duplicate`);
      url.searchParams.set("file_hash", hash);
      const res = await fetch(url.toString(), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (data.has_active_report && data.report) {
          toast.warning(`Foto sudah pernah digunakan untuk laporan ${data.report.report_code}.`);
        }
      }
    } catch {
      // Non-blocking
    }

    // Re-analyze with AI (pakai safeFile — in-memory)
    setGantiFotoLoading(true);
    try {
      const token = getToken() ?? "";
      const fd = new FormData();
      fd.append("file", safeFile);
      const response = await fetch(`${formData ? (import.meta.env.VITE_API_BASE_URL ?? "/api") : "/api"}/analyze`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!response.ok) throw new Error(`Analisis gagal (HTTP ${response.status})`);
      const aiResultData = await response.json();

      const mappedDets = (aiResultData.detections ?? []).map((d: any) => ({
        class: d.type ?? d.class,
        severity: normSev(d.severity ?? aiResultData.overall_severity),
        confidence: d.confidence,
        bbox: d.bbox
          ? { x1: d.bbox[0] ?? 0, y1: d.bbox[1] ?? 0, x2: d.bbox[2] ?? 0, y2: d.bbox[3] ?? 0 }
          : { x1: 0, y1: 0, x2: 0, y2: 0 },
      }));

      if (gantiFotoTargetRef.current !== null) {
        // Batch mode: update one photo
        updateBatchPhoto(gantiFotoTargetRef.current, {
          fileName: safeFile.name,
          previewUrl: URL.createObjectURL(safeFile),
          imageResult: aiResultData.image_result ?? "",
          detections: mappedDets,
          severity: normSev(aiResultData.overall_severity),
          confidence: aiResultData.detections?.[0]?.confidence ?? aiResultData.confidence ?? 0,
          hasError: false,
        });
      } else {
        // Single mode: update result
        const newResult = {
          detections: mappedDets,
          total: aiResultData.total ?? mappedDets.length,
          overall_severity: normSev(aiResultData.overall_severity),
          image_result: aiResultData.image_result ?? "",
          status: "success",
        };
        setAiResult(newResult);
        if (formData) {
          URL.revokeObjectURL(formData.previewUrl);
          setFormData({ ...formData, previewUrl: URL.createObjectURL(safeFile), fileName: safeFile.name, file: safeFile });
        }
      }

      // Reset timer
      setConfirmEnabled(false);
      setCountdown(2);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menganalisis foto baru");
    } finally {
      setGantiFotoLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // ── Confirm & Submit ────────────────────────────────────────────────────

  async function handleConfirm() {
    if (!formData) return;

    // ── Pre-validate (synchronous, before loading state) ─────────────────
    if (isBatch) {
      const pendingFiles = getPendingBatchFiles();
      if (!pendingFiles || pendingFiles.length === 0) {
        setSubmitState("error");
        setSubmitError("File foto tidak tersedia. Silakan upload ulang.");
        return;
      }
      for (let i = 0; i < pendingFiles.length; i++) {
        const dims = batchEditDimensi[i];
        if (!dims?.panjang?.trim() || !dims?.lebar?.trim()) {
          setSubmitState("error");
          setSubmitError(`Dimensi kerusakan untuk foto ${i + 1} wajib diisi.`);
          return;
        }
      }
      if (!batchResult?.batchId) {
        setSubmitState("error");
        setSubmitError("Batch ID tidak ditemukan.");
        return;
      }
    } else {
      if (!editPanjang?.trim() || !editLebar?.trim()) {
        setSubmitState("error");
        setSubmitError("Dimensi kerusakan (panjang × lebar) wajib diisi.");
        return;
      }
      if (!formData.lat || !formData.lng) {
        setSubmitState("error");
        setSubmitError("Koordinat GPS tidak tersedia.");
        return;
      }
    }

    // ── Start loading ────────────────────────────────────────────────────
    setSubmitState("loading");
    setSubmitError("");

    // Yield to React so the loading overlay commits before async work
    await new Promise((r) => setTimeout(r, 0));

    try {
      if (isBatch) {
        // ── Batch mode submit ──────────────────────────────────────────────
        const pendingFiles = getPendingBatchFiles()!;
        const token = getToken() ?? "";
        const fd = new FormData();
        fd.append("batch_id", batchResult!.batchId);
        fd.append("road_name", editNamaJalan);
        fd.append("district", editKecamatan);
        fd.append("latitude", String(formData.lat ?? 0));
        fd.append("longitude", String(formData.lng ?? 0));
        fd.append("koordinat_sumber", "exif");
        fd.append("analyses", reconstructAnalyses(batchResult!.photos));
        if (editCatatan) fd.append("catatan", editCatatan);
        if (formData.duplicate_of_id) fd.append("duplicate_of_id", formData.duplicate_of_id);
        if (formData.survey_task_id) fd.append("survey_task_id", formData.survey_task_id);
        pendingFiles.forEach((_, idx) => {
          fd.append("kerusakan_panjang[]", batchEditDimensi[idx]?.panjang ?? "0");
          fd.append("kerusakan_lebar[]", batchEditDimensi[idx]?.lebar ?? "0");
        });
        pendingFiles.forEach((f) => fd.append("files[]", f));

        const r2 = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? "/api"}/reports/batch`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (!r2.ok) {
          const errData = await r2.json().catch(() => ({}));
          throw new Error(errData.message ?? `Gagal menyimpan batch (HTTP ${r2.status})`);
        }
        const reportData = await r2.json();
        setSavedCode(reportData.main_report_code ?? "");
      } else {
        // ── Single mode submit ─────────────────────────────────────────────
        if (!formData.file) {
          throw new Error("File foto tidak tersedia. Silakan upload ulang.");
        }
        const snapped = await snapToRoad(formData.lat, formData.lng);

        const token = getToken() ?? "";
        const fd = new FormData();
        fd.append("reporter_name", user?.name ?? editNamaJalan);
        fd.append("road_name", editNamaJalan);
        fd.append("district", editKecamatan);
        fd.append("latitude", String(snapped.lat));
        fd.append("longitude", String(snapped.lng));
        fd.append("kerusakan_panjang", editPanjang);
        fd.append("kerusakan_lebar", editLebar);
        if (editCatatan) fd.append("catatan", editCatatan);
        fd.append("image", formData.file, formData.fileName);
        if (formData.duplicate_of_id) fd.append("duplicate_of_id", formData.duplicate_of_id);
        if (formData.survey_task_id) fd.append("survey_task_id", formData.survey_task_id);

        // Kirim data AI analysis agar backend tidak perlu memanggil FastAPI lagi
        const currentResult = getAiResult();
        if (currentResult) {
          fd.append("total_detections", String(currentResult.total));
          fd.append("overall_severity", currentResult.overall_severity);
          fd.append("ai_raw_output", JSON.stringify(
            currentResult.detections.map((d) => ({
              class: d.class,
              confidence: d.confidence,
              bbox: d.bbox,
            }))
          ));
          if (currentResult.image_result) {
            fd.append("image_result", currentResult.image_result);
          }
        }

        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? "/api"}/reports`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        const resultData = await response.json();
        if (!response.ok) {
          throw new Error(resultData.message ?? "Gagal menyimpan laporan");
        }
        setSavedCode(resultData.data?.report_code ?? null);
      }

      setSubmitState("success");
      const redirectTaskId = formData?.survey_task_id;
      clearAiStore();
      setTimeout(() => {
        if (redirectTaskId) {
          navigate({ to: "/detail-survei", search: { taskId: redirectTaskId } });
        } else {
          navigate({ to: "/upload" });
        }
      }, 2500);
    } catch (err) {
      setSubmitState("error");
      setSubmitError(err instanceof Error ? err.message : "Terjadi kesalahan");
    }
  }

  // ── Map data (before guard to keep hooks consistent) ─────────────────────
  const photoLocations = isBatch
    ? batchResult!.photos
        .map((p, i) => ({ index: i, lat: p.lat, lng: p.lng }))
        .filter((l): l is { index: number; lat: number; lng: number } => l.lat != null && l.lng != null)
    : formData.lat != null && formData.lng != null
      ? [{ index: 0, lat: formData.lat, lng: formData.lng }]
      : [];

  useEffect(() => {
    if (photoLocations.length === 0 || !mapRef.current) return;
    let destroyed = false;
    let mapInstance: import("leaflet").Map | null = null;

    import("leaflet").then((L) => {
      if (destroyed || !mapRef.current) return;

      const map = L.map(mapRef.current, {
        zoomControl: true,
        scrollWheelZoom: false,
      });
      mapInstance = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);

      const markers: L.Marker[] = photoLocations.map((loc) => {
        return L.marker([loc.lat, loc.lng], {
          icon: L.divIcon({
            html: `<div class="flex items-center justify-center w-7 h-7 rounded-full bg-[#1e40af] text-white text-[11px] font-bold border-2 border-white shadow-md">${loc.index + 1}</div>`,
            className: "",
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          }),
        })
          .addTo(map)
          .bindPopup(isBatch ? `Foto ${loc.index + 1}` : "Lokasi Foto");
      });

      if (markers.length === 1) {
        map.setView([photoLocations[0].lat, photoLocations[0].lng], 15);
      } else {
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.15), { maxZoom: 15 });
      }
    });

    return () => {
      destroyed = true;
      mapInstance?.remove();
    };
  }, [photoLocations.length]);

  // ── Guard render ────────────────────────────────────────────────────────

  if (submitState !== "success" && ((!result && !batchResult) || !formData)) {
    return (
      <PageLayout>
        <div className="flex flex-col flex-1 w-full items-center justify-center gap-4 p-8">
          <Icon name="hourglass_empty" className="text-on-surface-variant !text-[48px]" />
          <p className="font-body-md text-body-md text-on-surface-variant text-center">
            Tidak ada hasil analisis. Silakan upload foto terlebih dahulu.
          </p>
          <button
            onClick={() => navigate({ to: "/upload" })}
            className="h-11 px-6 bg-primary text-white rounded-lg flex items-center gap-2 font-label-md text-[14px] font-bold"
          >
            <Icon name="arrow_back" className="!text-[18px]" />
            Kembali ke Upload
          </button>
        </div>
      </PageLayout>
    );
  }

  // ── Data display ────────────────────────────────────────────────────────
  const activePhoto = isBatch ? batchResult!.photos[activeIdx] : null;
  const displayImage = isBatch ? activePhoto!.imageResult || "" : (result?.image_result ?? "");
  const displayDets = isBatch ? activePhoto!.detections : result.detections;
  const displaySev = isBatch ? activePhoto!.severity : result.overall_severity;
  const overallSev = isBatch ? batchResult!.overallSeverity : result.overall_severity;
  const totalDets = isBatch ? batchResult!.totalDetections : result.total;
  const overallCfg = getSeverityConfig(overallSev);
  const activeSevCfg = getSeverityConfig(displaySev);
  const previewSrc = isBatch ? (activePhoto?.previewUrl ?? "") : (formData?.previewUrl ?? "");

  // Current dimensions for the active photo
  const currPanjang = isBatch ? (batchEditDimensi[activeIdx]?.panjang ?? "") : editPanjang;
  const currLebar = isBatch ? (batchEditDimensi[activeIdx]?.lebar ?? "") : editLebar;

  function setCurrPanjang(v: string) {
    if (isBatch) {
      setBatchEditDimensi((prev) => ({ ...prev, [activeIdx]: { ...prev[activeIdx], panjang: v } }));
    } else {
      setEditPanjang(v);
    }
  }

  function setCurrLebar(v: string) {
    if (isBatch) {
      setBatchEditDimensi((prev) => ({ ...prev, [activeIdx]: { ...prev[activeIdx], lebar: v } }));
    } else {
      setEditLebar(v);
    }
  }

  return (
    <PageLayout
      title={
        submitState === "success"
          ? "Laporan Berhasil!"
          : isBatch
            ? `Hasil Batch (${batchResult!.photos.length} Foto)`
            : "Hasil Deteksi AI"
      }
      back={submitState === "success" ? undefined : "/upload"}
    >
      {submitState === "success" ? (
        /* ── Success screen ── */
        <main className="px-4 pt-4 pb-6 w-full">
          <div style={{ maxWidth: "42rem", marginLeft: "auto", marginRight: "auto" }}
               className="flex flex-col items-center gap-4 pt-12">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
              <Icon name="check_circle" className="!text-5xl text-green-600" filled />
            </div>
            <h2 className="text-xl font-bold text-on-surface text-center">
              Laporan Berhasil Dikirim!
            </h2>
            {savedCode && (
              <span className="font-id-code text-sm bg-surface-container px-4 py-2 rounded-lg border border-border-subtle">
                {savedCode}
              </span>
            )}
            <p className="text-sm text-on-surface-variant text-center">
              Mengarahkan ke halaman utama...
            </p>
          </div>
        </main>
      ) : (
        <main className="px-4 pt-4 pb-6 w-full">
          <div
            style={{ maxWidth: "42rem", marginLeft: "auto", marginRight: "auto" }}
            className="flex flex-col gap-4"
          >
            {/* ── Ringkasan batch (hanya untuk mode batch) ── */}
            {isBatch && (
              <section className="bg-white border border-[#D0DAE8] rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon name="burst_mode" className="text-primary-container !text-[20px]" />
                    <h3 className="font-headline-sm text-[14px] font-bold text-on-surface">
                      Ringkasan Batch
                    </h3>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <p className="text-[22px] font-bold text-on-surface">
                      {batchResult!.photos.length}
                    </p>
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
              </section>
            )}

            {/* ── Carousel thumbnail (hanya batch) ── */}
            {isBatch && (
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {batchResult!.photos.map((photo, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-1">
                    <BatchPhotoCard
                      photo={photo}
                      index={idx}
                      isActive={activeIdx === idx}
                      onClick={() => setActiveIdx(idx)}
                    />
                    <button
                      type="button"
                      onClick={() => handleReplacePhoto(idx)}
                      disabled={gantiFotoLoading}
                      className="text-[10px] font-bold text-primary hover:text-primary-container disabled:opacity-40"
                    >
                      Ganti
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* ── Gambar hasil deteksi ── */}
            <section className="bg-white border border-[#D0DAE8] rounded-lg overflow-hidden">
              {isBatch && (
                <div className="px-4 py-2 border-b border-border-subtle flex items-center justify-between">
                  <span className="font-label-md text-[12px] font-semibold text-on-surface">
                    Foto {activeIdx + 1} dari {batchResult!.photos.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-id-code text-[11px] text-on-surface-variant truncate max-w-[120px]">
                      Foto {activeIdx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleReplacePhoto(activeIdx)}
                      disabled={gantiFotoLoading}
                      className="text-[11px] font-bold text-primary hover:text-primary-container border border-primary-container rounded px-2 py-0.5 disabled:opacity-40"
                    >
                      {gantiFotoLoading ? "..." : "Ganti Foto"}
                    </button>
                  </div>
                </div>
              )}

              <div className="relative max-w-[480px] mx-auto">
                <DeteksiFoto
                  previewUrl={previewSrc}
                  displayImage={displayImage}
                  displayImageError={imgError}
                  onDisplayImageError={() => setImgError(true)}
                  detections={displayDets}
                  severity={displaySev}
                  sevCfg={activeSevCfg}
                />

                {displayImage && !imgError && (
                  <button
                    type="button"
                    onClick={() => setFullscreenIdx(isBatch ? activeIdx : 0)}
                    className="absolute bottom-3 right-3 w-8 h-8 bg-black/50 hover:bg-black/70 text-white rounded-lg flex items-center justify-center transition-colors z-20"
                  >
                    <Icon name="open_in_full" className="!text-[16px]" />
                  </button>
                )}

                {isBatch && batchResult!.photos.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setActiveIdx((i) => Math.max(0, i - 1))}
                      disabled={activeIdx === 0}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center disabled:opacity-30 transition-colors z-20"
                    >
                      <Icon name="chevron_left" className="!text-[20px]" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveIdx((i) => Math.min(batchResult!.photos.length - 1, i + 1))
                      }
                      disabled={activeIdx === batchResult!.photos.length - 1}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center disabled:opacity-30 transition-colors z-20"
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
                    <span className="font-label-sm text-[11px] text-on-surface-variant">
                      Total Kerusakan
                    </span>
                    <span className="font-headline-sm text-[18px] font-bold text-on-surface">
                      {result.total} titik
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-label-sm text-[11px] text-on-surface-variant">
                      Tingkat Keparahan
                    </span>
                    <SeverityBadge severity={result.overall_severity} />
                  </div>
                </div>
              )}
            </section>

            {/* ── Daftar deteksi foto aktif ── */}
            {displayDets.length > 0 ? (
              <section className="bg-white border border-[#D0DAE8] rounded-lg p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Icon name="manage_search" className="text-primary !text-[20px]" />
                  <h3 className="font-headline-sm text-[14px] font-bold text-on-surface">
                    {isBatch ? `Detail Deteksi — Foto ${activeIdx + 1}` : "Detail Deteksi"}
                  </h3>
                </div>
                <div className="flex flex-col gap-2">
                  {displayDets.map((det, i) => (
                    <DetectionCard key={i} det={det} index={i} />
                  ))}
                </div>
              </section>
            ) : activePhoto?.isDuplicate ? (
              <section className="bg-amber-50 border border-amber-300 rounded-lg p-4 flex gap-3 items-start">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  <Icon name="content_copy" className="text-amber-700 !text-[16px]" />
                </div>
                <div>
                  <p className="font-label-md text-[13px] font-bold text-amber-800">
                    Foto sudah digunakan pada laporan lain
                  </p>
                  <p className="font-body-md text-[12px] text-amber-700/80 mt-0.5">
                    Foto ini sudah pernah dilaporkan sebelumnya dan dilewati secara otomatis.
                  </p>
                </div>
              </section>
            ) : (
              <section className="bg-[#D1FAE5] border border-[#6EE7B7] rounded-lg p-4 flex gap-3 items-start">
                <Icon name="check_circle" className="text-[#065F46] !text-[22px] shrink-0" filled />
                <div>
                  <p className="font-label-md text-[13px] font-bold text-[#065F46]">
                    {isBatch
                      ? `Foto ${activeIdx + 1}: Tidak Ada Kerusakan`
                      : "Tidak Ada Kerusakan Terdeteksi"}
                  </p>
                  <p className="font-body-md text-[12px] text-[#065F46]/80 mt-0.5">
                    AI tidak menemukan kerusakan pada foto ini.
                  </p>
                </div>
              </section>
            )}

            {/* ── Dimensi Kerusakan (editable) ── */}
            <section className="bg-white border border-[#D0DAE8] rounded-lg p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Icon name="straighten" className="text-primary !text-[20px]" />
                <h3 className="font-headline-sm text-[14px] font-bold text-on-surface">
                  Dimensi Kerusakan
                  {isBatch && <span className="font-label-sm text-[11px] text-on-surface-variant ml-1">— Foto {activeIdx + 1}</span>}
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-label-sm text-[11px] text-on-surface-variant mb-1 block">
                    Panjang (m)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={currPanjang}
                    onChange={(e) => setCurrPanjang(e.target.value)}
                    placeholder="0.0"
                    className="w-full px-3 py-2.5 border border-[#D0DAE8] rounded-lg font-body-md text-[14px] bg-white text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="font-label-sm text-[11px] text-on-surface-variant mb-1 block">
                    Lebar (m)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={currLebar}
                    onChange={(e) => setCurrLebar(e.target.value)}
                    placeholder="0.0"
                    className="w-full px-3 py-2.5 border border-[#D0DAE8] rounded-lg font-body-md text-[14px] bg-white text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>
            </section>

            {/* ── Informasi Lokasi ── */}
            <section className="bg-white border border-[#D0DAE8] rounded-lg p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Icon name="location_on" className="text-primary !text-[20px]" filled />
                <h3 className="font-headline-sm text-[14px] font-bold text-primary">
                  Lokasi Laporan
                </h3>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-1">
                <div className="col-span-3">
                  <p className="font-label-sm text-[11px] text-on-surface-variant mb-0.5">
                    Nama Jalan
                    {hasGps && (gpsRoadLoading
                      ? <span className="inline-block w-3 h-3 ml-1.5 border-2 border-primary border-t-transparent rounded-full animate-spin align-middle" />
                      : <span className="ml-1.5 text-[9px] font-medium text-green-700 bg-green-100 px-1.5 py-[1px] rounded-full align-middle">dari GPS</span>
                    )}
                  </p>
                  <input
                    value={editNamaJalan}
                    onChange={(e) => setEditNamaJalan(e.target.value)}
                    placeholder="Nama jalan..."
                    className="w-full px-3 py-2 border border-[#D0DAE8] rounded-lg text-[13px] text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="col-span-3">
                  <p className="font-label-sm text-[11px] text-on-surface-variant mb-0.5">
                    Kecamatan
                    {hasGps && (gpsRoadLoading
                      ? <span className="inline-block w-3 h-3 ml-1.5 border-2 border-primary border-t-transparent rounded-full animate-spin align-middle" />
                      : <span className="ml-1.5 text-[9px] font-medium text-green-700 bg-green-100 px-1.5 py-[1px] rounded-full align-middle">dari GPS</span>
                    )}
                  </p>
                  <input
                    value={editKecamatan}
                    onChange={(e) => setEditKecamatan(e.target.value)}
                    placeholder="Kecamatan..."
                    className="w-full px-3 py-2 border border-[#D0DAE8] rounded-lg text-[13px] text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <p className="font-label-sm text-[11px] text-on-surface-variant mb-0.5">
                    Tanggal
                  </p>
                  <p className="font-label-md text-[13px] font-semibold text-on-surface">
                    {formData.tanggal}
                  </p>
                </div>
                <div>
                  <p className="font-label-sm text-[11px] text-on-surface-variant mb-0.5">
                    {isBatch ? "Jumlah Foto" : "File Foto"}
                  </p>
                  <p className="font-id-code text-[11px] text-on-surface truncate">
                    {formData.fileName}
                  </p>
                </div>
                <div>
                  <p className="font-label-sm text-[11px] text-on-surface-variant mb-0.5">
                    Koordinat GPS
                  </p>
                  <p className="font-label-md text-[13px] font-semibold text-on-surface font-mono">
                    {formData.lat != null && formData.lng != null
                      ? `${formData.lat.toFixed(6)}, ${formData.lng.toFixed(6)}`
                      : "GPS tidak tersedia"}
                  </p>
                </div>
              </div>
              {photoLocations.length > 0 && (
                <div
                  ref={mapRef}
                  className="w-full h-[200px] rounded-lg border border-[#D0DAE8] z-0"
                />
              )}
            </section>

            {/* ── Catatan ── */}
            <section className="bg-white border border-[#D0DAE8] rounded-lg p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Icon name="description" className="text-primary !text-[20px]" />
                <h3 className="font-headline-sm text-[14px] font-bold text-primary">Catatan</h3>
              </div>
              <textarea
                value={editCatatan}
                onChange={(e) => setEditCatatan(e.target.value)}
                placeholder="Tambahkan catatan (opsional)..."
                rows={3}
                className="w-full px-3 py-2 border border-[#D0DAE8] rounded-lg text-[13px] text-on-surface focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </section>

            {/* ── Ganti Foto button (single mode) ── */}
            {!isBatch && (
              <button
                type="button"
                onClick={() => handleReplacePhoto(null)}
                disabled={gantiFotoLoading}
                className="w-full h-11 border border-primary-container text-primary-container rounded-lg flex items-center justify-center gap-2 font-label-md text-[14px] font-bold hover:bg-primary-container/5 transition-colors disabled:opacity-40"
              >
                <Icon name="photo_camera" className="!text-[20px]" />
                {gantiFotoLoading ? "Menganalisis ulang..." : "Ganti Foto"}
              </button>
            )}

            {/* ── Disclaimer ── */}
            <div className="flex items-start gap-2 bg-[#FEF3C7] border border-[#FCD34D] rounded-lg px-4 py-3">
              <Icon name="warning" className="text-[#92400E] !text-[20px] shrink-0 mt-0.5" />
              <p className="font-label-md text-[12px] text-[#92400E] leading-relaxed">
                Hasil ini merupakan deteksi awal AI (confidence threshold 60%). Mohon verifikasi
                sebelum membuat laporan resmi.
              </p>
            </div>

            {/* ── Error banner ── */}
            {submitState === "error" && submitError && (
              <div className="flex items-start gap-2 bg-[#FEE2E2] border border-[#FCA5A5] rounded-xl px-4 py-3">
                <Icon name="error" className="text-[#991B1B] !text-[20px] shrink-0 mt-0.5" />
                <p className="font-label-md text-[12px] text-[#991B1B] leading-relaxed">{submitError}</p>
              </div>
            )}

            {/* ── Confirm Button ── */}
            <div className="flex flex-col gap-3 pb-4">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!confirmEnabled || submitState === "loading"}
                className="w-full h-11 bg-primary text-white rounded-lg flex items-center justify-center gap-2 font-headline-sm text-[15px] font-bold active:scale-[0.98] transition-transform disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitState === "loading" ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Menyimpan...
                  </>
                ) : !confirmEnabled ? (
                  <>
                    <Icon name="timer" className="!text-[20px]" />
                    Konfirmasi dalam {countdown} detik...
                  </>
                ) : (
                  <>
                    <Icon name="check_circle" className="!text-[20px]" />
                    Konfirmasi & Buat Laporan
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => navigate({ to: "/upload" })}
                disabled={submitState === "loading"}
                className="w-full h-11 border border-primary-container text-primary-container rounded-lg flex items-center justify-center gap-2 font-label-md text-[14px] font-bold hover:bg-primary-container/5 transition-colors"
              >
                <Icon name="refresh" className="!text-[20px]" />
                {isBatch ? "Upload Batch Baru" : "Analisis Ulang dengan Foto Baru"}
              </button>
            </div>
          </div>
        </main>
      )}

      {/* ── Hidden file input for Ganti Foto ── */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/jpg"
        className="hidden"
        onChange={handleFileReplace}
      />

      {/* ── Fraud Warning Modal ── */}
      <FraudWarningModal
        isOpen={fraudModal.isOpen}
        status={fraudModal.status}
        title={fraudModal.title}
        message={fraudModal.message}
        onClose={closeFraudModal}
        isWarningOnly={fraudModal.isWarningOnly}
      />

      {/* ── Fullscreen Lightbox ── */}
      {fullscreenIdx !== null && (
        <Portal>
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={() => setFullscreenIdx(null)}
          >
            <button
              type="button"
              onClick={() => setFullscreenIdx(null)}
              className="absolute top-4 right-4 w-10 h-10 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center transition-colors z-10"
            >
              <Icon name="close" className="!text-[22px]" />
            </button>

            {isBatch && batchResult!.photos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFullscreenIdx((i) => Math.max(0, i! - 1));
                  }}
                  disabled={fullscreenIdx === 0}
                  className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center disabled:opacity-30 transition-colors z-10"
                >
                  <Icon name="chevron_left" className="!text-[24px]" />
                </button>
                <span className="absolute top-4 left-4 px-3 py-1 bg-black/40 text-white text-[13px] font-semibold rounded-full z-10">
                  {fullscreenIdx + 1} / {batchResult!.photos.length}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFullscreenIdx((i) => Math.min(batchResult!.photos.length - 1, i! + 1));
                  }}
                  disabled={fullscreenIdx === batchResult!.photos.length - 1}
                  className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center disabled:opacity-30 transition-colors z-10"
                >
                  <Icon name="chevron_right" className="!text-[24px]" />
                </button>
              </>
            )}

            <img
              src={
                isBatch
                  ? batchResult!.photos[fullscreenIdx].imageResult
                    ? `data:image/jpeg;base64,${batchResult!.photos[fullscreenIdx].imageResult}`
                    : batchResult!.photos[fullscreenIdx].previewUrl
                  : displayImage
                    ? `data:image/jpeg;base64,${displayImage}`
                    : previewSrc
              }
              alt="Hasil deteksi AI — fullscreen"
              className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg select-none"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </Portal>
      )}

      {/* ── Submit Loading Overlay ── */}
      {submitState === "loading" && (
        <Portal>
          <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl px-6 py-7 w-[280px] shadow-2xl flex flex-col items-center gap-4">
              <span className="w-10 h-10 border-[3px] border-[#1e40af]/20 border-t-[#1e40af] rounded-full animate-spin" />
              <h3 className="font-headline-sm text-[16px] font-bold text-on-surface text-center">
                Menyimpan Laporan
              </h3>
              <p className="font-body-md text-sm text-[#64748B] text-center">
                Mohon tunggu, jangan tutup halaman ini
              </p>
            </div>
          </div>
        </Portal>
      )}
    </PageLayout>
  );
}
