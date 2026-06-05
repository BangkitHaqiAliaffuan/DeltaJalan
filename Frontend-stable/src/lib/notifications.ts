import { getToken } from "./auth";
import { API_BASE_URL } from "./aiStore";

function headers() {
  const token = getToken() ?? "";
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function fetchNotifications(page = 1) {
  const res = await fetch(`${API_BASE_URL}/notifications?page=${page}&per_page=20`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error("Gagal mengambil notifikasi");
  return res.json();
}

export async function fetchUnreadCount(): Promise<number> {
  const res = await fetch(`${API_BASE_URL}/notifications/unread-count`, {
    headers: headers(),
  });
  if (!res.ok) return 0;
  const json = await res.json();
  return json.data?.unread ?? 0;
}

export async function markNotificationRead(id: string) {
  await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
    method: "POST",
    headers: headers(),
  });
}

export async function markAllNotificationsRead() {
  await fetch(`${API_BASE_URL}/notifications/read-all`, {
    method: "POST",
    headers: headers(),
  });
}

export async function deleteAllNotifications() {
  await fetch(`${API_BASE_URL}/notifications`, {
    method: "DELETE",
    headers: headers(),
  });
}
