import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { playNotificationSound } from "@/lib/notificationSound";
import { fetchNotifications, fetchUnreadCount, markNotificationRead, markAllNotificationsRead, deleteAllNotifications } from "@/lib/notifications";
import { getToken } from "@/lib/auth";
import type { NotificationItem } from "@/types/laporan";
import { Icon } from "./Icon";
import { ConfirmDialog } from "./ConfirmDialog";

export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const prevUnreadRef = useRef(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const refreshUnread = useCallback(() => {
    if (!getToken()) return;
    fetchUnreadCount().then((count) => {
      const prev = prevUnreadRef.current;
      if (count > prev && prev > 0) {
        playNotificationSound();
        toast("Notifikasi baru", {
          description: `${count - prev} notifikasi baru`,
          action: { label: "Lihat", onClick: () => setOpen(true) },
        });
      }
      prevUnreadRef.current = count;
      setUnread(count);
    });
  }, []);

  useEffect(() => {
    if (!getToken()) return;
    fetchUnreadCount().then((count) => {
      setUnread(count);
      prevUnreadRef.current = count;
    });
    const interval = setInterval(refreshUnread, 60_000);
    return () => clearInterval(interval);
  }, [refreshUnread]);

  useEffect(() => {
    if (!getToken()) return;
    function refresh() {
      if (document.visibilityState === "visible") {
        fetchUnreadCount().then((count) => {
          prevUnreadRef.current = count;
          setUnread(count);
        });
      }
    }
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setPage(1);
    setLoading(true);
    fetchNotifications(1).then((res) => {
      setNotifications(res.data ?? []);
      setPage(1);
      setLastPage(res.meta?.last_page ?? 1);
      setLoading(false);
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleClick(item: NotificationItem) {
    if (!item.read_at) {
      await markNotificationRead(item.id);
      setUnread((u) => Math.max(0, u - 1));
    }
    setOpen(false);
    if (
      item.data.type === "patrol_task_generated" ||
      item.data.type === "patrol_morning_reminder" ||
      item.data.type === "patrol_evening_reminder"
    ) {
      navigate({ to: "/tugas-saya" });
    } else if (item.data.report_id) {
      navigate({ to: "/detail-report", search: { reportId: item.data.report_id } });
    }
  }

  async function handleMarkAll() {
    await markAllNotificationsRead();
    setUnread(0);
  }

  async function handleDeleteAll() {
    await deleteAllNotifications();
    setNotifications([]);
    setPage(1);
    setLastPage(1);
    setUnread(0);
  }

  async function loadMore() {
    if (page >= lastPage) return;
    setLoading(true);
    const next = page + 1;
    const res = await fetchNotifications(next);
    setNotifications((prev) => [...prev, ...(res.data ?? [])]);
    setPage(next);
    setLastPage(res.meta?.last_page ?? 1);
    setLoading(false);
  }

  function timeAgo(dateStr: string, client: boolean): string {
    if (!client) return "";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "baru saja";
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}j`;
    const days = Math.floor(hours / 24);
    return `${days}h`;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#EEF3FA] transition-colors"
      >
        <Icon name={unread > 0 ? "notifications" : "notifications_none"} className="text-on-surface-variant" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-[#DC2626] text-white text-[10px] font-bold leading-none px-1 shadow-sm">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-lg border border-[#D0DAE8] overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#D0DAE8]">
            <p className="text-[13px] font-semibold text-on-surface">Notifikasi</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="text-[11px] text-red-500 font-medium hover:underline"
              >
                Hapus
              </button>
              <button
                type="button"
                onClick={handleMarkAll}
                className="text-[11px] text-primary font-medium hover:underline"
              >
                Tandai dibaca
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <p className="text-center text-[12px] text-on-surface-variant py-8">
                Tidak ada notifikasi
              </p>
            ) : (
              <>
                {notifications.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleClick(item)}
                    className={`w-full text-left px-4 py-3 border-b border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors ${!item.read_at ? "bg-[#EFF6FF]" : ""}`}
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${!item.read_at ? "bg-[#2563EB]" : "bg-transparent"}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] text-on-surface leading-snug line-clamp-2">
                          {item.data.message}
                        </p>
                        <p className="text-[10px] text-on-surface-variant mt-1">
                          {timeAgo(item.created_at, isClient)}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
                {page < lastPage && (
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={loading}
                    className="w-full text-center py-2 text-[11px] text-primary font-medium hover:bg-[#F8FAFC] transition-colors disabled:opacity-50"
                  >
                    {loading ? "Memuat..." : "Muat lebih banyak"}
                  </button>
                )}
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate({ to: "/notifications" });
            }}
            className="w-full text-center py-2.5 text-[11px] text-primary font-medium border-t border-[#D0DAE8] hover:bg-[#F8FAFC] transition-colors"
          >
            Lihat Semua
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Hapus Semua Notifikasi?"
        message="Semua notifikasi akan dihapus permanen. Tindakan ini tidak dapat dibatalkan."
        onConfirm={() => { setConfirmDelete(false); handleDeleteAll(); }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
