import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { Icon } from "@/components/jk/Icon";
import { PageLayout } from "@/components/jk/PageLayout";
import { SkeletonNotificationItem } from "@/components/jk/Skeleton";
import { PushSubscriptionManager } from "@/components/jk/PushSubscriptionManager";
import { ConfirmDialog } from "@/components/jk/ConfirmDialog";
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteAllNotifications,
} from "@/lib/notifications";
import { formatDate } from "@/lib/format";
import type { NotificationItem } from "@/types/laporan";

export const Route = createFileRoute("/notifications")({
  component: NotificationsPage,
  head: () => ({ meta: [{ title: "Semua Notifikasi — DeltaJalan" }] }),
});

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

function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  const load = async (p: number, type: string) => {
    setLoading(true);
    const res = await fetchNotifications(p);
    let items = res.data ?? [];
    if (type) {
      items = items.filter((n: NotificationItem) => n.data.type === type);
    }
    setNotifications(items);
    setPage(p);
    setLastPage(res.meta?.last_page ?? 1);
    setLoading(false);
  };

  useEffect(() => {
    load(1, filterType);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleFilter(type: string) {
    setFilterType(type);
    await load(1, type);
  }

  async function handleRead(item: NotificationItem) {
    if (!item.read_at) {
      await markNotificationRead(item.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n)),
      );
    }
  }

  async function handleMarkAll() {
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: new Date().toISOString() })));
  }

  async function handleDeleteAll() {
    await deleteAllNotifications();
    setNotifications([]);
    setPage(1);
    setLastPage(1);
  }

  async function handleLoadMore() {
    if (page >= lastPage) return;
    const next = page + 1;
    const res = await fetchNotifications(next);
    let items = res.data ?? [];
    if (filterType) {
      items = items.filter((n: NotificationItem) => n.data.type === filterType);
    }
    setNotifications((prev) => [...prev, ...items]);
    setPage(next);
    setLastPage(res.meta?.last_page ?? 1);
  }

  const types = [
    { value: "", label: "Semua" },
    { value: "report_created", label: "Laporan Baru" },
    { value: "report_approved", label: "Disetujui" },
    { value: "report_rejected", label: "Ditolak" },
    { value: "upr_assigned", label: "Tugas Baru" },
    { value: "repair_completed", label: "Perbaikan Selesai" },
    { value: "report_edited", label: "Diedit" },
    { value: "triage_updated", label: "Triage" },
    { value: "report_reopened", label: "Dibuka Kembali" },
    { value: "bulk_action", label: "Aksi Massal" },
    { value: "patrol_task_generated", label: "Patroli Baru" },
    { value: "patrol_morning_reminder", label: "Pengingat Patroli" },
    { value: "patrol_evening_reminder", label: "Patroli Selesai" },
  ];

  const handleRefresh = useCallback(async () => {
    await load(1, filterType);
  }, [filterType]);

  return (
    <PageLayout
      title="Semua Notifikasi"
      back="/"
      onRefresh={handleRefresh}
      right={
        <div className="flex items-center gap-2">
          <PushSubscriptionManager />
          <button
            type="button"
            onClick={handleMarkAll}
            className="text-[11px] text-primary font-medium hover:underline"
          >
            Tandai dibaca
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="text-[11px] text-red-500 font-medium hover:underline"
          >
            Hapus semua
          </button>
        </div>
      }
    >
      <div className="flex-1 px-4 py-4 max-w-2xl mx-auto">
        <div className="flex gap-1.5 overflow-x-auto pb-3 mb-2 scrollbar-none">
          {types.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => handleFilter(t.value)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors ${
                filterType === t.value
                  ? "bg-primary text-white"
                  : "bg-[#EEF3FA] text-on-surface-variant hover:bg-[#D0DAE8]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading && notifications.length === 0 ? (
          <div className="space-y-1" aria-busy="true" aria-label="Memuat notifikasi">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white border border-[#E2E8F0] rounded-lg">
                <SkeletonNotificationItem />
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16">
            <Icon name="notifications_none" className="text-[48px] text-[#D0DAE8] mx-auto mb-3" />
            <p className="text-[13px] text-on-surface-variant">Tidak ada notifikasi</p>
          </div>
        ) : (
          <div className="space-y-1">
            {notifications.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleRead(item)}
                className={`w-full text-left px-4 py-3 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors ${
                  !item.read_at ? "bg-[#EFF6FF] border-[#BFDBFE]" : "bg-white"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-1 w-2 h-2 rounded-full shrink-0 ${!item.read_at ? "bg-[#2563EB]" : "bg-transparent"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-on-surface leading-snug">{item.data.message}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] text-on-surface-variant">
                        {formatDate(item.created_at, { withTime: true, short: true })}
                      </span>
                      <span className="text-[10px] text-on-surface-variant">•</span>
                      <span className="text-[10px] text-on-surface-variant">
                        {timeAgo(item.created_at, isClient)}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
            {page < lastPage && (
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loading}
                className="w-full text-center py-3 text-[12px] text-primary font-medium hover:bg-[#F8FAFC] rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? "Memuat lebih banyak..." : "Muat lebih banyak"}
              </button>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Hapus Semua Notifikasi?"
        message="Semua notifikasi akan dihapus permanen. Tindakan ini tidak dapat dibatalkan."
        onConfirm={() => {
          setConfirmDelete(false);
          handleDeleteAll();
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </PageLayout>
  );
}
