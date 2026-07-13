// Shared in-memory store untuk hasil analisis AI
// Digunakan untuk pass data dari upload page ke ai-result page

export interface Detection {
  class: string;
  severity: string;
  confidence: number;
  bbox: { x1: number; y1: number; x2: number; y2: number };
}

export interface AiAnalysisResult {
  detections: Detection[];
  total: number;
  overall_severity: string;
  image_result: string; // base64 JPEG dengan bounding box
  status: string;
}

export interface UploadFormData {
  namaJalan: string;
  kecamatan: string;
  tanggal: string;
  catatan: string;
  previewUrl: string; // object URL untuk preview foto asli
  fileName: string;
  lat?: number; // koordinat GPS (opsional)
  lng?: number;
  kerusakanPanjang?: string;
  kerusakanLebar?: string;
  duplicate_of_id?: string; // ID laporan yang diduga duplikat
  survey_task_id?: string; // ID task/shift tempat laporan ini akan disimpan
  file?: File; // file foto asli (single mode)
}

// ── Batch-specific types ──────────────────────────────────────────────────

export interface BatchPhotoResult {
  fileIndex: number;
  fileName: string;
  imageResult: string; // base64 JPEG dengan bounding box (kosong jika tidak ada deteksi)
  previewUrl: string; // object URL foto asli
  detections: Detection[];
  severity: string;
  confidence: number;
  hasError: boolean;
  isDuplicate?: boolean;
  kerusakanPanjang?: string;
  kerusakanLebar?: string;
  lat?: number;
  lng?: number;
  hasExifGps?: boolean;
}

export interface BatchResultData {
  photos: BatchPhotoResult[];
  totalDetections: number;
  overallSeverity: string;
  reportCode: string;
  trustScore?: number;
  trustLabel?: string;
  duplicatePhotos?: { fileIndex: number; fileName: string }[];
  batchId?: string;
}

export function updateBatchPhoto(index: number, data: Partial<BatchPhotoResult>): void {
  const current = store.batchResult;
  if (!current) return;
  const photos = [...current.photos];
  photos[index] = { ...photos[index], ...data };
  const totalDetections = photos.reduce((sum, p) => sum + p.detections.length, 0);
  const rankOrder = ["baik", "ringan", "sedang", "berat"];
  const displayNames = ["Baik", "Rusak Ringan", "Rusak Sedang", "Rusak Berat"];
  let worstIdx = 0;
  for (const p of photos) {
    const idx = rankOrder.indexOf(p.severity?.toLowerCase() ?? "");
    if (idx > worstIdx) worstIdx = idx;
  }
  store.batchResult = {
    ...current,
    photos,
    totalDetections,
    overallSeverity: displayNames[worstIdx],
  };
}

interface AiStore {
  result: AiAnalysisResult | null;
  formData: UploadFormData | null;
  batchResult: BatchResultData | null;
  pendingBatchFiles: File[];
}

const store: AiStore = {
  result: null,
  formData: null,
  batchResult: null,
  pendingBatchFiles: [],
};

export function setAiResult(result: AiAnalysisResult) {
  store.result = result;
}

export function getAiResult(): AiAnalysisResult | null {
  return store.result;
}

export function setFormData(data: UploadFormData) {
  store.formData = data;
}

export function getFormData(): UploadFormData | null {
  return store.formData;
}

export function setBatchResult(data: BatchResultData) {
  store.batchResult = data;
}

export function getBatchResult(): BatchResultData | null {
  return store.batchResult;
}

export function clearAiStore() {
  store.result = null;
  store.formData = null;
  store.batchResult = null;
  store.pendingBatchFiles = [];
}

export function setPendingBatchFiles(files: File[]): void {
  store.pendingBatchFiles = files;
}

export function getPendingBatchFiles(): File[] {
  return store.pendingBatchFiles;
}

const SEVERITY_FULL_MAP: Record<string, string> = {
  berat: "Rusak Berat",
  "rusak berat": "Rusak Berat",
  sedang: "Rusak Sedang",
  "rusak sedang": "Rusak Sedang",
  ringan: "Rusak Ringan",
  "rusak ringan": "Rusak Ringan",
  baik: "Baik",
};

export function normalizeSeverityKey(key: string | null | undefined): string {
  return SEVERITY_FULL_MAP[key?.toLowerCase().trim() ?? ""] ?? key ?? "Baik";
}

export function getSeverityConfig(key: string | null | undefined) {
  return SEVERITY_CONFIG[normalizeSeverityKey(key)] ?? SEVERITY_CONFIG.Baik;
}

// Severity color mapping
export const SEVERITY_CONFIG: Record<
  string,
  { bg: string; text: string; border: string; label: string; color: string }
> = {
  "Rusak Berat": {
    bg: "bg-[#E11D48]",
    text: "text-white",
    border: "border-[#E11D48]",
    label: "Rusak Berat",
    color: "#E11D48",
  },
  "Rusak Sedang": {
    bg: "bg-orange-50",
    text: "text-[#F97316]",
    border: "border-orange-200",
    label: "Rusak Sedang",
    color: "#F97316",
  },
  "Rusak Ringan": {
    bg: "bg-amber-50",
    text: "text-[#F59E0B]",
    border: "border-amber-200",
    label: "Rusak Ringan",
    color: "#F59E0B",
  },
  Baik: {
    bg: "bg-emerald-50",
    text: "text-[#10B981]",
    border: "border-emerald-200",
    label: "Baik",
    color: "#10B981",
  },
};

// ── Damage class config ──────────────────────────────────────────────────

export const CLASS_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  Lubang: { icon: "circle", color: "#E11D48", bg: "bg-[#E11D48]/15" },
  "Retak Kulit Buaya": { icon: "grid_view", color: "#F97316", bg: "bg-[#F97316]/15" },
  "Retak Memanjang": { icon: "straight", color: "#F59E0B", bg: "bg-[#F59E0B]/15" },
  "Retak Melintang": { icon: "horizontal_rule", color: "#1A4F8A", bg: "bg-[#1A4F8A]/15" },
};

export function getClassConfig(label: string | undefined | null) {
  return (
    CLASS_CONFIG[label ?? ""] ?? { icon: "help_outline", color: "#64748B", bg: "bg-[#64748B]/15" }
  );
}

// ── API Configuration ─────────────────────────────────────────────────────
// VITE_API_BASE_URL bisa absolute (production: https://api.deltajalan.web.id/api)
// atau relative (fallback: /api → Vite proxy handle).
// Kedua mode (browser & Capacitor) pakai URL yang sama dari .env.
function getApiBaseUrl(): string {
  if (
    typeof window !== "undefined" &&
    typeof (window as Record<string, unknown>).Capacitor !== "undefined" &&
    (window as Record<string, unknown>).Capacitor.isNativePlatform?.() === true
  ) {
    const url = import.meta.env.VITE_API_BASE_URL ?? "http://10.0.2.2:8080/api";
    console.log(
      "[DEBUG] getApiBaseUrl — Capacitor path, VITE_API_BASE_URL:",
      import.meta.env.VITE_API_BASE_URL,
      "→ returns:",
      url,
    );
    return url;
  }
  const url = import.meta.env.VITE_API_BASE_URL ?? "/api";
  console.log(
    "[DEBUG] getApiBaseUrl — Browser path, VITE_API_BASE_URL:",
    import.meta.env.VITE_API_BASE_URL,
    "→ returns:",
    url,
  );
  return url;
}

export const API_BASE_URL = getApiBaseUrl();
