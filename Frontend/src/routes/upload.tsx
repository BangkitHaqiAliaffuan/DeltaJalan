import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Icon } from "@/components/jk/Icon";
import { TopBar } from "@/components/jk/TopBar";
import { AppLayout } from "@/components/jk/AppLayout";
import { FraudWarningModal } from "@/components/jk/FraudWarningModal";
import { DuplicateChecker } from "@/components/jk/DuplicateChecker";
import { useRef, useState, useCallback, useEffect } from "react";
import { setAiResult, setFormData, API_BASE_URL } from "@/lib/aiStore";
import {
  useLocationFromPhoto,
  type GpsStatus,
} from "@/hooks/useLocationFromPhoto";
import { useDuplicateCheck } from "@/hooks/useDuplicateCheck";
import {
  useRoadSearch,
  type RoadSuggestion,
} from "@/hooks/useRoadSearch";
import {
  validatePhotoDate,
  isExifBlocking,
  type PhotoDateValidationStatus,
} from "@/lib/validatePhotoDate";
import { getCurrentUser } from "@/lib/auth";

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
  const user = getCurrentUser();

  // Dua input terpisah: kamera dan galeri
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
   * Apakah perlu menampilkan panel GPS fallback?
   * Ya, jika foto tidak punya GPS EXIF dan live GPS dari hook juga tidak aktif.
   */
  const needsGpsFallback =
    locationState.status === "exif_no_gps" ||
    locationState.status === "permission_denied" ||
    locationState.status === "timeout" ||
    locationState.status === "error";

  /**
   * Koordinat efektif yang akan dipakai saat submit:
   * - Prioritas 1: GPS dari hook (live kamera / EXIF galeri)
   * - Prioritas 2: Koordinat dari road search Nominatim
   * - Prioritas 3: Koordinat dari tombol live GPS fallback
   */
  const effectiveLat: number | null = locationState.lat ?? roadCoords?.lat ?? null;
  const effectiveLng: number | null = locationState.lng ?? roadCoords?.lng ?? null;

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
    if (file.size > 10 * 1024 * 1024) {
      return "Ukuran file maksimal 10MB.";
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
    const file = e.target.files?.[0];
    if (!file) return;
    if (!applyFile(file, "camera")) return;
    // Strategi 1: live GPS
    await handleCameraCapture(file);
  }

  /** Dipanggil saat user memilih foto dari galeri */
  async function handleGalleryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // ── Validasi Anti-Fraud Tanggal EXIF ──────────────────────────────────
    // Hanya berlaku untuk foto galeri (bukan kamera langsung)
    const dateValidation = await validatePhotoDate(file);

    if (dateValidation.status !== "valid") {
      if (isExifBlocking(dateValidation.status)) {
        // Status benar-benar memblokir (too_old, future_date) → tolak foto
        setFraudModal({
          isOpen: true,
          status: dateValidation.status,
          title: dateValidation.title,
          message: dateValidation.message,
          isWarningOnly: false,
        });
        // Kosongkan input file agar user harus memilih ulang
        if (galleryInputRef.current) galleryInputRef.current.value = "";
        return; // hentikan proses
      } else {
        // Status hanya peringatan (no_exif_date, exif_read_error) → lanjut upload
        // tapi tampilkan info bahwa GPS perlu diisi manual
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
    // ── End Validasi ──────────────────────────────────────────────────────

    if (!applyFile(file, "gallery")) return;
    // Strategi 2: baca EXIF GPS
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
    resetLocation();
    resetDuplicateCheck();
    roadSearch.reset();
    setIsSubmitHidden(false);
    setNamaJalan("");
    setKecamatan("Sidoarjo");
    setRoadCoords(null);
    setLiveGpsError("");
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

            {/* ── Upload Zone ── */}
            {!selectedFile ? (
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
                  Ambil foto langsung atau pilih dari galeri
                </p>

                {/* Dua tombol terpisah */}
                <div className="flex gap-3 w-full justify-center">
                  {/* Tombol Kamera — trigger live GPS */}
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex-1 max-w-[160px] flex items-center justify-center gap-2 bg-primary-container text-white rounded-xl px-4 py-3 font-label-md text-[13px] font-semibold hover:bg-primary-container/90 active:scale-95 transition-all"
                  >
                    <Icon name="photo_camera" className="!text-[20px]" />
                    Kamera
                  </button>

                  {/* Tombol Galeri — trigger EXIF GPS */}
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
                  Format JPG/PNG · Maks. 10MB · Drag & drop didukung
                </span>

                {/* Info untuk pengguna desktop */}
                <div className="mt-4 w-full text-left text-[11px] text-[#64748B] bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg p-3">
                  <p className="font-semibold mb-1">💡 Tips:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li><strong>Kamera:</strong> Ambil foto baru langsung (mobile) atau pilih file terbaru (desktop)</li>
                    <li><strong>Galeri:</strong> Pilih foto dari penyimpanan perangkat Anda</li>
                  </ul>
                </div>
              </div>
            ) : (
              /* ── Preview Foto ── */
              <div className="rounded-xl border border-border-subtle overflow-hidden shadow-sm bg-surface-container-lowest">
                <div className="relative w-full aspect-video bg-surface-container-high">
                  <img
                    src={previewUrl!}
                    alt="Preview foto"
                    className="w-full h-full object-cover"
                  />
                  {/* Hapus foto */}
                  <button
                    type="button"
                    onClick={removeFile}
                    className="absolute top-2 right-2 w-8 h-8 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
                    title="Hapus foto"
                  >
                    <Icon name="close" className="!text-[18px]" />
                  </button>
                  {/* Nama file */}
                  <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 rounded-lg flex items-center gap-1.5">
                    <Icon name="image" className="!text-[14px]" />
                    <span className="font-label-sm text-[11px] truncate max-w-[200px]">
                      {selectedFile.name}
                    </span>
                  </div>
                  {/* Sumber foto badge */}
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

            {/* Input kamera — capture="environment" untuk kamera belakang */}
            {/* PENTING: Di desktop, capture attribute diabaikan browser. */}
            {/* Pengguna desktop akan melihat file picker biasa. */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/jpeg,image/png,image/jpg"
              capture="environment"
              className="hidden"
              onChange={handleCameraChange}
              aria-label="Ambil foto menggunakan kamera"
            />

            {/* Input galeri — tanpa capture agar buka file picker */}
            {/* Ini adalah input terpisah untuk memilih foto dari galeri/penyimpanan */}
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/jpeg,image/png,image/jpg"
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
            {/* Tombol submit utama — disembunyikan jika petugas memilih "Dukung Laporan" */}
            {!isSubmitHidden && (
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
    </AppLayout>
  );
}