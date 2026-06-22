import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "@/lib/aiStore";
import { apiFetch } from "@/lib/api";
import type { Team } from "@/types/survey";
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

export function useTeamsList() {
  const token = getToken();
  return useQuery({
    queryKey: ["teams"],
    queryFn: () => authFetch<Team[]>(`${API_BASE_URL}/teams`),
    enabled: !!token,
    staleTime: 30_000,
  });
}

export function useTeamDetail(id: string | undefined) {
  const token = getToken();
  return useQuery({
    queryKey: ["team", id],
    queryFn: () => authFetch<Team>(`${API_BASE_URL}/teams/${id}`),
    enabled: !!token && !!id,
    staleTime: 15_000,
  });
}

export function useCreateTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; description?: string }) => {
      return authFetch(`${API_BASE_URL}/teams`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

export function useUpdateTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; name?: string; description?: string }) => {
      return authFetch(`${API_BASE_URL}/teams/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

export function useDeleteTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return authFetch(`${API_BASE_URL}/teams/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}
