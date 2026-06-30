import { useQuery } from "@tanstack/react-query";
import { API_BASE_URL } from "@/lib/aiStore";
import type {
  Laporan,
  MapStats,
  DistrictSummary,
} from "@/types/laporan";

import { apiFetch } from "@/lib/api";

export async function authFetch<T>(url: string, token: string): Promise<T> {
  const res = await apiFetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json.data ?? json;
}

export interface StatsResponse {
  total: number;
  menunggu_review: number;
  disetujui: number;
  ditolak: number;
  sedang_diperbaiki: number;
  selesai: number;
  trust_hijau: number;
  trust_kuning: number;
  trust_merah: number;
  rusak_berat: number;
  rusak_sedang: number;
  rusak_ringan: number;
  monthly_trend: Array<{ bulan: string; total: number; selesai: number; rusak_berat: number }>;
}

export function useStats(token: string) {
  return useQuery({
    queryKey: ["stats"],
    queryFn: () => authFetch<StatsResponse>(`${API_BASE_URL}/reports/stats`, token),
    enabled: !!token,
    staleTime: 120_000,
    refetchInterval: 120_000,
  });
}

export function useRecentReports(token: string, limit = 10) {
  return useQuery({
    queryKey: ["reports", "user_reports", limit],
    queryFn: () =>
      authFetch<Laporan[]>(`${API_BASE_URL}/reports?user_reports=true&limit=${limit}`, token),
    enabled: !!token,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

interface MapDataResponse {
  districts: Record<string, DistrictSummary>;
  reports: Laporan[];
  stats: MapStats;
}

interface MapFilters {
  status: string[];
  severity: string[];
  district: string;
  uptd_id: string;
  deadline_hari: string;
  status_deadline: string;
}

export function useMapData(token: string, filters: MapFilters) {
  return useQuery({
    queryKey: ["map-data", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status.length > 0) params.set("status", filters.status.join(","));
      if (filters.severity.length > 0) params.set("severity", filters.severity.join(","));
      if (filters.district) params.set("district", filters.district);
      if (filters.uptd_id) params.set("uptd_id", filters.uptd_id);
      if (filters.deadline_hari) params.set("deadline_hari", filters.deadline_hari);
      if (filters.status_deadline) params.set("status_deadline", filters.status_deadline);
      const qs = params.toString();
      return authFetch<MapDataResponse>(
        `${API_BASE_URL}/reports/map-data${qs ? `?${qs}` : ""}`,
        token,
      );
    },
    enabled: !!token,
    staleTime: 10_000,
  });
}

interface TeamItem {
  id: string;
  name: string;
  wilayah?: string;
  uptd?: { id: string; nama: string; kecamatan_wilayah: string[] };
}

export function useTeams(token: string) {
  return useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/teams?limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      return (json.data ?? []) as TeamItem[];
    },
    enabled: !!token,
    staleTime: 120_000,
  });
}

export function useAllReports(token: string, limit = 20) {
  return useQuery({
    queryKey: ["reports", "all", limit],
    queryFn: () => authFetch<Laporan[]>(`${API_BASE_URL}/reports?limit=${limit}`, token),
    enabled: !!token,
    staleTime: 120_000,
    refetchInterval: 120_000,
  });
}

export interface TeamStat {
  team_id: string;
  team_name: string;
  wilayah: string;
  total: number;
  sedang_diperbaiki: number;
  selesai: number;
  total_panjang_m: number;
  total_luas_m2: number;
}

export function useTeamStats(token: string) {
  return useQuery({
    queryKey: ["team-stats"],
    queryFn: () => authFetch<TeamStat[]>(`${API_BASE_URL}/reports/stats-by-team`, token),
    enabled: !!token,
    staleTime: 300_000,
    refetchInterval: 300_000,
  });
}

export function useCurrentUser(token: string) {
  return useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json.user ?? json.data;
    },
    enabled: !!token,
    retry: false,
    staleTime: 300_000,
  });
}
