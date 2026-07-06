export type SurveyPriority = "Tinggi" | "Sedang" | "Rendah";
export type SurveyStatus = "aktif" | "selesai" | "dibatalkan";

export interface SurveyTask {
  id: string;
  road_name: string;
  kecamatan: string | null;
  road_geometry: [number, number][] | null;
  road_length_m: number | null;
  team_id: string | null;
  team?: { id: string; name: string; description?: string | null };
  priority: SurveyPriority | null;
  catatan: string | null;
  status: SurveyStatus;
  jam_mulai?: string | null;
  jam_selesai?: string | null;
  tanggal_patroli?: string | null;
  alasan_tugas?: string | null;
  selesai_at?: string | null;
  created_at: string;
  updated_at: string;
  reports_count?: number;
  reports?: SurveyReport[];
}

export type PatrolSession = SurveyTask;

export interface SurveyReport {
  id: string;
  report_code: string;
  road_name: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  overall_severity?: string | null;
  first_photo_url?: string | null;
  image_original_url?: string | null;
  created_at: string;
}

export interface SurveyStats {
  total: number;
  aktif: number;
  selesai: number;
  dibatalkan: number;
}

export interface Team {
  id: string;
  name: string;
  description: string | null;
  members_count?: number;
  uptd_id?: string | null;
  uptd?: {
    id: string;
    nama: string;
    kecamatan_wilayah: string[];
  } | null;
  members?: Array<{
    id: number;
    name: string;
    nip?: string;
    role: string;
  }>;
  created_at: string;
}

export interface CreateSurveyPayload {
  team_id: string;
  kecamatan: string;
  tanggal_patroli: string;
  alasan_tugas?: string;
  priority?: SurveyPriority;
  catatan?: string;
  road_name?: string;
  road_geometry?: [number, number][];
}

export type Frekuensi = "setiap_minggu" | "dua_mingguan" | "bulanan";
export type Hari = "Senin" | "Selasa" | "Rabu" | "Kamis" | "Jumat" | "Sabtu";

export const ALL_HARI: Hari[] = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export interface PatrolSchedule {
  id: string;
  team_id: string;
  team?: { id: string; name: string; description?: string | null };
  hari: Hari[];
  kecamatan_list: string[];
  frekuensi: Frekuensi;
  start_date: string;
  end_date: string | null;
  alasan_tugas: string;
  status: "aktif" | "nonaktif";
  jam_mulai?: string | null;
  jam_selesai?: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
  tasks_count?: number;
}

export interface CreatePatrolSchedulePayload {
  team_id: string;
  hari: Hari[];
  kecamatan_list: string[];
  frekuensi: Frekuensi;
  start_date: string;
  end_date?: string;
  alasan_tugas?: string;
}

export interface PatrolPreview {
  total_hari: number;
  hari_patroli: number;
  kecamatan_count: number;
  estimated_tasks: number;
  start_date: string;
  end_date: string;
}
