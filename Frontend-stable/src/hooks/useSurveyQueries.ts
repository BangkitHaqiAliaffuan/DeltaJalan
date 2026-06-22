import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "@/lib/aiStore";
import { apiFetch } from "@/lib/api";
import type { SurveyTask, SurveyStats, CreateSurveyPayload } from "@/types/survey";
import { getToken } from "@/lib/auth";

async function authFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await apiFetch(url, {
    ...options,
    headers: {
      ...(options?.headers ?? {}),
      Authorization: `Bearer ${token ?? ""}`,
      ...(options?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `HTTP ${res.status}`);
  }
  const json = await res.json();
  return json.data ?? json;
}

export function useSurveyList(params?: {
  status?: string;
  team_id?: string;
  q?: string;
  page?: number;
  per_page?: number;
}) {
  const token = getToken();
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.team_id) searchParams.set("team_id", params.team_id);
  if (params?.q) searchParams.set("q", params.q);
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.per_page) searchParams.set("per_page", String(params.per_page));
  const qs = searchParams.toString();

  return useQuery({
    queryKey: ["survey-tasks", qs],
    queryFn: () => authFetch<SurveyTask[]>(`${API_BASE_URL}/survei${qs ? `?${qs}` : ""}`),
    enabled: !!token,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useSurveyStats(params?: { team_id?: string }) {
  const token = getToken();
  const searchParams = new URLSearchParams();
  if (params?.team_id) searchParams.set("team_id", params.team_id);
  const qs = searchParams.toString();

  return useQuery({
    queryKey: ["survey-stats", qs],
    queryFn: () => authFetch<SurveyStats>(`${API_BASE_URL}/survei/stats${qs ? `?${qs}` : ""}`),
    enabled: !!token,
    staleTime: 30_000,
  });
}

export function useSurveyDetail(id: string | undefined) {
  const token = getToken();
  return useQuery({
    queryKey: ["survey-detail", id],
    queryFn: () => authFetch<SurveyTask>(`${API_BASE_URL}/survei/${id}`),
    enabled: !!token && !!id,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useCreateSurvey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateSurveyPayload) => {
      return authFetch(`${API_BASE_URL}/survei`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["survey-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["survey-stats"] });
    },
  });
}

export function useCompleteSurvey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return authFetch(`${API_BASE_URL}/survei/${id}/selesai`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["survey-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["survey-stats"] });
      queryClient.invalidateQueries({ queryKey: ["survey-detail"] });
    },
  });
}

export function useCancelSurvey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return authFetch(`${API_BASE_URL}/survei/${id}/batalkan`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["survey-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["survey-stats"] });
    },
  });
}

export function useDeleteSurvey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return authFetch(`${API_BASE_URL}/survei/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["survey-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["survey-stats"] });
    },
  });
}
