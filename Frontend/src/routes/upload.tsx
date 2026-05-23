import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Icon } from "@/components/jk/Icon";
import { TopBar } from "@/components/jk/TopBar";
import { AppLayout } from "@/components/jk/AppLayout";
import { FraudWarningModal } from "@/components/jk/FraudWarningModal";
import { DuplicateChecker } from "@/components/jk/DuplicateChecker";
import { useRef, useState, useCallback, useEffect } from "react";
import { setAiResult, setFormData, setBatchResult, API_BASE_URL } from "@/lib/aiStore";
import {
  useLocationFromPhoto,
  type GpsStatus,
} from "@/hooks/useLocationFromPhoto";
import { useDuplicateCheck } from "@/hooks/useDuplicateCheck";
import { useGPS } from "@/hooks/useGPS";
import {
  useRoadSearch,
  type RoadSuggestion,
} from "@/hooks/useRoadSearch";
import {
  validatePhotoDate,
  isExifBlocking,
  type PhotoDateValidationStatus,
} from "@/lib/validatePhotoDate";
import { getCurrentUser, getToken } from "@/lib/auth";
import type { BatchAnalysisResponse } from "@/types/laporan";

export const Route = createFileRoute("/upload")({
  component: UploadPage,
  head: () => ({ meta: [{ title: "Upload & Analisis — JalanKita" }] }),
});

const TODAY = new Date().toISOString().split("T")[0];

const KECAMATAN_LIST = [
  { group: "Pusat",   items: ["Sidoarjo"] },
  { group: "Utara",   items: ["Buduran", "Gedangan", "Sedati", "Waru"] },
  { group: "Barat",   items: ["Taman", "Krian", "Balongbendo", "Wonoayu", "Sukodono"] },
  { group: "Timur",   items: ["Candi", "Tarik", "Prambon"] },
  { group: "Selatan", items: ["Porong", "Krembung", "Tulangan", "Tanggulangin", "Jabon"] },
];

const ALL_KECAMATAN = KECAMATAN_LIST.flatMap((g) => g.items);

type AnalysisState = "idle" | "loading" | "error";

// ── GPS Status Banner ──────────────────────────────────────────────────────

function GpsBanner({
  status,
  message,
  lat,
  lng,
}: {
  status: GpsStatus;
  message: string;
  lat: number | null;
  lng: number | null;
}) {
  if (status === "idle") return null;

  const variants: Record<
    string,
    { bg: string; border: string; text: string; icon: string }
  > = {
    detecting: {
      bg: "bg-[#EFF6FF]", border: "border-[#93C5FD]",
      text: "text-[#1E40AF]", icon: "gps_fixed",
    },
    geocoding: {
      bg: "bg-[#EFF6FF]", border: "border-[#93C5FD]",
      text: "text-[#1E40AF]", icon: "travel_explore",
    },
    success: {
      bg: "bg-[#D1FAE5]", border: "border-[#6EE7B7]",
      text: "text-[#065F46]", icon: "check_circle",
    },
    exif_no_gps: {
      bg: "bg-[#FEF3C7]", border: "border-[#FCD34D]",
      text: "text-[#92400E]", icon: "info",
    },
    permission_denied: {
      bg: "bg-[#FEE2E2]", border: "border-[#FCA5A5]",
      text: "text-[#991B1B]", icon: "location_off",
    },
    timeout: {
      bg: "bg-[#FEF3C7]", border: "border-[#FCD34D]",
      text: "text-[#92400E]", icon: "timer_off",
    },
    error: {
      bg: "bg-[#FEE2E2]", border: "border-[#FCA5A5]",
      text: "text-[#991B1B]", icon: "error",
    },
  };

  const v = variants[status] ?? variants.error;
  const isSpinning = status === "detecting" || status === "geocoding";

  return (
    <div className={`flex items-start gap-2.5 ${v.bg} border ${v.border} rounded-xl px-4 py-3`}>
      {isSpinning ? (
        <span className={`w-5 h-5 border-2 border-current/30 border-t-current rounded-full animate-spin shrink-0 mt-0.5 ${v.text}`} />
      ) : (
        <Icon name={v.icon} className={`${v.text} !text-[20px] shrink-0 mt-0.5`} filled={status === "success"} />
      )}
      <div className="flex-1 min-w-0">
        <p className={`font-label-md text-[12px] leading-relaxed ${v.text}`}>{message}</p>
        {status === "success" && lat !== null && lng !== null && (
          <p className={`font-id-code text-[10px] mt-0.5 ${v.text} opacity-70`}>
            {lat.toFixed(6)}, {lng.toFixed(6)}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

function UploadPage() {
  const navigate = useNavigate();
  const { gps, startWatching, stopWatching } = useGPS();
  const user = getCurrentUser();

  // Dua input terpisah: kamera dan galeri — keduanya support multiple untuk batch
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl]     = useState<string | null>(null);
  const [namaJalan, setNamaJalan]       = useState("");
  const [kecamatan, setKecamatan]       = useState("Sidoarjo");
  const [tanggal, setTanggal]           = useState(TODAY);
  const [catatan, setCatatan]           = useState("");

  // Analysis state
  const [analysisState, setAnalysisState] = useState<AnalysisState>("idle");
  const [errorMsg, setErrorMsg]           = useState("");

  // Anti-fraud modal state
  const [fraudModal, setFraudModal] = useState<{
    isOpen: boolean;
    status: PhotoDateValidationStatus;
    title: string;
    message: string;
    isWarningOnly: boolean;
  }>({
    isOpen: false,
    status: "no_exif_date",
    title: "",
    message: "",
    isWarningOnly: false,
  });

  // State untuk tombol "Gunakan GPS Saya" (foto tanpa EXIF GPS)
  const [isRequestingLiveGps, setIsRequestingLiveGps] = useState(false);
  const [liveGpsError, setLiveGpsError] = useState("");

  // Koordinat yang dipilih dari road search (Nominatim)
  const [roadCoords, setRoadCoords] = useState<{ lat: number; lng: number } | null>(null);

  // State untuk menyembunyikan tombol submit utama saat "Dukung Laporan" dipilih
  const [isSubmitHidden, setIsSubmitHidden] = useState(false);

  // ── State Batch Upload (Task 4A) ─────────────────────────────────────────
  const [selectedFiles, setSelectedFiles]   = useState<File[]>([]);
  const [previewUrls, setPreviewUrls]       = useState<string[]>([]);
  const [roadNameSource, setRoadNameSource] = useState<'autocomplete' | 'manual' | null>(null);
  const [uploadPhase, setUploadPhase]       = useState<
    'idle' | 'uploading' | 'analyzing' | 'validating' | 'done' | 'error'
  >('idle');
  const [batchError, setBatchError] = useState("");

  // Status EXIF per file dalam batch — ditampilkan langsung di grid preview
  // key = index file dalam selectedFiles
  const [fileExifStatus, setFileExifStatus] = useState<
    Record<number, { status: 'checking' | 'valid' | 'warning' | 'rejected'; message: string }>
  >({});

  // ── Callbacks untuk hook lokasi ──────────────────────────────────────────

  const handleLocationResolved = useCallback(
    (
      resolvedNamaJalan: string,
      resolvedKecamatan: string | null,
      _lat: number,
      _lng: number,
      roadNameLocked: boolean
    ) => {
      // Jika LocationIQ menemukan address.road → isi dan kunci field nama jalan
      // Jika tidak → kosongkan agar user bisa ketik nama gang/jalan manual
      setNamaJalan(roadNameLocked ? resolvedNamaJalan : "");
      if (resolvedKecamatan && ALL_KECAMATAN.includes(resolvedKecamatan)) {
        setKecamatan(resolvedKecamatan);
      }
    },
    []
  );

  const handleLocationFailed = useCallback((_reason: GpsStatus) => {
    // GPS tidak tersedia — user akan memilih jalan via autocomplete Nominatim
    setLiveGpsError("");
  }, []);

  const { locationState, handleCameraCapture, handleGallerySelect, resetLocation } =
    useLocationFromPhoto(handleLocationResolved, handleLocationFailed);

  // Saat GPS dari hook berhasil (live/EXIF), hapus roadCoords agar tidak konflik
  useEffect(() => {
    if (locationState.status === "success") {
      setRoadCoords(null);
      setLiveGpsError("");
    }
  }, [locationState.status]);

  // Mulai watch GPS untuk deteksi fake GPS (data dipakai di handleSubmitBatch)
  // useGPS() hanya idle sampai startWatching() dipanggil.
  useEffect(() => { startWatching(); }, []);

  // ── Road Search (Nominatim Autocomplete) ─────────────────────────────────

  /**
   * Dipanggil saat user memilih saran jalan dari dropdown.
   * Mengisi nama jalan, kecamatan, dan menyimpan koordinat dari Nominatim.
   */
  const handleRoadSelect = useCallback(
    (suggestion: RoadSuggestion) => {
      setNamaJalan(suggestion.roadName);
      if (suggestion.kecamatan && ALL_KECAMATAN.includes(suggestion.kecamatan)) {
        setKecamatan(suggestion.kecamatan);
      }
      setRoadCoords({ lat: suggestion.lat, lng: suggestion.lng });
      setLiveGpsError("");
      // Tandai sebagai dipilih dari autocomplete (Task 4E)
      setRoadNameSource('autocomplete');
    },
    []
  );

  const roadSearch = useRoadSearch(handleRoadSelect);

  // ── Live GPS untuk foto tanpa EXIF ───────────────────────────────────────

  /** Minta koordinat GPS live dari browser — tombol fallback saat foto tidak punya EXIF GPS */
  const handleRequestLiveGps = useCallback(async () => {
    setIsRequestingLiveGps(true);
    setLiveGpsError("");
    try {
      const pos = await new Promise<GeolocationCoordinates>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("Geolocation tidak didukung browser ini."));
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (p) => resolve(p.coords),
          (err) => reject(err),
          { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }
        );
      });
      // Simpan ke roadCoords agar dipakai saat submit
      setRoadCoords({ lat: pos.latitude, lng: pos.longitude });
    } catch (err) {
      if (
        err instanceof GeolocationPositionError &&
        err.code === GeolocationPositionError.PERMISSION_DENIED
      ) {
        setLiveGpsError(
          "Izin lokasi ditolak. Aktifkan GPS di pengaturan browser, atau pilih nama jalan dari saran untuk mendapatkan koordinat otomatis."
        );
      } else {
        setLiveGpsError(
          "Gagal mendapatkan GPS. Pilih nama jalan dari saran untuk mendapatkan koordinat otomatis."
        );
      }
    } finally {
      setIsRequestingLiveGps(false);
    }
  }, []);

  /**
   * Koordinat efektif yang akan dipakai saat submit:
   * - Prioritas 1: GPS dari hook (live kamera / EXIF galeri)
   * - Prioritas 2: Koordinat dari road search Nominatim
   * - Prioritas 3: Koordinat dari tombol live GPS fallback
   *
   * Dideklarasikan di sini (sebelum handler batch) agar bisa dipakai
   * di handleSubmitBatch tanpa "Cannot access before initialization".
   */
  const effectiveLat: number | null = locationState.lat ?? roadCoords?.lat ?? null;
  const effectiveLng: number | null = locationState.lng ?? roadCoords?.lng ?? null;

  /**
   * Apakah perlu menampilkan panel GPS fallback?
   * Ya, jika foto tidak punya GPS EXIF dan live GPS dari hook juga tidak aktif.
   */
  const needsGpsFallback =
    locationState.status === "exif_no_gps" ||
    locationState.status === "permission_denied" ||
    locationState.status === "timeout" ||
    locationState.status === "error";

  // ── Handler Batch Upload (Task 4C) ───────────────────────────────────────

  /**
   * Handler saat user memilih beberapa file sekaligus.
   * Validasi tipe dan ukuran, gabungkan dengan file yang sudah ada (maks 20).
   * Langsung cek EXIF per file di background — tampilkan warning/rejected di grid.
   */
  const handleFilesSelected = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const valid: File[] = [];
    Array.from(files).forEach(file => {
      if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) return;
      if (file.size > 5 * 1024 * 1024) return;
      valid.push(file);
    });
    const startIdx = selectedFiles.length;
    const merged   = [...selectedFiles, ...valid].slice(0, 20);
    setSelectedFiles(merged);
    setPreviewUrls(prev => {
      prev.forEach(u => URL.revokeObjectURL(u));
      return merged.map(f => URL.createObjectURL(f));
    });

    // Tandai semua file baru sebagai "checking" dulu
    setFileExifStatus(prev => {
      const next = { ...prev };
      valid.slice(0, 20 - selectedFiles.length).forEach((_, i) => {
        next[startIdx + i] = { status: 'checking', message: 'Memeriksa metadata...' };
      });
      return next;
    });

    // Validasi EXIF per file secara paralel — tidak blokir UI
    const checks = valid.slice(0, 20 - selectedFiles.length).map(async (file, i) => {
      const idx    = startIdx + i;
      const result = await validatePhotoDate(file);
      let status: 'valid' | 'warning' | 'rejected';
      let message: string;

      if (result.status === 'valid') {
        status  = 'valid';
        message = 'Foto valid';
      } else if (isExifBlocking(result.status)) {
        status  = 'rejected';
        message = result.message;
      } else {
        // Fallback — semua status error di atas sudah blocking,
        // cabang ini hanya tercapai jika ada status baru yang ditambahkan
        status  = 'warning';
        message = 'Metadata foto tidak lengkap — gunakan foto asli dari kamera';
      }

      setFileExifStatus(prev => ({ ...prev, [idx]: { status, message } }));
    });

    await Promise.all(checks);
  }, [selectedFiles]);

  /**
   * Hapus satu foto dari daftar batch.
   */
  const removeBatchFile = useCallback((idx: number) => {
    URL.revokeObjectURL(previewUrls[idx]);
    setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
    setPreviewUrls(prev => prev.filter((_, i) => i !== idx));
    // Re-index fileExifStatus setelah file dihapus
    setFileExifStatus(prev => {
      const next: typeof prev = {};
      Object.entries(prev).forEach(([key, val]) => {
        const k = parseInt(key);
        if (k < idx) next[k] = val;
        else if (k > idx) next[k - 1] = val;
        // k === idx dibuang
      });
      return next;
    });
  }, [previewUrls]);

  /**
   * Submit batch: kirim ke AI server → simpan laporan batch.
   * Alur dua fase sesuai solution.md Task 4G.
   */
  const handleSubmitBatch = useCallback(async () => {
    setBatchError("");

    if (selectedFiles.length === 0) {
      setBatchError("Pilih minimal 1 foto untuk batch upload.");
      return;
    }
    if (roadNameSource !== 'autocomplete') {
      setBatchError("Nama jalan harus dipilih dari saran autocomplete, bukan diketik manual.");
      return;
    }

    // Gunakan koordinat dari EXIF/live GPS/road search (sama seperti single upload)
    const batchLat = effectiveLat;
    const batchLng = effectiveLng;

    if (!batchLat || !batchLng) {
      setBatchError("Koordinat belum tersedia. Pilih nama jalan dari saran untuk mendapatkan koordinat otomatis.");
      return;
    }

    const token = getToken() ?? '';

    try {
      // ── Fase 1: Kirim ke AI server untuk analisis ─────────────────────
      setUploadPhase('uploading');
      const fd1 = new FormData();
      // Gunakan key "files[]" (bukan "files[0]") agar Laravel parse sebagai array
      selectedFiles.forEach((f) => fd1.append('files[]', f));
      fd1.append('latitude',  String(batchLat));
      fd1.append('longitude', String(batchLng));

      setUploadPhase('analyzing');
      const r1 = await fetch(`${API_BASE_URL}/analyze-batch`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
        body:    fd1,
      });

      if (!r1.ok) {
        const errData = await r1.json().catch(() => ({}));
        // Tampilkan detail validasi error jika ada
        const detail = errData.errors
          ? Object.values(errData.errors as Record<string, string[]>).flat().join(' | ')
          : null;
        throw new Error(detail ?? errData.message ?? `Analisis AI gagal (HTTP ${r1.status})`);
      }

      const batchData: BatchAnalysisResponse = await r1.json();

      if (batchData.photos_rejected === batchData.total_files) {
        throw new Error("Semua foto ditolak karena tidak memiliki metadata EXIF tanggal yang valid, atau tidak bisa dibaca.");
      }

      // ── Fase 2: Simpan laporan ke database ────────────────────────────
      setUploadPhase('validating');
      const fd2 = new FormData();
      fd2.append('batch_id',          batchData.batch_id);
      fd2.append('road_name',         namaJalan);
      fd2.append('district',          kecamatan);
      fd2.append('latitude',          String(batchLat));
      fd2.append('longitude',         String(batchLng));
      fd2.append('koordinat_sumber',  locationState.source === 'camera' ? 'browser_gps' : locationState.lat ? 'exif' : 'manual');
      fd2.append('fake_gps_suspected', gps.fake_gps_suspected ? '1' : '0');
      fd2.append('analyses',          JSON.stringify(batchData.analyses));
      // Gunakan key "files[]" agar Laravel parse sebagai array
      selectedFiles.forEach((f) => fd2.append('files[]', f));

      const r2 = await fetch(`${API_BASE_URL}/reports/batch`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
        body:    fd2,
      });

      if (!r2.ok) {
        const errData = await r2.json().catch(() => ({}));
        const detail = errData.errors
          ? Object.values(errData.errors as Record<string, string[]>).flat().join(' | ')
          : null;
        throw new Error(detail ?? errData.message ?? `Simpan laporan gagal (HTTP ${r2.status})`);
      }

      const reportData = await r2.json();

      // ── Simpan ke aiStore SEBELUM navigate ────────────────────────────
      const batchAnalyses = batchData.analyses;

      const normSev = (s: string) =>
        s === 'berat' ? 'Rusak Berat' : s === 'sedang' ? 'Rusak Sedang' : 'Rusak Ringan';

      const overallSev = normSev(reportData.overall_severity ?? 'ringan');

      const allDetections = batchAnalyses.flatMap(a =>
        a.detections.map(d => ({
          class:      d.type,
          severity:   normSev(a.severity),
          confidence: d.confidence,
          bbox:       { x1: d.bbox[0] ?? 0, y1: d.bbox[1] ?? 0, x2: d.bbox[2] ?? 0, y2: d.bbox[3] ?? 0 },
        }))
      );

      // Synthetic single result — agar guard di ai-result tidak redirect
      setAiResult({
        detections:       allDetections,
        total:            allDetections.length,
        overall_severity: overallSev,
        image_result:     batchAnalyses[0]?.image_result ?? '',
        status:           'success',
      });

      // Data batch lengkap per foto — untuk tampilan carousel di ai-result
      setBatchResult({
        photos: batchAnalyses.map((a, idx) => ({
          fileIndex:   a.file_index,
          fileName:    a.file_name,
          imageResult: a.image_result ?? '',
          previewUrl:  previewUrls[idx] ?? '',
          detections:  a.detections.map(d => ({
            class:      d.type,
            severity:   normSev(a.severity),
            confidence: d.confidence,
            bbox:       { x1: d.bbox[0] ?? 0, y1: d.bbox[1] ?? 0, x2: d.bbox[2] ?? 0, y2: d.bbox[3] ?? 0 },
          })),
          severity:    normSev(a.severity),
          confidence:  a.confidence,
          hasError:    !!a.error,
        })),
        totalDetections: allDetections.length,
        overallSeverity: overallSev,
        reportCode:      reportData.main_report_code ?? '',
        trustScore:      reportData.trust_score ?? 0,
        trustLabel:      reportData.trust_label ?? 'merah',
      });

      setFormData({
        namaJalan,
        kecamatan,
        tanggal,
        catatan,
        previewUrl: previewUrls[0] ?? '',
        fileName:   `${selectedFiles.length} foto (batch)`,
        lat:        batchLat,
        lng:        batchLng,
      });

      setUploadPhase('done');

      console.info('JalanKita: Batch upload berhasil.', {
        batchId:         batchData.batch_id,
        mainReportCode:  reportData.main_report_code,
        subReportsCount: reportData.sub_reports_count,
        trustScore:      reportData.trust_score,
        trustLabel:      reportData.trust_label,
      });

      // Navigate setelah store terisi
      navigate({ to: '/ai-result' });

    } catch (err) {
      setUploadPhase('error');
      setBatchError(err instanceof Error ? err.message : 'Terjadi kesalahan saat upload batch.');
    }
  }, [
    selectedFiles, roadNameSource, effectiveLat, effectiveLng,
    namaJalan, kecamatan, tanggal, catatan, previewUrls, navigate, locationState.source, locationState.lat,
  ]);

  // ── Duplicate Check Hook ─────────────────────────────────────────────────
  // Requirement 6.6: useDuplicateCheck menggunakan state form yang sudah ada

  const isGpsActive = locationState.status === "success" && locationState.roadNameLocked;
  const isGpsDetecting =
    locationState.status === "detecting" || locationState.status === "geocoding";

  const {
    checkState,
    result: duplicateResult,
    hasDuplicates,
    addEvidenceState,
    addEvidenceTargetId,
    addEvidenceMessage,
    submitEvidence,
    reset: resetDuplicateCheck,
  } = useDuplicateCheck(
    effectiveLat,
    effectiveLng,
    kecamatan,
    namaJalan,
    isGpsActive
  );

  // Handler saat tombol "Dukung Laporan" diklik
  const handleSupportReport = useCallback(
    async (reportId: string) => {
      if (!selectedFile) return;
      const reporterName = user?.name ?? "Petugas";
      // Sembunyikan tombol submit utama (Requirement 4.7)
      setIsSubmitHidden(true);
      await submitEvidence(reportId, selectedFile, reporterName);
      // Jika error, aktifkan kembali tombol submit (Requirement 4.9)
      if (addEvidenceState === "error") {
        setIsSubmitHidden(false);
      }
    },
    [selectedFile, user, submitEvidence, addEvidenceState]
  );

  // ── File handling ────────────────────────────────────────────────────────

  function validateFile(file: File): string | null {
    if (!file.type.match(/^image\/(jpeg|jpg|png)$/)) {
      return "File harus berupa gambar JPG atau PNG.";
    }
    if (file.size > 5 * 1024 * 1024) {
      return "Ukuran file maksimal 5MB.";
    }
    return null;
  }

  function applyFile(file: File, source: "camera" | "gallery") {
    const err = validateFile(file);
    if (err) { setErrorMsg(err); return false; }
    setErrorMsg("");
    setSelectedFile(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    return true;
  }

  /** Dipanggil saat user mengambil foto via kamera */
  async function handleCameraChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (files.length > 1) {
      // Mode batch: validasi EXIF per file sudah ada di handleFilesSelected
      // Foto dari kamera tidak perlu validasi tanggal (foto baru)
      await handleFilesSelected(files);
      return;
    }

    // Mode single: alur lama
    const file = files[0];
    if (!applyFile(file, "camera")) return;
    await handleCameraCapture(file);
  }

  /** Dipanggil saat user memilih foto dari galeri */
  async function handleGalleryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (files.length > 1) {
      // Mode batch: validasi EXIF per file sudah ada di handleFilesSelected
      await handleFilesSelected(files);
      return;
    }

    // Mode single: alur lama dengan validasi EXIF
    const file = files[0];

    // ── Validasi Anti-Fraud Tanggal EXIF ──────────────────────────────────
    const dateValidation = await validatePhotoDate(file);

    if (dateValidation.status !== "valid") {
      if (isExifBlocking(dateValidation.status)) {
        setFraudModal({
          isOpen: true,
          status: dateValidation.status,
          title: dateValidation.title,
          message: dateValidation.message,
          isWarningOnly: false,
        });
        if (galleryInputRef.current) galleryInputRef.current.value = "";
        return;
      } else {
        setFraudModal({
          isOpen: true,
          status: dateValidation.status,
          title: dateValidation.title,
          message: dateValidation.message,
          isWarningOnly: true,
        });
      }
    }

    if (!applyFile(file, "gallery")) return;
    await handleGallerySelect(file);
  }

  /** Drag & drop → perlakukan seperti galeri (validasi EXIF juga berlaku) */
  async function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    // Validasi anti-fraud tanggal EXIF (sama seperti galeri)
    const dateValidation = await validatePhotoDate(file);
    if (dateValidation.status !== "valid") {
      if (isExifBlocking(dateValidation.status)) {
        // Blokir upload
        setFraudModal({
          isOpen: true,
          status: dateValidation.status,
          title: dateValidation.title,
          message: dateValidation.message,
          isWarningOnly: false,
        });
        return;
      } else {
        // Hanya peringatan — lanjut upload
        setFraudModal({
          isOpen: true,
          status: dateValidation.status,
          title: dateValidation.title,
          message: dateValidation.message,
          isWarningOnly: true,
        });
        // Lanjut ke applyFile — TIDAK return
      }
    }

    if (!applyFile(file, "gallery")) return;
    handleGallerySelect(file);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  function removeFile() {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    // Reset batch juga
    previewUrls.forEach(u => URL.revokeObjectURL(u));
    setSelectedFiles([]);
    setPreviewUrls([]);
    setFileExifStatus({});
    setBatchError("");
    setUploadPhase('idle');
    resetLocation();
    resetDuplicateCheck();
    roadSearch.reset();
    setIsSubmitHidden(false);
    setNamaJalan("");
    setKecamatan("Sidoarjo");
    setRoadCoords(null);
    setLiveGpsError("");
    setRoadNameSource(null);
    if (cameraInputRef.current)  cameraInputRef.current.value  = "";
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  }

  function closeFraudModal() {
    setFraudModal((s) => ({ ...s, isOpen: false }));
  }

  // ── Analisis AI ──────────────────────────────────────────────────────────

  async function handleAnalyze() {
    if (!selectedFile) {
      setErrorMsg("Pilih foto terlebih dahulu sebelum menganalisis.");
      return;
    }

    // ── Validasi koordinat GPS ────────────────────────────────────────────
    // Koordinat wajib ada — dari EXIF, live GPS kamera, road search, atau GPS fallback
    if (effectiveLat === null || effectiveLng === null) {
      setErrorMsg(
        "Koordinat GPS belum tersedia. " +
        "Pilih nama jalan dari saran untuk mendapatkan koordinat otomatis, " +
        "atau gunakan tombol \"Gunakan GPS Saya\"."
      );
      return;
    }
    // ── End validasi koordinat ────────────────────────────────────────────

    setAnalysisState("loading");
    setErrorMsg("");

    try {
      const fd = new FormData();
      fd.append("file", selectedFile);

      const response = await fetch(`${API_BASE_URL}/analyze`, {
        method: "POST",
        body: fd,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Server error ${response.status}: ${errText}`);
      }

      const result = await response.json();

      setAiResult(result);
      setFormData({
        namaJalan: namaJalan || "Tidak diketahui",
        kecamatan,
        tanggal,
        catatan,
        previewUrl: previewUrl ?? "",
        fileName: selectedFile.name,
        lat: effectiveLat,
        lng: effectiveLng,
      });

      setAnalysisState("idle");
      navigate({ to: "/ai-result" });
    } catch (err) {
      console.error("Analyze error:", err);
      setAnalysisState("error");
      if (err instanceof TypeError && err.message.includes("fetch")) {
        setErrorMsg(
          "Tidak dapat terhubung ke server AI. Pastikan server berjalan di localhost:8000."
        );
      } else {
        setErrorMsg(
          err instanceof Error ? err.message : "Terjadi kesalahan saat menganalisis."
        );
      }
    }
  }

  const isLoading = analysisState === "loading";
  const isGpsWorking =
    locationState.status === "detecting" || locationState.status === "geocoding";

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen w-full">
        <TopBar title="Upload & Analisis" back="/home" />

        <main className="flex-1 overflow-y-auto px-4 pt-4 pb-6 w-full">
          {/* 
            PENTING: div pembatas lebar ini TIDAK boleh pakai mx-auto langsung
            sebagai flex item. Gunakan block display (default div) di dalam
            main yang sudah w-full, lalu mx-auto bekerja sebagai block margin.
          */}
          <div style={{ maxWidth: "42rem", marginLeft: "auto", marginRight: "auto" }} className="flex flex-col gap-4">

            {/* ── Upload Zone / Preview ── */}
            {selectedFiles.length > 0 ? (
              /* ── Preview Batch (multi-foto) ── */
              <div className="rounded-xl border border-border-subtle overflow-hidden shadow-sm bg-surface-container-lowest">
                <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-border-subtle">
                  <span className="font-label-md text-[13px] font-semibold text-[#0F172A]">
                    {selectedFiles.length} foto dipilih
                    <span className="text-on-surface-variant font-normal ml-1">(maks 20)</span>
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex items-center gap-1 text-primary-container font-label-md text-[12px] font-semibold hover:underline"
                    >
                      <Icon name="add_a_photo" className="!text-[14px]" />
                      Tambah
                    </button>
                    <button
                      type="button"
                      onClick={removeFile}
                      className="flex items-center gap-1 text-[#EF4444] font-label-md text-[12px] font-semibold hover:underline"
                    >
                      <Icon name="delete_sweep" className="!text-[14px]" />
                      Hapus Semua
                    </button>
                  </div>
                </div>
                <div className="p-3 grid grid-cols-3 gap-2">
                  {previewUrls.map((url, idx) => {
                    const exif = fileExifStatus[idx];
                    const isRejected = exif?.status === 'rejected';
                    const isWarning  = exif?.status === 'warning';
                    const isChecking = exif?.status === 'checking';
                    return (
                      <div
                        key={idx}
                        className={`relative aspect-square rounded-lg overflow-hidden ${
                          isRejected ? 'ring-2 ring-red-500' : isWarning ? 'ring-2 ring-yellow-400' : ''
                        } bg-surface-container-high`}
                        title={exif?.message}
                      >
                        <img
                          src={url}
                          alt={`Foto ${idx + 1}`}
                          className={`w-full h-full object-cover ${isRejected ? 'opacity-40' : ''}`}
                        />

                        {/* Overlay merah untuk foto yang ditolak */}
                        {isRejected && (
                          <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                            <div className="bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded text-center leading-tight max-w-[90%]">
                              DITOLAK
                            </div>
                          </div>
                        )}

                        {/* Badge status EXIF di pojok kiri atas */}
                        {isChecking && (
                          <div className="absolute top-1 left-1 w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        )}
                        {isWarning && !isChecking && (
                          <div className="absolute top-1 left-1 bg-yellow-400 text-yellow-900 text-[8px] font-bold px-1 rounded">
                            ⚠
                          </div>
                        )}
                        {exif?.status === 'valid' && (
                          <div className="absolute top-1 left-1 bg-green-500 text-white text-[8px] font-bold px-1 rounded">
                            ✓
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => removeBatchFile(idx)}
                          className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-red-500 text-white rounded-full text-xs flex items-center justify-center transition-colors"
                          aria-label={`Hapus foto ${idx + 1}`}
                        >
                          <Icon name="close" className="!text-[12px]" />
                        </button>
                        <div className="absolute bottom-1 left-1 bg-black/50 text-white text-[9px] px-1 rounded font-mono">
                          {idx + 1}
                        </div>
                      </div>
                    );
                  })}
                  {/* Tombol tambah foto inline */}
                  {selectedFiles.length < 20 && (
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="aspect-square rounded-lg border-2 border-dashed border-border-subtle flex flex-col items-center justify-center gap-1 hover:border-primary-container hover:bg-primary-container/5 transition-colors"
                    >
                      <Icon name="add_photo_alternate" className="text-on-surface-variant !text-[24px]" />
                      <span className="text-[10px] text-on-surface-variant">Tambah</span>
                    </button>
                  )}
                </div>
                {/* Ringkasan status EXIF — tampil jika ada foto bermasalah */}
                {Object.values(fileExifStatus).some(s => s.status === 'rejected' || s.status === 'warning') && (
                  <div className="space-y-1">
                    {Object.entries(fileExifStatus)
                      .filter(([, s]) => s.status === 'rejected' || s.status === 'warning')
                      .map(([idx, s]) => (
                        <div
                          key={idx}
                          className={`flex items-start gap-2 px-3 py-2 rounded-lg text-[11px] ${
                            s.status === 'rejected'
                              ? 'bg-red-50 border border-red-200 text-red-700'
                              : 'bg-yellow-50 border border-yellow-200 text-yellow-800'
                          }`}
                        >
                          <span className="shrink-0 font-bold">Foto {parseInt(idx) + 1}:</span>
                          <span>{s.message}</span>
                          {s.status === 'rejected' && (
                            <button
                              type="button"
                              onClick={() => removeBatchFile(parseInt(idx))}
                              className="ml-auto shrink-0 underline font-medium"
                            >
                              Hapus
                            </button>
                          )}
                        </div>
                      ))}
                  </div>
                )}

                {/* Error batch */}
                {batchError && (
                  <div className="mx-3 mb-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    <Icon name="error" className="text-red-600 !text-[14px] shrink-0 mt-0.5" />
                    <p className="text-[11px] text-red-700">{batchError}</p>
                  </div>
                )}
              </div>
            ) : !selectedFile ? (
              /* ── Upload Zone (kosong) ── */
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-border-subtle rounded-xl bg-bg-surface px-5 py-10 flex flex-col items-center text-center"
              >
                <div className="w-14 h-14 mb-4 rounded-full bg-primary-container/10 flex items-center justify-center">
                  <Icon name="cloud_upload" className="text-primary-container !text-[32px]" />
                </div>
                <h2 className="font-headline-sm text-headline-sm font-bold text-[#0F172A] mb-1">
                  Foto Kerusakan Jalan
                </h2>
                <p className="font-body-md text-body-md text-on-surface-variant mb-6 px-4">
                  Ambil 1 foto atau pilih banyak sekaligus (batch)
                </p>

                <div className="flex gap-3 w-full justify-center">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex-1 max-w-[160px] flex items-center justify-center gap-2 bg-primary-container text-white rounded-xl px-4 py-3 font-label-md text-[13px] font-semibold hover:bg-primary-container/90 active:scale-95 transition-all"
                  >
                    <Icon name="photo_camera" className="!text-[20px]" />
                    Kamera
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="flex-1 max-w-[160px] flex items-center justify-center gap-2 border-2 border-primary-container text-primary-container rounded-xl px-4 py-3 font-label-md text-[13px] font-semibold hover:bg-primary-container/5 active:scale-95 transition-all"
                  >
                    <Icon name="photo_library" className="!text-[20px]" />
                    Galeri
                  </button>
                </div>

                <span className="mt-5 font-label-sm text-label-sm text-[#94A3B8]">
                  Format JPG/PNG · Maks. 5MB/foto · Pilih banyak untuk batch
                </span>

                <div className="mt-4 w-full text-left text-[11px] text-[#64748B] bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg p-3">
                  <p className="font-semibold mb-1">💡 Tips:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li><strong>1 foto:</strong> Analisis AI langsung, simpan laporan tunggal</li>
                    <li><strong>Banyak foto:</strong> Tahan Ctrl/Shift atau pilih semua — upload batch sekaligus</li>
                  </ul>
                </div>
              </div>
            ) : (
              /* ── Preview Single Foto ── */
              <div className="rounded-xl border border-border-subtle overflow-hidden shadow-sm bg-surface-container-lowest">
                <div className="relative w-full aspect-video bg-surface-container-high">
                  <img
                    src={previewUrl!}
                    alt="Preview foto"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={removeFile}
                    className="absolute top-2 right-2 w-8 h-8 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
                    title="Hapus foto"
                  >
                    <Icon name="close" className="!text-[18px]" />
                  </button>
                  <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 rounded-lg flex items-center gap-1.5">
                    <Icon name="image" className="!text-[14px]" />
                    <span className="font-label-sm text-[11px] truncate max-w-[200px]">
                      {selectedFile.name}
                    </span>
                  </div>
                  {locationState.source && (
                    <div className="absolute top-2 left-2 bg-black/50 text-white px-2 py-1 rounded-lg flex items-center gap-1">
                      <Icon
                        name={locationState.source === "camera" ? "photo_camera" : "photo_library"}
                        className="!text-[13px]"
                      />
                      <span className="font-label-sm text-[10px]">
                        {locationState.source === "camera" ? "Kamera" : "Galeri"}
                      </span>
                    </div>
                  )}
                </div>
                <div className="px-4 py-2 flex items-center justify-between border-t border-border-subtle">
                  <span className="font-label-sm text-[11px] text-on-surface-variant">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB ·{" "}
                    {selectedFile.type.split("/")[1]?.toUpperCase() ?? "IMG"}
                  </span>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex items-center gap-1 text-primary-container font-label-md text-[12px] font-semibold hover:underline"
                    >
                      <Icon name="photo_camera" className="!text-[14px]" />
                      Kamera
                    </button>
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="flex items-center gap-1 text-primary-container font-label-md text-[12px] font-semibold hover:underline"
                    >
                      <Icon name="swap_horiz" className="!text-[14px]" />
                      Ganti
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Input kamera — capture="environment" untuk kamera belakang, multiple untuk batch */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/jpeg,image/png,image/jpg"
              capture="environment"
              multiple
              className="hidden"
              onChange={handleCameraChange}
              aria-label="Ambil foto menggunakan kamera"
            />

            {/* Input galeri — multiple untuk batch upload */}
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/jpeg,image/png,image/jpg"
              multiple
              className="hidden"
              onChange={handleGalleryChange}
              aria-label="Pilih foto dari galeri"
            />

            {/* GPS Status Banner */}
            <GpsBanner
              status={locationState.status}
              message={locationState.statusMessage}
              lat={locationState.lat}
              lng={locationState.lng}
            />

            {/* Error message analisis */}
            {errorMsg && (
              <div className="flex items-start gap-2 bg-[#FEE2E2] border border-[#FCA5A5] rounded-xl px-4 py-3">
                <Icon name="error" className="text-[#991B1B] !text-[20px] shrink-0 mt-0.5" />
                <p className="font-label-md text-[12px] text-[#991B1B] leading-relaxed">
                  {errorMsg}
                </p>
              </div>
            )}

            {/* ── Form Informasi Lokasi ── */}
            <section className="bg-surface-container-lowest rounded-xl border border-border-subtle p-4 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="font-headline-sm text-[14px] font-bold text-[#0F172A]">
                  Informasi Lokasi
                </h3>
                {/* Indikator sumber GPS */}
                {locationState.status === "success" && locationState.roadNameLocked && (
                  <span className="font-id-code text-[10px] text-[#065F46] bg-[#D1FAE5] border border-[#6EE7B7] px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Icon name="check_circle" className="!text-[12px]" filled />
                    {locationState.source === "camera" ? "GPS Live" : "EXIF GPS"}
                  </span>
                )}
                {locationState.status === "success" && !locationState.roadNameLocked && (
                  <span className="font-id-code text-[10px] text-[#92400E] bg-[#FEF3C7] border border-[#FCD34D] px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Icon name="search" className="!text-[12px]" />
                    Cari Nama Jalan
                  </span>
                )}
                {(locationState.status === "exif_no_gps" ||
                  locationState.status === "permission_denied" ||
                  locationState.status === "timeout") && (
                  <span className="font-id-code text-[10px] text-[#92400E] bg-[#FEF3C7] border border-[#FCD34D] px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Icon name="search" className="!text-[12px]" />
                    Cari Jalan
                  </span>
                )}
                {isGpsWorking && (
                  <span className="font-id-code text-[10px] text-[#1E40AF] flex items-center gap-1">
                    <span className="w-3 h-3 border border-current/30 border-t-current rounded-full animate-spin" />
                    Mendeteksi...
                  </span>
                )}
              </div>

              {/* Nama Jalan — dengan autocomplete Nominatim */}
              <div className="flex flex-col gap-1.5">
                <label className="font-label-md text-label-md text-[#0F172A]">
                  Nama Jalan
                  <span className="text-[#EF4444] ml-1">*</span>
                </label>

                {/* Input dengan dropdown saran */}
                <div className="relative">
                  <Icon
                    name="location_on"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant !text-[20px] z-10"
                  />
                  <input
                    value={namaJalan}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNamaJalan(val);
                      // Reset koordinat road search jika user mengedit manual
                      setRoadCoords(null);
                      // Tandai sebagai manual saat user mengetik (Task 4E)
                      setRoadNameSource('manual');
                      roadSearch.onQueryChange(val);
                    }}
                    onBlur={() => {
                      // Delay dismiss agar klik pada saran sempat terpanggil
                      setTimeout(() => roadSearch.onDismiss(), 150);
                    }}
                    onFocus={() => {
                      if (namaJalan.length >= 3) roadSearch.onQueryChange(namaJalan);
                    }}
                    placeholder={
                      isGpsWorking
                        ? "Mendeteksi lokasi..."
                        : "Ketik nama jalan untuk mencari..."
                    }
                    disabled={isGpsWorking}
                    readOnly={isGpsActive}
                    className={`w-full pl-10 pr-10 py-3 border border-border-subtle rounded-xl font-body-md text-body-md bg-surface-container-low focus:ring-2 focus:ring-primary-container focus:border-primary-container outline-none disabled:opacity-60 disabled:cursor-wait ${isGpsActive ? "bg-surface-container cursor-default text-on-surface-variant" : ""}`}
                  />

                  {/* Indikator kanan: spinner searching / lock GPS / check road selected */}
                  {isGpsWorking && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-primary-container/30 border-t-primary-container rounded-full animate-spin" />
                  )}
                  {roadSearch.status === "searching" && !isGpsWorking && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-on-surface-variant/30 border-t-on-surface-variant rounded-full animate-spin" />
                  )}
                  {isGpsActive && (
                    <Icon
                      name="lock"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant !text-[16px] opacity-50"
                    />
                  )}
                  {!isGpsActive && !isGpsWorking && roadCoords && roadSearch.status !== "searching" && (
                    <Icon
                      name="check_circle"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#059669] !text-[18px]"
                      filled
                    />
                  )}
                </div>

                {/* Dropdown saran jalan */}
                {roadSearch.showSuggestions && (
                  <div className="relative z-50">
                    <ul className="absolute top-0 left-0 right-0 bg-white border border-border-subtle rounded-xl shadow-lg overflow-hidden max-h-[220px] overflow-y-auto">
                      {roadSearch.suggestions.map((s) => (
                        <li key={s.placeId}>
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              // Gunakan onMouseDown agar terpanggil sebelum onBlur
                              e.preventDefault();
                              roadSearch.onSelect(s);
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-surface-container-low flex items-start gap-3 border-b border-border-subtle last:border-b-0 transition-colors"
                          >
                            <Icon
                              name="signpost"
                              className="text-primary-container !text-[18px] shrink-0 mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-label-md text-[13px] font-semibold text-[#0F172A] truncate">
                                {s.roadName}
                              </p>
                              {s.kecamatan && (
                                <p className="font-label-sm text-[11px] text-on-surface-variant mt-0.5">
                                  Kec. {s.kecamatan}, Sidoarjo
                                </p>
                              )}
                            </div>
                            <Icon
                              name="my_location"
                              className="text-[#94A3B8] !text-[14px] shrink-0 mt-1"
                            />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Status pencarian */}
                {roadSearch.status === "not_found" && namaJalan.length >= 3 && (
                  <p className="text-[11px] text-[#64748B] flex items-center gap-1">
                    <Icon name="search_off" className="!text-[14px]" />
                    Tidak ditemukan di Sidoarjo. Coba kata kunci lain.
                  </p>
                )}
                {roadSearch.status === "error" && (
                  <p className="text-[11px] text-[#991B1B] flex items-center gap-1">
                    <Icon name="wifi_off" className="!text-[14px]" />
                    Gagal terhubung ke layanan pencarian. Coba lagi.
                  </p>
                )}
                {isGpsActive && (
                  <p className="text-[11px] text-[#64748B]">
                    Diisi otomatis dari GPS — nama jalan terverifikasi LocationIQ.
                  </p>
                )}
                {locationState.status === "success" && !locationState.roadNameLocked && (
                  <p className="text-[11px] text-[#92400E] flex items-center gap-1">
                    <Icon name="info" className="!text-[13px]" />
                    Nama jalan tidak ditemukan di area ini. Ketik nama jalan atau gang secara manual.
                  </p>
                )}
                {!isGpsActive && roadCoords && (
                  <p className="text-[11px] text-[#059669] flex items-center gap-1">
                    <Icon name="check_circle" className="!text-[14px]" filled />
                    Koordinat didapat dari Nominatim ({roadCoords.lat.toFixed(5)}, {roadCoords.lng.toFixed(5)})
                  </p>
                )}
                {/* Warning jika nama jalan diketik manual (Task 4E) */}
                {roadNameSource === 'manual' && namaJalan.length > 3 && !isGpsActive && (
                  <p className="text-[11px] text-red-600 flex items-center gap-1 mt-1">
                    <Icon name="warning" className="!text-[13px]" />
                    Pilih nama jalan dari saran di bawah, jangan ketik manual — koordinat tidak akan terverifikasi.
                  </p>
                )}
              </div>

              {/* Kecamatan */}
              <div className="flex flex-col gap-1.5">
                <label className="font-label-md text-label-md text-[#0F172A]">Kecamatan</label>
                <div className="relative">
                  <select
                    value={kecamatan}
                    onChange={(e) => setKecamatan(e.target.value)}
                    disabled={isGpsWorking || isGpsActive}
                    className={`w-full appearance-none px-4 py-3 border border-border-subtle rounded-xl font-body-md text-body-md bg-surface-container-low focus:ring-2 focus:ring-primary-container outline-none disabled:opacity-60 disabled:cursor-wait ${isGpsActive ? "cursor-default" : ""}`}
                  >
                    {KECAMATAN_LIST.map((g) => (
                      <optgroup key={g.group} label={g.group}>
                        {g.items.map((k) => (
                          <option key={k}>{k}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <Icon
                    name={isGpsActive ? "lock" : "expand_more"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                  />
                </div>
              </div>

              {/* Koordinat GPS (readonly, tampil jika ada dari EXIF/live GPS) */}
              {locationState.lat !== null && locationState.lng !== null && (
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-md text-label-md text-[#0F172A]">Koordinat GPS</label>
                  <div className="relative">
                    <Icon
                      name="my_location"
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-container !text-[18px]"
                    />
                    <input
                      readOnly
                      value={`${locationState.lat.toFixed(6)}, ${locationState.lng.toFixed(6)}`}
                      className="w-full pl-10 pr-4 py-3 border border-border-subtle rounded-xl font-id-code text-[12px] bg-surface-container text-on-surface-variant cursor-default"
                    />
                  </div>
                </div>
              )}

              {/* ── GPS Fallback ────────────────────────────────────────────────────
                  Muncul saat foto tidak punya EXIF GPS dan live GPS tidak aktif.
                  User bisa klik "Gunakan GPS Saya" atau pilih jalan dari autocomplete
                  (koordinat akan otomatis terisi dari Nominatim).
              ─────────────────────────────────────────────────────────────────── */}
              {needsGpsFallback && locationState.lat === null && !roadCoords && (
                <div className="flex flex-col gap-3 bg-[#FFFBEB] border border-[#FCD34D] rounded-xl p-4">
                  <div className="flex items-start gap-2">
                    <Icon name="info" className="text-[#92400E] !text-[18px] shrink-0 mt-0.5" />
                    <p className="text-[12px] text-[#78350F] leading-relaxed">
                      Foto ini tidak memiliki data GPS. Pilih nama jalan dari saran di atas
                      untuk mendapatkan koordinat otomatis, atau gunakan GPS perangkat Anda.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRequestLiveGps}
                    disabled={isRequestingLiveGps}
                    className="flex items-center justify-center gap-2 w-full h-10 bg-[#1A4F8A] text-white rounded-xl text-[13px] font-semibold hover:bg-[#0F3260] active:scale-95 transition-all disabled:opacity-60 disabled:cursor-wait"
                  >
                    {isRequestingLiveGps ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Mengambil GPS...
                      </>
                    ) : (
                      <>
                        <Icon name="my_location" className="!text-[18px]" />
                        Gunakan GPS Saya
                      </>
                    )}
                  </button>
                  {liveGpsError && (
                    <p className="text-[11px] text-[#991B1B] flex items-center gap-1">
                      <Icon name="error" className="!text-[14px]" />
                      {liveGpsError}
                    </p>
                  )}
                </div>
              )}

              {/* Konfirmasi koordinat dari GPS fallback (roadCoords dari live GPS) */}
              {needsGpsFallback && locationState.lat === null && roadCoords && (
                <div className="flex items-center gap-2 bg-[#D1FAE5] border border-[#6EE7B7] rounded-xl px-4 py-3">
                  <Icon name="check_circle" className="text-[#065F46] !text-[18px] shrink-0" filled />
                  <div>
                    <p className="text-[12px] font-semibold text-[#065F46]">Koordinat GPS berhasil diambil</p>
                    <p className="font-id-code text-[10px] text-[#065F46] opacity-70 mt-0.5">
                      {roadCoords.lat.toFixed(6)}, {roadCoords.lng.toFixed(6)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setRoadCoords(null); setLiveGpsError(""); }}
                    className="ml-auto text-[#065F46] hover:text-[#047857]"
                    title="Hapus koordinat"
                  >
                    <Icon name="close" className="!text-[16px]" />
                  </button>
                </div>
              )}

              {/* Tanggal */}
              <div className="flex flex-col gap-1.5">
                <label className="font-label-md text-label-md text-[#0F172A]">Tanggal Laporan</label>
                <div className="relative">
                  <Icon
                    name="calendar_today"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant !text-[20px]"
                  />
                  <input
                    type="date"
                    value={tanggal}
                    onChange={(e) => setTanggal(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-border-subtle rounded-xl font-body-md text-body-md bg-surface-container-low outline-none focus:ring-2 focus:ring-primary-container focus:border-primary-container"
                  />
                </div>
              </div>

              {/* Catatan */}
              <div className="flex flex-col gap-1.5">
                <label className="font-label-md text-label-md text-[#0F172A]">Catatan Tambahan</label>
                <textarea
                  rows={3}
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  placeholder="Tambahkan keterangan kondisi jalan, situasi sekitar, dll..."
                  className="w-full px-4 py-3 border border-border-subtle rounded-xl font-body-md text-body-md bg-surface-container-low resize-none outline-none focus:ring-2 focus:ring-primary-container focus:border-primary-container"
                />
              </div>
            </section>

            {/* ── Duplicate Checker ── */}
            {/* Requirement 6.1: Ditempatkan di antara "Informasi Lokasi" dan tombol submit */}
            {selectedFile && (
              <section className="bg-surface-container-lowest rounded-xl border border-border-subtle p-4">
                <DuplicateChecker
                  userLat={effectiveLat}
                  userLng={effectiveLng}
                  isGpsActive={isGpsActive || roadCoords !== null}
                  isGpsDetecting={isGpsDetecting}
                  district={kecamatan}
                  checkState={checkState}
                  spatialDuplicates={duplicateResult.spatial_duplicates}
                  textualDuplicates={duplicateResult.textual_duplicates}
                  hasDuplicates={hasDuplicates}
                  addEvidenceState={addEvidenceState}
                  addEvidenceTargetId={addEvidenceTargetId}
                  addEvidenceMessage={addEvidenceMessage}
                  selectedFile={selectedFile}
                  reporterName={user?.name ?? "Petugas"}
                  onSupportReport={handleSupportReport}
                  isSubmitHidden={isSubmitHidden}
                />
              </section>
            )}

          </div>
        </main>

        {/* ── Footer Actions ── */}
        <div className="sticky bottom-0 bg-surface border-t border-border-subtle shadow-[0_-4px_12px_rgba(0,0,0,0.05)] w-full">
          <div style={{ maxWidth: "42rem", marginLeft: "auto", marginRight: "auto" }} className="p-4 flex flex-col gap-3">

            {/* Tombol batch — muncul saat ada banyak foto dipilih */}
            {selectedFiles.length > 0 && !isSubmitHidden && (
              <>
                {/* Warning jika ada foto yang ditolak */}
                {Object.values(fileExifStatus).some(s => s.status === 'rejected') && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    <Icon name="error" className="text-red-600 !text-[18px] shrink-0 mt-0.5" />
                    <p className="text-[12px] text-red-700">
                      {Object.values(fileExifStatus).filter(s => s.status === 'rejected').length} foto ditolak karena metadata tidak valid.
                      Hapus foto tersebut dari grid sebelum melanjutkan.
                    </p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleSubmitBatch}
                  disabled={
                    ['uploading', 'analyzing', 'validating'].includes(uploadPhase) ||
                    Object.values(fileExifStatus).some(s => s.status === 'rejected') ||
                    Object.values(fileExifStatus).some(s => s.status === 'checking')
                  }
                  className="w-full h-[52px] bg-[#1A4F8A] text-white rounded-xl flex items-center justify-center gap-2 font-headline-sm-mobile text-[16px] font-bold active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {['uploading', 'analyzing', 'validating'].includes(uploadPhase) ? (
                    <>
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {uploadPhase === 'uploading'  && 'Mengupload foto...'}
                      {uploadPhase === 'analyzing'  && `AI menganalisis ${selectedFiles.length} foto...`}
                      {uploadPhase === 'validating' && 'Memvalidasi koordinat...'}
                    </>
                  ) : Object.values(fileExifStatus).some(s => s.status === 'checking') ? (
                    <>
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Memeriksa metadata foto...
                    </>
                  ) : (
                    <>
                      <Icon name="burst_mode" className="!text-[22px]" />
                      Upload {selectedFiles.filter((_, i) => fileExifStatus[i]?.status !== 'rejected').length} Foto Sekaligus
                    </>
                  )}
                </button>
              </>
            )}

            {/* Tombol single analisis — muncul saat ada 1 foto dipilih */}
            {!isSubmitHidden && selectedFiles.length === 0 && (
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={isLoading || !selectedFile || isGpsWorking}
                className="w-full h-[52px] bg-primary-container text-white rounded-xl flex items-center justify-center gap-2 font-headline-sm-mobile text-[16px] font-bold active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                {isLoading ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Menganalisis...
                  </>
                ) : isGpsWorking ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Mendeteksi Lokasi...
                  </>
                ) : (
                  <>
                    <Icon name="auto_awesome" />
                    Analisis Sekarang
                  </>
                )}
              </button>
            )}

            {/* Info saat tombol submit disembunyikan */}
            {isSubmitHidden && addEvidenceState !== "error" && (
              <div className="w-full h-[52px] bg-[#D1FAE5] border border-[#6EE7B7] rounded-xl flex items-center justify-center gap-2 text-[#065F46] text-[14px] font-semibold">
                <Icon name="check_circle" className="!text-[20px]" filled />
                {addEvidenceState === "success"
                  ? "Bukti foto berhasil dikirim!"
                  : "Mengirim bukti foto..."}
              </div>
            )}

            {/* Aktifkan kembali tombol submit jika add-evidence error */}
            {isSubmitHidden && addEvidenceState === "error" && (
              <button
                type="button"
                onClick={() => setIsSubmitHidden(false)}
                className="w-full h-[52px] bg-primary-container text-white rounded-xl flex items-center justify-center gap-2 font-headline-sm-mobile text-[16px] font-bold active:scale-95 transition-all"
              >
                <Icon name="auto_awesome" />
                Buat Laporan Baru
              </button>
            )}

            <button
              type="button"
              disabled={isLoading || isGpsWorking}
              className="w-full h-[48px] border-2 border-primary-container text-primary-container rounded-xl flex items-center justify-center gap-2 font-label-md text-[15px] font-bold disabled:opacity-40"
            >
              <Icon name="cloud_off" />
              Simpan sebagai Draf (Offline)
            </button>
          </div>
        </div>
      </div>

      {/* ── Anti-Fraud Modal ── */}
      <FraudWarningModal
        isOpen={fraudModal.isOpen}
        status={fraudModal.status}
        title={fraudModal.title}
        message={fraudModal.message}
        onClose={closeFraudModal}
        isWarningOnly={fraudModal.isWarningOnly}
      />

      {/* ── Loading Overlay Batch Upload (Task 4F) ── */}
      {['uploading', 'analyzing', 'validating'].includes(uploadPhase) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-72 space-y-4 text-center shadow-2xl">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent
                            rounded-full animate-spin mx-auto" />
            {uploadPhase === 'uploading' && (
              <p className="font-medium text-gray-800">Mengupload foto...</p>
            )}
            {uploadPhase === 'analyzing' && (
              <div>
                <p className="font-medium text-gray-800">AI sedang menganalisis...</p>
                <p className="text-xs text-gray-500 mt-1">
                  {selectedFiles.length} foto diproses sekaligus
                </p>
              </div>
            )}
            {uploadPhase === 'validating' && (
              <p className="font-medium text-gray-800">Memvalidasi koordinat...</p>
            )}
            {/* Progress dots */}
            <div className="flex justify-center gap-2">
              {(['uploading', 'analyzing', 'validating'] as const).map(phase => (
                <div
                  key={phase}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    uploadPhase === phase ? 'bg-blue-500' : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}