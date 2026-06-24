import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { Icon } from "@/components/jk/Icon";
import { PageLayout } from "@/components/jk/PageLayout";
import { getCurrentUser, getToken } from "@/lib/auth";
import { useSurveyList } from "@/hooks/useSurveyQueries";
import { readExifGps, reverseGeocode, isNativePlatform, convertFileSrc } from "@/hooks/useLocationFromPhoto";
import { PhotoExifGps } from "@jalankita/capacitor-exif-gps";
import {
  setAiResult,
  setFormData,
  setPendingBatchFiles,
  setBatchResult,
  updateBatchPhoto,
  API_BASE_URL,
} from "@/lib/aiStore";
import type { BatchPhotoResult } from "@/lib/aiStore";
import { AnalyzingOverlay, type AnalyzeStage } from "@/components/jk/AnalyzingOverlay";
import { Portal } from "@/components/jk/Portal";
import { PatrolMap } from "@/components/jk/PatrolMap";
import { validatePhotoDate, isExifBlocking, type PhotoDateValidationStatus } from "@/lib/validatePhotoDate";
import { FraudWarningModal } from "@/components/jk/FraudWarningModal";

export const Route = createFileRoute("/upload")({
  component: UploadPage,
  validateSearch: (search: Record<string, unknown>) => {
    const taskId = search.taskId as string | undefined;
    return { ...(taskId ? { taskId } : {}) };
  },
  head: () => ({ meta: [{ title: "Upload & Analisis — DeltaJalan" }] }),
});

const PRIORITY_STYLES: Record<string, string> = {
  Tinggi: "bg-[#E11D48] text-white",
  Sedang: "bg-orange-50 text-[#F97316] border border-orange-200",
  Rendah: "bg-green-50 text-[#10B981] border border-green-200",
};

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function UploadPage() {
  const { taskId } = Route.useSearch();
  const navigate = useNavigate();
  const user = getCurrentUser();
  const token = getToken() ?? "";
  const teamId = user?.team_id;
  const today = todayStr();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [analyzeState, setAnalyzeState] = useState<{
    stage: AnalyzeStage;
    variant: "single" | "batch";
    batchCount?: number;
    batchProgress?: number;
  } | null>(null);
  const [error, setError] = useState("");

  const [fraudModal, setFraudModal] = useState<{
    isOpen: boolean;
    status: PhotoDateValidationStatus;
    title: string;
    message: string;
  }>({ isOpen: false, status: "no_exif_date", title: "", message: "" });

  const [batchDimensi, setBatchDimensi] = useState<
    Record<number, { panjang: string; lebar: string }>
  >({});

  const [preview, setPreview] = useState<{
    file: File;
    previewUrl: string;
    fileName: string;
    panjang: string;
    lebar: string;
  } | null>(null);

  const [batchPreviewFiles, setBatchPreviewFiles] = useState<
    { file: File; previewUrl: string }[] | null
  >(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [replaceTargetIndex, setReplaceTargetIndex] = useState<number | null>(null);

  const { data: tasks = [], isFetching } = useSurveyList(
    teamId ? { team_id: teamId, tanggal_patroli: today } : undefined,
  );

  const activeTask = taskId ? tasks.find((t) => t.id === taskId) : null;

  // ── Photo handler ──

  async function handleFilePicked(file: File) {
    if (!taskId) return;
    setError("");

    try {
      if (!["image/jpeg", "image/jpg", "image/png"].includes(file.type)) {
        throw new Error("Format file tidak didukung. Gunakan JPEG atau PNG.");
      }
      if (file.size > 5 * 1024 * 1024) {
        throw new Error("Ukuran file maksimal 5MB.");
      }

      console.warn(`[DEBUG handleFilePicked] arrayBuffer() START: ${file.name}`);
      const buf = await file.arrayBuffer();
      console.warn(`[DEBUG handleFilePicked] arrayBuffer() OK: ${file.name} (${buf.byteLength} bytes)`);
      const safeFile = new File([buf], file.name, { type: file.type });
      // Verifikasi in-memory File bisa dibaca
      try {
        const v = await safeFile.arrayBuffer();
        console.warn(`[DEBUG handleFilePicked] in-memory verify OK: ${file.name} (${v.byteLength} bytes)`);
      } catch (e) {
        console.warn(`[DEBUG handleFilePicked] in-memory verify FAILED: ${file.name}`, e);
      }

      // Validasi EXIF tanggal foto
      const dateValidation = await validatePhotoDate(safeFile);
      if (dateValidation.status !== "valid") {
        setFraudModal({
          isOpen: true,
          status: dateValidation.status,
          title: dateValidation.title,
          message: dateValidation.message,
        });
        return;
      }

      // Validasi EXIF GPS
      const gps = await readExifGps(safeFile);
      if (!gps?.latitude || !gps?.longitude) {
        setFraudModal({
          isOpen: true,
          status: "no_gps",
          title: "Foto Tanpa Data Lokasi",
          message:
            "Foto ini tidak memiliki metadata lokasi (EXIF GPS). " +
            "Aktifkan GPS pada perangkat Anda saat mengambil foto, " +
            "atau gunakan kamera langsung untuk hasil terbaik.",
        });
        return;
      }

      const previewUrl = URL.createObjectURL(safeFile);

      setPreview({
        file: safeFile,
        previewUrl,
        fileName: file.name,
        panjang: "",
        lebar: "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    }
  }

  function closeFraudModal() {
    setFraudModal((s) => ({ ...s, isOpen: false }));
  }

  function handleCameraCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFilePicked(file);
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }

  async function handleGallerySelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (isNativePlatform()) return;
    const files = e.target.files;
    if (!files || files.length === 0) {
      if (galleryInputRef.current) galleryInputRef.current.value = "";
      return;
    }
    if (files.length < 2) {
      setError("Pilih minimal 2 foto untuk dilaporkan.");
      if (galleryInputRef.current) galleryInputRef.current.value = "";
      return;
    }
    // PENTING: await sebelum reset input agar content:// URI masih valid
    // selama seluruh proses arrayBuffer() berlangsung.
    await handleBatchSelect(files);
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  }

  async function handleBatchSelect(files: FileList) {
    if (!taskId) return;
    setError("");

    const fileArr = Array.from(files);
    try {
      for (const f of fileArr) {
        if (!["image/jpeg", "image/jpg", "image/png"].includes(f.type)) {
          throw new Error(`Format "${f.name}" tidak didukung. Gunakan JPEG atau PNG.`);
        }
        if (f.size > 5 * 1024 * 1024) {
          throw new Error(`Ukuran "${f.name}" melebihi 5MB.`);
        }
      }

      // Baca file ke memory SEGERA saat content:// URI masih fresh.
      // Sequential (bukan Promise.all) untuk hindari concurrent IPC ke ContentResolver
      // di Android yang bisa race dan gagal.
      // Buf disimpan bersama-sama agar tidak di-GC sebelum Chromium selesai
      // mentransfer data ke blob store di browser process.
      const safeFilesWithBuf: { file: File; buf: ArrayBuffer }[] = [];
      for (const f of fileArr) {
        console.warn(`[DEBUG handleBatchSelect] arrayBuffer() START: ${f.name} (size=${f.size}, type=${f.type})`);
        const buf = await f.arrayBuffer();
        console.warn(`[DEBUG handleBatchSelect] arrayBuffer() OK: ${f.name} (${buf.byteLength} bytes)`);
        const safeFile = new File([buf], f.name, { type: f.type });
        // Verifikasi in-memory File bisa dibaca langsung
        try {
          const verifyBuf = await safeFile.arrayBuffer();
          console.warn(`[DEBUG handleBatchSelect] in-memory File OK: ${f.name} (${verifyBuf.byteLength} bytes)`);
        } catch (verifyErr) {
          console.warn(`[DEBUG handleBatchSelect] in-memory File GAGAL DIBACA: ${f.name}`, verifyErr);
        }
        safeFilesWithBuf.push({ file: safeFile, buf });
      }
      // Ekstrak array file untuk downstream; buf tetap alive di safeFilesWithBuf
      const safeFiles = safeFilesWithBuf.map((x) => x.file);
      void safeFilesWithBuf; // suppress unused warning — sengaja dipertahankan di scope

      // Validasi EXIF tanggal + GPS untuk setiap file
      const validationResults = await Promise.all(
        safeFiles.map(async (f) => {
          const dateResult = await validatePhotoDate(f);
          if (dateResult.status !== "valid") return dateResult;
          const gps = await readExifGps(f);
          if (!gps?.latitude || !gps?.longitude) {
            return {
              status: "no_gps" as const,
              photoDate: null,
              ageDays: null,
              title: "Foto Tanpa Data Lokasi",
              message:
                "Foto ini tidak memiliki metadata lokasi (EXIF GPS). " +
                "Aktifkan GPS pada perangkat Anda saat mengambil foto.",
            };
          }
          return dateResult;
        }),
      );
      const validFiles = safeFiles.filter((_, i) => validationResults[i].status === "valid");
      const firstFailure = validationResults.find((r) => r.status !== "valid");

      if (firstFailure) {
        setFraudModal({
          isOpen: true,
          status: firstFailure.status,
          title: firstFailure.title,
          message: firstFailure.message,
        });
      }

      if (validFiles.length === 0) return;

      const previews = validFiles.map((f) => ({
        file: f,
        previewUrl: URL.createObjectURL(f),
      }));
      setBatchPreviewFiles(previews);

      const initialDims: Record<number, { panjang: string; lebar: string }> = {};
      validFiles.forEach((_, i) => { initialDims[i] = { panjang: "", lebar: "" }; });
      setBatchDimensi(initialDims);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    }
  }

  async function handleNativeBatchSelect() {
    if (!taskId) {
      setError("Pilih task terlebih dahulu");
      return;
    }
    try {
      setError("");
      const result = await PhotoExifGps.pickPhotos({ limit: 20 });
      if (!result.photos?.length) {
        setError("Tidak ada foto yang dipilih");
        return;
      }
      const validFiles: { file: File; previewUrl: string }[] = [];
      for (const photo of result.photos) {
        try {
          const capUrl = convertFileSrc(photo.uri);
          const resp = await fetch(capUrl);
          const blob = await resp.blob();
          const file = new File([blob], photo.name || "photo.jpg", { type: blob.type || "image/jpeg" });
          const testBuf = await file.arrayBuffer();
          if (testBuf.byteLength === 0) {
            console.warn(`[DEBUG handleNativeBatchSelect] verify FAILED (0 bytes): ${file.name}`);
            continue;
          }
          console.warn(`[DEBUG handleNativeBatchSelect] verify OK: ${file.name} (${testBuf.byteLength} bytes)`);
          const dateResult = await validatePhotoDate(file);
          if (dateResult.status !== "valid") {
            console.warn(`[DEBUG handleNativeBatchSelect] date validation failed: ${file.name}`);
            continue;
          }
          const previewUrl = URL.createObjectURL(file);
          validFiles.push({ file, previewUrl });
        } catch (err) {
          console.warn(`[DEBUG handleNativeBatchSelect] failed to process: ${photo.uri}`, err);
        }
      }
      if (validFiles.length < 2) {
        setError("Pilih minimal 2 foto untuk dilaporkan.");
        return;
      }
      setBatchPreviewFiles(validFiles);
    } catch (err) {
      console.error("[DEBUG handleNativeBatchSelect] error:", err);
      setError(err instanceof Error ? err.message : "Gagal memilih foto");
    }
  }

  async function handleAnalyze() {
    if (!preview || !taskId) return;
    setAnalyzeState({ stage: "gps", variant: "single" });
    setError("");
    await new Promise((r) => setTimeout(r, 0));

    try {
      const { file, previewUrl, fileName, panjang, lebar } = preview;

      let lat: number | undefined;
      let lng: number | undefined;
      try {
        const gps = await readExifGps(file);
        if (gps?.latitude != null && gps?.longitude != null) {
          lat = gps.latitude;
          lng = gps.longitude;
        }
      } catch {}

      setAnalyzeState({ stage: "analyzing", variant: "single" });
      await new Promise((r) => setTimeout(r, 0));

      let roadName = activeTask?.road_name ?? "";
      let kecamatan = activeTask?.kecamatan ?? "";
      if (lat != null && lng != null) {
        try {
          const geo = await reverseGeocode(lat, lng);
          if (geo.namaJalan) roadName = geo.namaJalan;
          if (geo.kecamatan) kecamatan = geo.kecamatan;
        } catch {}
      }

      const analyzeFd = new FormData();
      analyzeFd.append("file", file);
      if (lat != null && lng != null) {
        analyzeFd.append("latitude", String(lat));
        analyzeFd.append("longitude", String(lng));
      }

      const analyzeRes = await fetch(`${API_BASE_URL}/analyze`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: analyzeFd,
      });

      if (!analyzeRes.ok) {
        throw new Error("Gagal menganalisis foto. Silakan coba lagi.");
      }

      const analyzeJson = await analyzeRes.json();

      setAnalyzeState({ stage: "processing", variant: "single" });
      await new Promise((r) => setTimeout(r, 0));

      const mappedDets = (analyzeJson.detections ?? []).map((d: any) => ({
        class: d.type ?? d.class,
        severity: d.severity ?? analyzeJson.overall_severity,
        confidence: d.confidence,
        bbox: d.bbox
          ? { x1: d.bbox[0] ?? 0, y1: d.bbox[1] ?? 0, x2: d.bbox[2] ?? 0, y2: d.bbox[3] ?? 0 }
          : { x1: 0, y1: 0, x2: 0, y2: 0 },
      }));

      setAiResult({
        detections: mappedDets,
        total: analyzeJson.total ?? mappedDets.length,
        overall_severity: analyzeJson.overall_severity,
        image_result: analyzeJson.image_result ?? "",
        status: "success",
      });

      setFormData({
        namaJalan: roadName,
        kecamatan,
        tanggal: today,
        catatan: "",
        previewUrl,
        fileName,
        lat,
        lng,
        survey_task_id: taskId,
        kerusakanPanjang: panjang,
        kerusakanLebar: lebar,
        file,
      });

      setAnalyzeState({ stage: "complete", variant: "single" });
      await new Promise((r) => setTimeout(r, 600));

      URL.revokeObjectURL(preview.previewUrl);
      setPreview(null);
      navigate({ to: "/ai-result" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
      setAnalyzeState(null);
    }
  }

  async function handleBatchAnalyze() {
    if (!batchPreviewFiles || !taskId) return;
    setAnalyzeState({ stage: "gps", variant: "batch", batchCount: batchPreviewFiles.length });
    setError("");
    await new Promise((r) => setTimeout(r, 0));

    const fileArr = batchPreviewFiles.map((p) => p.file);

    try {
      let lat: number = activeTask?.latitude ?? -7.45;
      let lng: number = activeTask?.longitude ?? 112.72;

      const geo = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error("Geolokasi tidak tersedia"));
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 8000,
          enableHighAccuracy: true,
        });
      }).catch(() => null);
      if (geo) {
        lat = geo.coords.latitude;
        lng = geo.coords.longitude;
      }

      setAnalyzeState({
        stage: "analyzing",
        variant: "batch",
        batchCount: fileArr.length,
        batchProgress: 0,
      });
      await new Promise((r) => setTimeout(r, 0));

      // Verifikasi semua file sebelum diupload
      let allFilesOk = true;
      for (let i = 0; i < fileArr.length; i++) {
        try {
          const testBuf = await fileArr[i].arrayBuffer();
          console.warn(`[DEBUG handleBatchAnalyze] pre-fetch verify OK [${i}]: ${fileArr[i].name} (${testBuf.byteLength} bytes)`);
        } catch (verifyErr) {
          console.warn(`[DEBUG handleBatchAnalyze] pre-fetch verify FAILED [${i}]: ${fileArr[i].name}`, verifyErr);
          allFilesOk = false;
        }
      }
      console.warn(`[DEBUG handleBatchAnalyze] pre-fetch allFilesOk=${allFilesOk}, count=${fileArr.length}`);

      const fd = new FormData();
      fileArr.forEach((f) => fd.append("files[]", f));
      fd.append("latitude", String(lat));
      fd.append("longitude", String(lng));

      console.warn(`[DEBUG handleBatchAnalyze] fetch() START: url=${API_BASE_URL}/analyze-batch`);
      const res = await fetch(`${API_BASE_URL}/analyze-batch`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      console.warn(`[DEBUG handleBatchAnalyze] fetch() OK: status=${res.status}`);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? "Gagal menganalisis batch. Silakan coba lagi.");
      }

      const json = await res.json();

      setAnalyzeState({
        stage: "processing",
        variant: "batch",
        batchCount: fileArr.length,
        batchProgress: fileArr.length,
      });
      await new Promise((r) => setTimeout(r, 0));

      const photos: BatchPhotoResult[] = json.analyses.map((a: any) => ({
        fileIndex: a.file_index,
        fileName: a.file_name,
        imageResult: a.image_result ?? "",
        previewUrl: batchPreviewFiles[a.file_index]?.previewUrl ?? "",
        detections: (a.detections ?? []).map((d: any) => ({
          class: d.type ?? d.class,
          severity: d.severity ?? a.severity,
          confidence: d.confidence,
          bbox: d.bbox
            ? { x1: d.bbox[0] ?? 0, y1: d.bbox[1] ?? 0, x2: d.bbox[2] ?? 0, y2: d.bbox[3] ?? 0 }
            : { x1: 0, y1: 0, x2: 0, y2: 0 },
        })),
        severity: a.severity ?? "ringan",
        confidence: a.confidence ?? 0,
        hasError: !!a.error || !!a.exif_invalid,
      }));

      const rankOrder = ["baik", "ringan", "sedang", "berat"];
      let worstIdx = 0;
      for (const p of photos) {
        const idx = rankOrder.indexOf(p.severity.toLowerCase());
        if (idx > worstIdx) worstIdx = idx;
      }

      setPendingBatchFiles(fileArr);
      setBatchResult({
        photos,
        totalDetections: photos.reduce((s, p) => s + p.detections.length, 0),
        overallSeverity: ["Baik", "Rusak Ringan", "Rusak Sedang", "Rusak Berat"][worstIdx],
        trustScore: 0.8,
        trustLabel: "Sedang",
        batchId: json.batch_id,
        reportCode: "",
      });

      setFormData({
        namaJalan: activeTask?.road_name ?? "",
        kecamatan: activeTask?.kecamatan ?? "",
        tanggal: today,
        catatan: "",
        previewUrl: photos[0]?.previewUrl ?? "",
        fileName: fileArr[0]?.name ?? "",
        lat,
        lng,
        survey_task_id: taskId,
      });

      console.warn(`[DEBUG handleBatchAnalyze] readExifGps START: count=${fileArr.length}`);
      const gpsResults = await Promise.all(
        fileArr.map(async (f, i) => {
          try {
            console.warn(`[DEBUG handleBatchAnalyze] readExifGps [${i}]: ${f.name}`);
            const gps = await readExifGps(f);
            if (gps?.latitude != null && gps?.longitude != null) {
              return { lat: gps.latitude, lng: gps.longitude };
            }
            console.warn(`[DEBUG handleBatchAnalyze] readExifGps [${i}]: no GPS data`);
            return null;
          } catch {
            console.warn(`[DEBUG handleBatchAnalyze] readExifGps [${i}]: CRASHED`);
            return null;
          }
        })
      );
      console.warn(`[DEBUG handleBatchAnalyze] readExifGps DONE`);

      gpsResults.forEach((gps, i) => {
        if (gps) {
          updateBatchPhoto(i, { lat: gps.lat, lng: gps.lng, hasExifGps: true });
        }
      });

      Object.entries(batchDimensi).forEach(([idx, dim]) => {
        updateBatchPhoto(parseInt(idx), {
          kerusakanPanjang: dim.panjang,
          kerusakanLebar: dim.lebar,
        });
      });

      setAnalyzeState({
        stage: "complete",
        variant: "batch",
        batchCount: fileArr.length,
        batchProgress: fileArr.length,
      });
      await new Promise((r) => setTimeout(r, 600));

      batchPreviewFiles.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      setBatchPreviewFiles(null);
      setBatchDimensi({});
      navigate({ to: "/ai-result" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
      setAnalyzeState(null);
    }
  }

  function handleRetake() {
    if (preview) URL.revokeObjectURL(preview.previewUrl);
    setPreview(null);
    setError("");
  }

  function handleBatchPreviewKembali() {
    batchPreviewFiles?.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setBatchPreviewFiles(null);
    setBatchDimensi({});
    setError("");
  }

  async function handleReplaceTrigger(index: number) {
    if (isNativePlatform()) {
      setReplaceTargetIndex(index);
      try {
        const result = await PhotoExifGps.pickPhotos({ limit: 1 });
        if (!result.photos?.length) return;
        const photo = result.photos[0];
        const capUrl = convertFileSrc(photo.uri);
        const resp = await fetch(capUrl);
        const blob = await resp.blob();
        const file = new File([blob], photo.name || "photo.jpg", { type: blob.type || "image/jpeg" });
        const buf = await file.arrayBuffer();
        const safeFile = new File([buf], file.name, { type: file.type });
        const dateValidation = await validatePhotoDate(safeFile);
        if (dateValidation.status !== "valid") {
          setFraudModal({ isOpen: true, status: dateValidation.status, title: dateValidation.title, message: dateValidation.message });
          return;
        }
        const gps = await readExifGps(safeFile);
        if (!gps?.latitude || !gps?.longitude) {
          setFraudModal({ isOpen: true, status: "no_gps", title: "Foto Tanpa Data Lokasi", message: "Foto yang diunggah harus memiliki data lokasi (GPS)." });
          return;
        }
        const previewUrl = URL.createObjectURL(safeFile);
        setBatchPreviewFiles((prev) => {
          if (!prev) return prev;
          const next = [...prev];
          if (next[index]) {
            URL.revokeObjectURL(next[index].previewUrl);
            next[index] = { file: safeFile, previewUrl };
          }
          return next;
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal mengganti foto");
      } finally {
        setReplaceTargetIndex(null);
      }
      return;
    }
    setReplaceTargetIndex(index);
    replaceInputRef.current?.click();
  }

  async function handleReplaceFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (isNativePlatform()) return;
    const file = e.target.files?.[0];
    const idx = replaceTargetIndex;
    if (replaceInputRef.current) replaceInputRef.current.value = "";
    setReplaceTargetIndex(null);

    if (!file || idx == null) return;

    if (!["image/jpeg", "image/jpg", "image/png"].includes(file.type)) {
      setError("Format file tidak didukung. Gunakan JPEG atau PNG.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Ukuran file maksimal 5MB.");
      return;
    }

    console.warn(`[DEBUG handleReplaceFile] arrayBuffer() START: ${file.name}`);
    const buf = await file.arrayBuffer();
    console.warn(`[DEBUG handleReplaceFile] arrayBuffer() OK: ${file.name} (${buf.byteLength} bytes)`);
    const safeFile = new File([buf], file.name, { type: file.type });
    // Verifikasi in-memory File bisa dibaca
    try {
      const v = await safeFile.arrayBuffer();
      console.warn(`[DEBUG handleReplaceFile] in-memory verify OK: ${file.name} (${v.byteLength} bytes)`);
    } catch (e) {
      console.warn(`[DEBUG handleReplaceFile] in-memory verify FAILED: ${file.name}`, e);
    }

    // Validasi EXIF tanggal foto
    const dateValidation = await validatePhotoDate(safeFile);
    if (dateValidation.status !== "valid") {
      setFraudModal({
        isOpen: true,
        status: dateValidation.status,
        title: dateValidation.title,
        message: dateValidation.message,
      });
      return;
    }

    // Validasi EXIF GPS
    const gps = await readExifGps(safeFile);
    if (!gps?.latitude || !gps?.longitude) {
      setFraudModal({
        isOpen: true,
        status: "no_gps",
        title: "Foto Tanpa Data Lokasi",
        message:
          "Foto ini tidak memiliki metadata lokasi (EXIF GPS). " +
          "Aktifkan GPS pada perangkat Anda saat mengambil foto, " +
          "atau gunakan kamera langsung untuk hasil terbaik.",
      });
      return;
    }

    const newUrl = URL.createObjectURL(safeFile);

    setBatchPreviewFiles((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      URL.revokeObjectURL(next[idx].previewUrl);
      next[idx] = { file: safeFile, previewUrl: newUrl };
      return next;
    });

    setError("");
  }

  // ── Global overlay for analyze progress (injected into each return path) ──

  const analyzeOverlay = analyzeState && (
    <Portal>
      <AnalyzingOverlay
        stage={analyzeState.stage}
        variant={analyzeState.variant}
        batchCount={analyzeState.batchCount}
        batchProgress={analyzeState.batchProgress}
      />
    </Portal>
  );

  // ── Guard: not petugas ──

  if (user?.role !== "petugas") {
    return (
      <PageLayout showBrand withBottomNav>
        {analyzeOverlay}
        <main className="flex flex-col items-center justify-center py-20 px-4">
          <Icon name="lock" className="!text-5xl text-[#64748B] mb-4 opacity-30" />
          <p className="text-[#475569] text-center">Halaman ini khusus petugas lapangan.</p>
        </main>
      </PageLayout>
    );
  }

  // ── Capture mode ──

  if (taskId) {
    if (!activeTask) {
      return (
        <PageLayout back="/upload" title="Upload & Analisis" withBottomNav>
          {analyzeOverlay}
          <main className="flex flex-col items-center justify-center py-20 px-4">
            <Icon name="search_off" className="!text-5xl text-[#64748B] mb-4 opacity-30" />
            <p className="text-[#475569] text-center">Jadwal tidak ditemukan.</p>
          </main>
        </PageLayout>
      );
    }

    // ── Batch preview view ──

    if (batchPreviewFiles) {
      return (
        <PageLayout back="/upload" title="Upload & Analisis" withBottomNav>
          {analyzeOverlay}
          <FraudWarningModal
            isOpen={fraudModal.isOpen}
            status={fraudModal.status}
            title={fraudModal.title}
            message={fraudModal.message}
            onClose={closeFraudModal}
          />
          <main className="flex flex-col min-h-full">
            <section className="bg-gradient-to-br from-[#1e40af] to-[#2e68d8] p-6 text-white">
              <p className="text-sm text-blue-200">Upload laporan untuk:</p>
              <h2 className="text-lg font-bold mt-1">{activeTask.road_name}</h2>
              {activeTask.kecamatan && (
                <p className="text-sm text-blue-200 mt-0.5">Kec. {activeTask.kecamatan}</p>
              )}
            </section>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              <p className="text-[13px] font-semibold text-[#475569]">
                {batchPreviewFiles.length} foto dipilih
              </p>
              {batchPreviewFiles.map((p, i) => (
                <div key={i} className="bg-white border border-[#D0DAE8] rounded-lg p-3">
                  <div className="flex items-start gap-3">
                    <img
                      src={p.previewUrl}
                      alt={p.file.name}
                      className="w-16 h-16 object-cover rounded-lg shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[12px] text-[#0F172A] font-medium truncate">Foto {i + 1}</p>
                        <button
                          type="button"
                          onClick={() => handleReplaceTrigger(i)}
                          className="text-[11px] text-[#1e40af] font-semibold shrink-0 whitespace-nowrap"
                        >
                          Ganti
                        </button>
                      </div>
                      <div className="flex items-center gap-1 mt-2 mb-1.5">
                        <Icon name="straighten" className="!text-[12px] text-[#1e40af]" />
                        <span className="text-[10px] font-bold text-[#0F172A]">Dimensi Kerusakan</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[9px] text-[#64748B] block mb-0.5">Panjang (m)</span>
                          <input
                            type="number" step="0.1" min="0"
                            placeholder="0.0"
                            value={batchDimensi[i]?.panjang ?? ""}
                            onChange={(e) =>
                              setBatchDimensi((prev) => ({
                                ...prev,
                                [i]: { ...prev[i], panjang: e.target.value },
                              }))
                            }
                            className="w-full px-2 py-1.5 border border-[#D0DAE8] rounded-lg text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1e40af] focus:border-transparent"
                          />
                        </div>
                        <div>
                          <span className="text-[9px] text-[#64748B] block mb-0.5">Lebar (m)</span>
                          <input
                            type="number" step="0.1" min="0"
                            placeholder="0.0"
                            value={batchDimensi[i]?.lebar ?? ""}
                            onChange={(e) =>
                              setBatchDimensi((prev) => ({
                                ...prev,
                                [i]: { ...prev[i], lebar: e.target.value },
                              }))
                            }
                            className="w-full px-2 py-1.5 border border-[#D0DAE8] rounded-lg text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1e40af] focus:border-transparent"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex gap-3 pb-4">
                <button
                  type="button"
                  onClick={handleBatchPreviewKembali}
                  className="flex-1 h-12 border-2 border-[#D0DAE8] rounded-xl text-[13px] font-semibold text-[#475569] hover:bg-[#F8FAFC] transition-colors"
                >
                  Kembali
                </button>
                <button
                  type="button"
                  onClick={handleBatchAnalyze}
                  disabled={analyzeState !== null}
                  className="flex-1 h-12 bg-[#1e40af] text-white rounded-xl text-[13px] font-semibold hover:bg-[#1A4F8A] transition-colors disabled:opacity-50"
                >
                  Analisis Semua
                </button>
              </div>

              {error && (
                <div className="px-4 py-3 rounded-lg text-sm bg-red-50 border border-red-200 text-[#E11D48]">
                  {error}
                </div>
              )}

              <input
                ref={replaceInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleReplaceFile}
              />
            </div>
          </main>
        </PageLayout>
      );
    }

    // ── Single preview view ──

    if (preview) {
      return (
        <PageLayout back="/upload" title="Upload & Analisis" withBottomNav>
          {analyzeOverlay}
          <FraudWarningModal
            isOpen={fraudModal.isOpen}
            status={fraudModal.status}
            title={fraudModal.title}
            message={fraudModal.message}
            onClose={closeFraudModal}
          />
          <main className="flex flex-col min-h-full">
            <section className="bg-gradient-to-br from-[#1e40af] to-[#2e68d8] p-6 text-white">
              <p className="text-sm text-blue-200">Upload laporan untuk:</p>
              <h2 className="text-lg font-bold mt-1">{activeTask.road_name}</h2>
              {activeTask.kecamatan && (
                <p className="text-sm text-blue-200 mt-0.5">Kec. {activeTask.kecamatan}</p>
              )}
            </section>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="max-w-xl mx-auto space-y-4">
                <div className="flex justify-center">
                  <img
                    src={preview.previewUrl}
                    alt="Preview"
                    className="w-40 h-40 object-cover rounded-xl border border-[#D0DAE8]"
                  />
                </div>

                <div className="bg-white border border-[#D0DAE8] rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Icon name="straighten" className="!text-[16px] text-[#1e40af]" />
                    <span className="text-[12px] font-bold text-[#0F172A]">Dimensi Kerusakan</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-[#64748B] mb-0.5 block">Panjang (m)</label>
                      <input
                        type="number" step="0.1" min="0"
                        value={preview.panjang}
                        onChange={(e) => setPreview({ ...preview, panjang: e.target.value })}
                        placeholder="0.0"
                        className="w-full px-2.5 py-1.5 border border-[#D0DAE8] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1e40af]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#64748B] mb-0.5 block">Lebar (m)</label>
                      <input
                        type="number" step="0.1" min="0"
                        value={preview.lebar}
                        onChange={(e) => setPreview({ ...preview, lebar: e.target.value })}
                        placeholder="0.0"
                        className="w-full px-2.5 py-1.5 border border-[#D0DAE8] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1e40af]"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleRetake}
                    className="flex-1 h-10 border-2 border-[#D0DAE8] rounded-xl text-[12px] font-semibold text-[#475569] hover:bg-[#F8FAFC] transition-colors"
                  >
                    Foto Ulang
                  </button>
                  <button
                    type="button"
                    onClick={handleAnalyze}
                    disabled={analyzeState !== null}
                    className="flex-1 h-10 bg-[#1e40af] text-white rounded-xl text-[12px] font-semibold hover:bg-[#1A4F8A] transition-colors disabled:opacity-50"
                  >
                    Analisis
                  </button>
                </div>

                {error && (
                  <div className="px-4 py-3 rounded-lg text-sm bg-red-50 border border-red-200 text-[#E11D48]">
                    {error}
                  </div>
                )}
              </div>
            </div>
          </main>
        </PageLayout>
      );
    }

    // ── Capture mode (Kamera / Galeri) ──

    return (
      <PageLayout back="/upload" title="Upload & Analisis" withBottomNav>
        {analyzeOverlay}
        <FraudWarningModal
          isOpen={fraudModal.isOpen}
          status={fraudModal.status}
          title={fraudModal.title}
          message={fraudModal.message}
          onClose={closeFraudModal}
        />
        <main className="flex flex-col min-h-full">
          <section className="bg-gradient-to-br from-[#1e40af] to-[#2e68d8] p-6 text-white">
            <p className="text-sm text-blue-200">Upload laporan untuk:</p>
            <h2 className="text-lg font-bold mt-1">{activeTask.road_name}</h2>
            {activeTask.kecamatan && (
              <p className="text-sm text-blue-200 mt-0.5">Kec. {activeTask.kecamatan}</p>
            )}
          </section>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="max-w-xl mx-auto space-y-6">
              <button
                type="button"
                onClick={() => {
                  if (isNativePlatform()) {
                    handleNativeBatchSelect();
                  } else {
                    galleryInputRef.current?.click();
                  }
                }}
                disabled={analyzeState !== null}
                className="w-full flex flex-col items-center justify-center gap-2 py-8 bg-white border-2 border-dashed border-[#C7D2FE] rounded-xl hover:border-[#A5B4FC] hover:bg-[#EEF2FF] transition-all disabled:opacity-50"
              >
                <Icon name="photo_library" className="!text-4xl text-[#1e40af]" />
                <span className="text-[13px] font-semibold text-[#1e40af]">Pilih 2+ Foto</span>
              </button>

              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleCameraCapture}
              />
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                multiple={!isNativePlatform()}
                className="hidden"
                onChange={handleGallerySelect}
              />

              {error && (
                <div className="px-4 py-3 rounded-lg text-sm bg-red-50 border border-red-200 text-[#E11D48]">
                  {error}
                </div>
              )}
            </div>
          </div>
        </main>
      </PageLayout>
    );
  }

  // ── List mode ──

  const task = tasks[0];

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  return (
    <PageLayout showBrand withBottomNav>
      {analyzeOverlay}
      <main className="pb-4">
        <section className="bg-gradient-to-br from-[#1e40af] to-[#2e68d8] p-6 text-white">
          <h1 className="text-xl font-bold tracking-tight">Upload & Analisis</h1>
          {task?.tanggal_patroli ? (
            <p className="text-sm text-blue-200 mt-1">{formatDate(task.tanggal_patroli)}</p>
          ) : (
            <p className="text-sm text-blue-200 mt-1">
              {isFetching ? "Memuat jadwal..." : `Jadwal patroli hari ini (${tasks.length})`}
            </p>
          )}
        </section>

        <div className="max-w-5xl mx-auto px-4">
          {isFetching && (
            <div className="mt-4 flex flex-col gap-3">
              <div className="w-full rounded-xl overflow-hidden border border-[#D0DAE8] bg-slate-100 animate-pulse" style={{ height: "240px" }} />
              <div className="bg-white border border-[#D0DAE8] rounded-xl p-4 animate-pulse">
                <div className="w-2/3 h-6 bg-[#D0DAE8] rounded mb-3" />
                <div className="w-1/2 h-4 bg-[#E8F0FA] rounded mb-2" />
                <div className="w-1/3 h-4 bg-[#E8F0FA] rounded" />
              </div>
            </div>
          )}

          {!isFetching && tasks.length === 0 && (
            <div className="text-center py-16 text-[#476788]">
              <Icon name="calendar_month" className="!text-5xl mb-3 opacity-30 mx-auto" />
              <p className="font-body-md text-body-md">Tidak ada jadwal patroli untuk hari ini</p>
              <p className="text-sm text-[#64748B] mt-1">Cek Tugas Saya untuk melihat jadwal Anda</p>
            </div>
          )}

          {!isFetching && task && (
            <div className="mt-4 md:grid md:grid-cols-2 md:gap-5 md:items-start">
              {/* ── Map ── */}
              <div className="md:sticky md:top-4">
                {task.kecamatan ? (
                  <PatrolMap
                    kecamatan={task.kecamatan}
                    height="240px"
                  />
                ) : (
                  <div
                    className="w-full rounded-xl overflow-hidden border border-[#D0DAE8] bg-slate-50 flex items-center justify-center"
                    style={{ height: "240px" }}
                  >
                    <p className="text-xs text-[#64748B]">Kecamatan tidak ditentukan</p>
                  </div>
                )}
              </div>

              {/* ── Task Card ── */}
              <div className="bg-white border border-[#D0DAE8] rounded-xl p-5 mt-4 md:mt-0">
                <div className="flex items-start gap-2 mb-4">
                  <div className="w-1 rounded-full bg-[#1e40af] shrink-0 self-stretch" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-[15px] font-bold text-[#0F172A]">
                      <Icon name="location_on" className="!text-[18px] text-[#1e40af]" filled />
                      {task.kecamatan ?? "Kecamatan tidak diketahui"}
                    </div>
                    {task.road_name && (
                      <p className="text-[13px] text-[#475569] mt-0.5 flex items-center gap-1">
                        <Icon name="near_me" className="!text-[14px] text-[#64748B]" />
                        {task.road_name}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {task.priority && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${PRIORITY_STYLES[task.priority] ?? ""}`}>
                        {task.priority}
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        task.status === "aktif"
                          ? "bg-blue-50 text-[#1e40af] border border-blue-200"
                          : "bg-green-50 text-[#10B981] border border-green-200"
                      }`}
                    >
                      {task.status === "aktif" ? "Aktif" : "Selesai"}
                    </span>
                  </div>
                </div>

                <div className="space-y-2.5 text-[13px]">
                  <div className="flex items-center gap-2 text-[#475569]">
                    <Icon name="pending_actions" className="!text-[16px] text-[#64748B]" />
                    <span>
                      {task.jam_mulai ?? "07:00"} – {task.jam_selesai ?? "16:00"} WIB
                    </span>
                  </div>
                  {task.team?.name && (
                    <div className="flex items-center gap-2 text-[#475569]">
                      <Icon name="group" className="!text-[16px] text-[#64748B]" />
                      <span>{task.team.name}</span>
                    </div>
                  )}
                  {task.alasan_tugas && (
                    <div className="flex items-center gap-2 text-[#475569]">
                      <Icon name="assignment" className="!text-[16px] text-[#64748B]" />
                      <span className="capitalize">{task.alasan_tugas.replace("_", " ")}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-[#475569]">
                    <Icon name="description" className="!text-[16px] text-[#64748B]" />
                    <span>
                      {task.reports_count != null
                        ? `${task.reports_count} laporan`
                        : "Belum ada laporan"}
                    </span>
                  </div>
                </div>

                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => navigate({ to: "/upload", search: { taskId: task.id } })}
                    className="w-full h-12 bg-[#1e40af] text-white rounded-xl text-[14px] font-bold flex items-center justify-center gap-2 hover:bg-[#1A4F8A] active:scale-[0.98] transition-all"
                  >
                    <Icon name="camera_alt" className="!text-[18px]" />
                    Tambahkan Laporan
                  </button>
                </div>
              </div>
            </div>
          )}

          {!isFetching && task && (
            <div className="mt-3 text-center">
              <p className="text-[11px] text-[#94A3B8] flex items-center justify-center gap-1">
                <Icon name="info" className="!text-[12px]" />
                1 kecamatan ditugaskan untuk hari ini
              </p>
            </div>
          )}
        </div>
      </main>

    </PageLayout>
  );
}
