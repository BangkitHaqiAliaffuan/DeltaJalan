/**
 * laporan.ts
 *
 * Type definitions untuk fitur laporan DeltaJalan.
 * Mencakup status laporan, trust score, batch upload, dan AI analysis.
 */

export type StatusLaporan =
  | "Menunggu Review"
  | "Ditinjau"
  | "Disetujui"
  | "Ditolak"
  | "Sedang Diperbaiki"
  | "Selesai"
  | "Diedit";

export type TrustLabel = "hijau" | "kuning" | "merah";
export type KoordinatSumber = "exif" | "browser_gps" | "manual";
export type SeverityLevel = "ringan" | "sedang" | "berat" | "baik";
export type PriorityLevel = "Rendah" | "Sedang" | "Tinggi";
export type StatusDeadline = "tepat_waktu" | "mendekati" | "terlambat";

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
  photos_count: number;
  trust_score: number;
  trust_label: TrustLabel;
  overall_severity: SeverityLevel;
  road_matched: boolean;
  duplicate_photos?: { file_index: number; file_name: string }[];
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
  first_photo_url?: string | null;
  created_at: string;
  updated_at?: string;

  // After photo & closing
  after_photo_url?: string | null;
  after_photo_hash?: string | null;
  after_photo_notes?: string | null;
  after_photos?: { id: number; url: string; sort_order: number }[] | null;
  perbaikan_dimulai_at?: string | null;
  perbaikan_selesai_at?: string | null;
  pelaksana?: string | null;

  // Team assignment
  assigned_team_id?: number | null;
  assigned_team_name?: string | null;
  assigned_at?: string | null;
  catatan_petugas?: string | null;

  // Dimensi kerusakan (standar Bina Marga)
  kerusakan_panjang?: number | null;
  kerusakan_lebar?: number | null;

  // Prioritas penanganan (dari supervisor)
  priority?: PriorityLevel;

  // Deadline & terlambat flags
  deadline_review?: string | null;
  deadline_resolusi?: string | null;
  status_deadline?: string;
  terlambat_review?: boolean;
  terlambat_resolusi?: boolean;

  // Duplikasi
  is_duplicate?: boolean;
  duplicate_score?: number | null;
  duplicate_of?: DuplicateReport | null;

  // Survey task relation
  survey_task_id?: string | null;

  // STA (Stationing) — offset meter dari titik awal ruas
  sta_meter?: number | null;
  sta_label?: string | null;
  road_polyline?: [number, number][] | null;

  // Batch grouping — photos di tabel terpisah
  batch_id?: string | null;
  photos_count?: number;
  photos?: ReportPhoto[];

  // Timeline riwayat status
  status_history?: TimelineEvent[];
}

export interface ReportPhoto {
  id: string;
  reporter_name?: string | null;
  ai_jenis_kerusakan?: string | null;
  ai_severity?: string | null;
  ai_confidence?: number | null;
  total_detections?: number;
  latitude: number | null;
  longitude: number | null;
  image_original_url?: string | null;
  image_result_url?: string | null;
  system_notes?: string | null;
  sort_order?: number;
  created_at: string | null;
  kerusakan_panjang?: number | null;
  kerusakan_lebar?: number | null;
}

// ── Timeline ────────────────────────────────────────────────────────────

export type TimelineEventType =
  | "laporan_dibuat"
  | "ditinjau"
  | "disetujui"
  | "ditolak"
  | "disposisi"
  | "perbaikan_dimulai"
  | "perbaikan_selesai"
  | "dibuka_kembali"
  | "menunggu_review"
  | "ditugaskan"
  | "triage"
  | "diedit"
  | "status_changed";

export interface TimelineEvent {
  event: TimelineEventType;
  label: string;
  status: string;
  old_status: string | null;
  timestamp: string;
  actor_name: string | null;
  actor_role: string | null;
  notes: string;
}

// ── Peta Interaktif GIS ─────────────────────────────────────────────────

export interface DistrictSummary {
  district: string;
  total: number;
  rusak_berat: number;
  rusak_sedang: number;
  rusak_ringan: number;
  avg_severity_score: number;
}

export interface MapStats {
  total: number;
  by_severity: {
    berat: number;
    sedang: number;
    ringan: number;
  };
  by_status: {
    "Menunggu Review": number;
    Disetujui: number;
    "Sedang Diperbaiki": number;
    Selesai: number;
    Ditolak: number;
  };
  terlambat_count: number;
  terlambat_review?: number;
  terlambat_resolusi?: number;
}

export interface LaporanMarker {
  id: string;
  latitude: number;
  longitude: number;
  status: string;
  overall_severity?: string | null;
  ai_severity?: string | null;
  road_name: string;
  district: string;
  first_photo_url?: string | null;
  kerusakan_panjang?: number | null;
  kerusakan_lebar?: number | null;
  trust_score?: number;
  created_at: string;
  assigned_team_id?: number | null;
  assigned_team_name?: string | null;
}

export interface MapDataResponse {
  districts: Record<string, DistrictSummary>;
  reports: LaporanMarker[];
  stats: MapStats;
}

// ── Notifikasi ────────────────────────────────────────────────────────────

export interface RingkasanDeadlinePerPrioritas {
  total: number;
  tepat_waktu: number;
  mendekati: number;
  terlambat: number;
}

export interface RingkasanDeadlineResponse {
  per_priority: Record<string, RingkasanDeadlinePerPrioritas>;
  total: RingkasanDeadlinePerPrioritas;
}

export interface DuplicateReport {
  id: string;
  report_code: string;
  road_name: string;
  district: string;
  latitude: number | null;
  longitude: number | null;
  score: number;
  match_type: string;
  status: string;
}

export interface NotificationItem {
  id: string;
  type: string;
  data: {
    type: string;
    message: string;
    report_id?: string;
    report_code?: string;
    actor_name?: string;
    actor_role?: string;
  };
  read_at: string | null;
  created_at: string;
}
