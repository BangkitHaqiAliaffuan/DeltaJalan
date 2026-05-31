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
}

export interface BatchResultData {
  photos: BatchPhotoResult[];
  totalDetections: number;
  overallSeverity: string;
  reportCode: string;
  trustScore: number;
  trustLabel: string;
  duplicatePhotos?: { fileIndex: number; fileName: string }[];
}

interface AiStore {
  result: AiAnalysisResult | null;
  formData: UploadFormData | null;
  batchResult: BatchResultData | null;
}

const store: AiStore = {
  result: null,
  formData: null,
  batchResult: null,
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
}

// Severity color mapping
export const SEVERITY_CONFIG: Record<
  string,
  { bg: string; text: string; border: string; label: string }
> = {
  "Rusak Berat": {
    bg: "bg-[#FEE2E2]",
    text: "text-[#991B1B]",
    border: "border-[#FCA5A5]",
    label: "Rusak Berat",
  },
  "Rusak Sedang": {
    bg: "bg-[#FFEDD5]",
    text: "text-[#9A3412]",
    border: "border-[#FDBA74]",
    label: "Rusak Sedang",
  },
  "Rusak Ringan": {
    bg: "bg-[#FEF3C7]",
    text: "text-[#92400E]",
    border: "border-[#FCD34D]",
    label: "Rusak Ringan",
  },
  Baik: {
    bg: "bg-[#D1FAE5]",
    text: "text-[#065F46]",
    border: "border-[#6EE7B7]",
    label: "Baik",
  },
};

// ── API Configuration ─────────────────────────────────────────────────────
// Gunakan path relatif agar Vite proxy bisa meneruskan ke Laravel (port 8080).
// Vite dev server akan proxy /api/* → http://localhost:8080/api/*
// Ini menghindari CORS karena request diteruskan server-to-server oleh Vite.
export const API_BASE_URL = "/api";
