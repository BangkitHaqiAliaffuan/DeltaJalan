/**
 * laporan.ts
 *
 * Type definitions untuk fitur laporan JalanKita.
 * Mencakup status laporan, trust score, batch upload, dan AI analysis.
 */

export type StatusLaporan =
  | "Menunggu Review"
  | "Disetujui"
  | "Ditolak"
  | "Sedang Diperbaiki"
  | "Selesai";

export type TrustLabel = "hijau" | "kuning" | "merah";
export type KoordinatSumber = "exif" | "browser_gps" | "manual";
export type SeverityLevel = "ringan" | "sedang" | "berat";

// ── Trust Score ────────────────────────────────────────────────────────────

export interface TrustBreakdown {
  exif_gps: { nilai: number; status: "ada" | "tidak_ada" };
  nama_jalan: { nilai: number; status: "cocok" | "tidak_cocok" };
  ai_deteksi: { nilai: number; status: "berhasil" | "gagal" };
  konteks_visual: { nilai: number; status: "valid" | "tidak_valid" };
  fake_gps: { nilai: number; status: "aman" | "dicurigai" };
}

// ── AI Analysis ────────────────────────────────────────────────────────────

export interface AIDetection {
  type: string;
  confidence: number;
  bbox: number[];
}

export interface AIAnalysisResult {
  file_index: number;
  file_name: string;
  detections: AIDetection[];
  severity: SeverityLevel;
  context_valid: boolean;
  confidence: number;
  image_result?: string | null;
  error?: string;
}

export interface BatchAnalysisResponse {
  batch_id: string;
  total_files: number;
  photos_with_exif_gps: number;
  photos_rejected: number;
  analyses: AIAnalysisResult[];
  latitude: number;
  longitude: number;
}

// ── Batch Store Response ───────────────────────────────────────────────────

export interface BatchStoreResponse {
  success: boolean;
  main_report_id: string;
  main_report_code: string;
  sub_reports_count: number;
  trust_score: number;
  trust_label: TrustLabel;
  overall_severity: SeverityLevel;
  road_matched: boolean;
}

// ── Laporan ────────────────────────────────────────────────────────────────

export interface Laporan {
  id: string;
  report_code: string;
  reporter_name: string;
  road_name: string;
  district: string;
  latitude: number | null;
  longitude: number | null;
  status: StatusLaporan | string;
  trust_score: number;
  trust_label: TrustLabel;
  trust_breakdown?: TrustBreakdown;
  ai_severity?: SeverityLevel | null;
  overall_severity?: string;
  ai_raw_output?: unknown[] | null;
  total_detections?: number;
  system_notes?: string | null;
  image_original_url?: string | null;
  image_result_url?: string | null;
  is_batch_main?: boolean;
  is_batch_sub?: boolean;
  batch_id?: string | null;
  parent_report_id?: string | null;
  created_at: string;
  updated_at?: string;

  // After photo & closing
  after_photo_url?: string | null;
  after_photo_hash?: string | null;
  after_photo_notes?: string | null;
  perbaikan_dimulai_at?: string | null;
  perbaikan_selesai_at?: string | null;
  pelaksana?: string | null;

  // UPR assignment
  assigned_upr_id?: number | null;
  assigned_at?: string | null;
  catatan_petugas?: string | null;
}
