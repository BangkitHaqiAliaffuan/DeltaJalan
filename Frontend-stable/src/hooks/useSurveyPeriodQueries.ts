import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "@/lib/aiStore";
import { apiFetch } from "@/lib/api";
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

// ── Teams ──────────────────────────────────────────────────────────────────

export function useTeamsList() {
  const token = getToken();
  return useQuery({
    queryKey: ["teams"],
    queryFn: () => authFetch<any[]>(`${API_BASE_URL}/teams`),
    enabled: !!token,
    staleTime: 60_000,
  });
}

export function useTeamRoads(teamId: string | undefined) {
  const token = getToken();
  return useQuery({
    queryKey: ["team-roads", teamId],
    queryFn: () => authFetch<any[]>(`${API_BASE_URL}/teams/${teamId}/roads`),
    enabled: !!token && !!teamId,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useAssignRoadToTeam(teamId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { road_name: string; kecamatan?: string; catatan?: string }) => {
      return authFetch(`${API_BASE_URL}/teams/${teamId}/roads`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-roads", teamId] });
    },
  });
}

export function useUnassignRoadFromTeam(teamId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => {
      return authFetch(`${API_BASE_URL}/teams/${teamId}/roads/${taskId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-roads", teamId] });
    },
  });
}
