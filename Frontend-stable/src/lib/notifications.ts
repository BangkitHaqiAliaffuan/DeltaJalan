import { getToken } from "./auth";
import { apiFetch } from "./api";

function headers() {
  const token = getToken() ?? "";
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function fetchNotifications(page = 1) {
  const res = await apiFetch(`/api/notifications?page=${page}&per_page=20`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error("Gagal mengambil notifikasi");
  return res.json();
}

export async function fetchUnreadCount(): Promise<number> {
  const res = await apiFetch("/api/notifications/unread-count", {
    headers: headers(),
  });
  if (!res.ok) return 0;
  const json = await res.json();
  return json.data?.unread ?? 0;
}

export async function markNotificationRead(id: string) {
  await apiFetch(`/api/notifications/${id}/read`, {
    method: "POST",
    headers: headers(),
  });
}

export async function markAllNotificationsRead() {
  await apiFetch("/api/notifications/read-all", {
    method: "POST",
    headers: headers(),
  });
}

export async function deleteAllNotifications() {
  await apiFetch("/api/notifications", {
    method: "DELETE",
    headers: headers(),
  });
}
