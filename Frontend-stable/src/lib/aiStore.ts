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
  kerusakanPanjang?: string;
  kerusakanLebar?: string;
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
  { bg: string; text: string; border: string; label: string }
> = {
  "Rusak Berat": {
    bg: "bg-[#E11D48]",
    text: "text-white",
    border: "border-[#E11D48]",
    label: "Rusak Berat",
  },
  "Rusak Sedang": {
    bg: "bg-orange-50",
    text: "text-[#F97316]",
    border: "border-orange-200",
    label: "Rusak Sedang",
  },
  "Rusak Ringan": {
    bg: "bg-amber-50",
    text: "text-[#F59E0B]",
    border: "border-amber-200",
    label: "Rusak Ringan",
  },
  Baik: {
    bg: "bg-emerald-50",
    text: "text-[#10B981]",
    border: "border-emerald-200",
    label: "Baik",
  },
};

// ── API Configuration ─────────────────────────────────────────────────────
// Di browser: path relatif agar Vite proxy → Laravel (port 8080)
// Di Capacitor: perlu full URL karena tidak ada Vite proxy.
// Capacitor injects window.Capacitor — dicek tanpa import agar bundle aman.
function getApiBaseUrl(): string {
  if (
    typeof window !== 'undefined' &&
    typeof (window as Record<string, unknown>).Capacitor !== 'undefined'
  ) {
    return import.meta.env.VITE_API_BASE_URL ?? 'http://10.0.2.2:8080/api';
  }
  return '/api';
}

export const API_BASE_URL = getApiBaseUrl();
