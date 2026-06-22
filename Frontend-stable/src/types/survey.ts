export type SurveyPriority = "Tinggi" | "Sedang" | "Rendah";
export type SurveyStatus = "aktif" | "selesai" | "dibatalkan";

export interface SurveyTask {
  id: string;
  road_name: string;
  kecamatan: string | null;
  road_geometry: [number, number][] | null;
  road_length_m: number | null;
  team_id: string | null;
  team?: { id: string; name: string; description?: string | null };}
  priority: SurveyPriority | null;
  catatan: string | null;
  status: SurveyStatus;
  created_at: string;
  updated_at: string;
  reports_count?: number;
  reports?: SurveyReport[];
}

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
  members?: Array<{
    id: number;
    name: string;
    nip?: string;
    role: string;
  }>;
  created_at: string;
}

export interface CreateSurveyPayload {
  road_name: string;
  kecamatan?: string;
  road_geometry?: [number, number][];
  road_length_m?: number;
  team_id: string;
  priority?: SurveyPriority;
  catatan?: string;
}
