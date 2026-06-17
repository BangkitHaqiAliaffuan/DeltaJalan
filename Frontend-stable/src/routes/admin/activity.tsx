import { createFileRoute } from "@tanstack/react-router";
import { Icon } from "@/components/jk/Icon";
import { AdminLayout } from "@/components/jk/AdminLayout";
import { requireAdmin } from "@/lib/adminGuard";
import { getToken } from "@/lib/auth";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export const Route = createFileRoute("/admin/activity")({
  component: RouteComponent,
  beforeLoad: requireAdmin,
  ssr: false,
});

function RouteComponent() {
  return <AdminLayout><AdminActivity /></AdminLayout>;
}

function AdminActivity() {
  const token = getToken() ?? "";
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  if (search) params.set("actor_name", search);
  params.set("page", String(page));
  params.set("limit", "30");

  const logsQuery = useQuery({
    queryKey: ["admin-activity", search, page],
    queryFn: () => apiFetch(`/api/activity?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    placeholderData: (prev: unknown) => prev as typeof logsQuery.data,
  });

  const resp = logsQuery.data as {
    success?: boolean; data?: {
      id: string; report_id: string; report_code: string | null; road_name: string | null;
      district: string | null; old_status: string | null; new_status: string;
      actor_name: string | null; actor_role: string | null; notes: string | null; created_at: string;
    }[]; total?: number; page?: number; last_page?: number;
  } | undefined;

  const logs = resp?.data ?? [];
  const lastPage = resp?.last_page ?? 1;
  const total = resp?.total ?? 0;
  const from = total === 0 ? 0 : (page - 1) * 30 + 1;
  const to = Math.min(page * 30, total);

  function formatAction(actor: string | null, newStatus: string, oldStatus: string | null): string {
    const name = actor ?? "System";
    const actions: Record<string, string> = {
      "Disetujui": "menyetujui laporan",
      "Ditolak": "menolak laporan",
      "Sedang Diperbaiki": "memulai perbaikan laporan",
      "Selesai": "menyelesaikan laporan",
      "Ditinjau": "meninjau laporan",
    };
    if (newStatus === "Menunggu Review" && !oldStatus) return `${name} membuat laporan baru`;
    return `${name} ${actions[newStatus] ?? `mengubah status ke "${newStatus}"`} laporan`;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-[#0F172A]">Aktivitas Sistem</h1>
        <p className="text-[13px] text-[#64748B] mt-1">Riwayat semua aktivitas pengguna dalam sistem</p>
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0]">
        <div className="p-4 border-b border-[#E2E8F0]">
          <div className="relative max-w-xs">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] !text-[18px]" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Cari nama pengguna..." className="w-full h-9 pl-9 pr-3 border border-[#E2E8F0] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1A4F8A]/20 focus:border-[#1A4F8A]" />
          </div>
        </div>
        {logsQuery.isPending ? (
          <div className="p-8 text-center text-[#64748B]">Memuat data...</div>
        ) : logsQuery.isError ? (
          <div className="p-8 text-center text-[#E11D48]">Gagal memuat data.</div>
        ) : (
          <>
            <div className="divide-y divide-[#E2E8F0]">
              {logs.length === 0 ? (
                <div className="p-8 text-center text-[#64748B]">Tidak ada aktivitas.</div>
              ) : logs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-[#F8FAFC]">
                  <div className="w-8 h-8 rounded-full bg-[#F1F5F9] flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[11px] font-bold text-[#475569]">{(log.actor_name ?? "S")[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-[#0F172A]">
                      {formatAction(log.actor_name, log.new_status, log.old_status)}
                      {log.report_code && <span className="font-mono text-[12px] text-[#1A4F8A] ml-1">{log.report_code}</span>}
                    </p>
                    {log.notes && <p className="text-[11px] text-[#64748B] mt-0.5">{log.notes}</p>}
                    <p className="text-[11px] text-[#94A3B8] mt-0.5">{log.created_at ? new Date(log.created_at).toLocaleString("id-ID") : "—"}</p>
                  </div>
                </div>
              ))}
            </div>
            {total > 30 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[#E2E8F0]">
                <span className="text-[12px] text-[#64748B]">{from}–{to} dari {total}</span>
                <div className="flex gap-1">
                  <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 text-[12px] border border-[#E2E8F0] rounded-lg text-[#475569] hover:bg-[#F8FAFC] disabled:opacity-30">Sebelumnya</button>
                  <button disabled={page >= lastPage} onClick={() => setPage(page + 1)} className="px-3 py-1.5 text-[12px] border border-[#E2E8F0] rounded-lg text-[#475569] hover:bg-[#F8FAFC] disabled:opacity-30">Selanjutnya</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
