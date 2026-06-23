import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/aiStore";
import type { PatrolSchedule, CreatePatrolSchedulePayload, PatrolPreview } from "@/types/survey";
import { useState } from "react";

function headers() {
  return { Authorization: `Bearer ${getToken() ?? ""}` };
}

export function usePatrolSchedules(params?: { team_id?: string; status?: string }) {
  const search = new URLSearchParams();
  if (params?.team_id) search.set("team_id", params.team_id);
  if (params?.status) search.set("status", params.status);

  return useQuery({
    queryKey: ["patrol-schedules", params],
    queryFn: () =>
      apiFetch(`${API_BASE_URL}/patrol-schedules?${search.toString()}`, {
        headers: headers(),
      }).then((r) => r.json()),
  });
}

export function usePatrolSchedule(id: string | undefined) {
  return useQuery({
    queryKey: ["patrol-schedule", id],
    enabled: !!id,
    queryFn: () =>
      apiFetch(`${API_BASE_URL}/patrol-schedules/${id}`, {
        headers: headers(),
      }).then((r) => r.json()),
  });
}

export function useCreatePatrolSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePatrolSchedulePayload) =>
      apiFetch(`${API_BASE_URL}/patrol-schedules`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers() },
        body: JSON.stringify(payload),
      }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.message ?? "Gagal membuat jadwal");
        return data;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patrol-schedules"] });
    },
  });
}

export function useUpdatePatrolSchedule(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<CreatePatrolSchedulePayload & { status: string }>) =>
      apiFetch(`${API_BASE_URL}/patrol-schedules/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...headers() },
        body: JSON.stringify(payload),
      }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.message ?? "Gagal memperbarui jadwal");
        return data;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patrol-schedules"] });
      qc.invalidateQueries({ queryKey: ["patrol-schedule", id] });
    },
  });
}

export function useDeletePatrolSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`${API_BASE_URL}/patrol-schedules/${id}`, {
        method: "DELETE",
        headers: headers(),
      }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.message ?? "Gagal menghapus jadwal");
        return data;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patrol-schedules"] });
    },
  });
}

export function useTogglePatrolSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`${API_BASE_URL}/patrol-schedules/${id}/toggle`, {
        method: "POST",
        headers: headers(),
      }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.message ?? "Gagal mengubah status jadwal");
        return data;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patrol-schedules"] });
    },
  });
}

export function useGenerateTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, start_date, end_date }: { id: string; start_date: string; end_date: string }) =>
      apiFetch(`${API_BASE_URL}/patrol-schedules/${id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers() },
        body: JSON.stringify({ start_date, end_date }),
      }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.message ?? "Gagal generate");
        return data;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patrol-schedules"] });
    },
  });
}

export function usePatrolPreview() {
  const [preview, setPreview] = useState<PatrolPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function fetchPreview(payload: CreatePatrolSchedulePayload) {
    setLoading(true);
    setError("");
    setPreview(null);
    try {
      const res = await apiFetch(`${API_BASE_URL}/patrol-schedules/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers() },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Gagal preview");
      setPreview(data.preview);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal preview");
    } finally {
      setLoading(false);
    }
  }

  return { preview, loading, error, fetchPreview };
}
