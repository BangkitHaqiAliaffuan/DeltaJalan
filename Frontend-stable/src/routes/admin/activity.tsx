import { createFileRoute } from "@tanstack/react-router";
import { Icon } from "@/components/jk/Icon";
import { AdminLayout } from "@/components/jk/AdminLayout";
import { requireAdmin } from "@/lib/adminGuard";
import { useState } from "react";

export const Route = createFileRoute("/admin/activity")({
  component: RouteComponent,
  beforeLoad: requireAdmin,
});

function RouteComponent() {
  return <AdminLayout><AdminActivity /></AdminLayout>;
}

const MOCK_LOGS = Array.from({ length: 30 }, (_, i) => ({
  id: i + 1,
  user: ["Budi Santoso", "Siti Rahmawati", "Ahmad Hidayat", "Dewi Sartika", "System"][i % 5],
  action: ["Membuat laporan", "Menyetujui laporan", "Menolak laporan", "Menyelesaikan perbaikan", "Login", "Edit laporan", "Assign UPR"][i % 7],
  target: `LP-2026-${String(10000 + i).slice(1)}`,
  date: `2026-06-${String(10 + (i % 20)).padStart(2, "0")} ${String(8 + (i % 10)).padStart(2, "0")}:${String(i * 3 % 60).padStart(2, "0")}`,
}));

function AdminActivity() {
  const [filter, setFilter] = useState("");

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
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Cari aktivitas..." className="w-full h-9 pl-9 pr-3 border border-[#E2E8F0] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1A4F8A]/20 focus:border-[#1A4F8A]" />
          </div>
        </div>
        <div className="divide-y divide-[#E2E8F0]">
          {MOCK_LOGS.map((log) => (
            <div key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-[#F8FAFC]">
              <div className="w-8 h-8 rounded-full bg-[#F1F5F9] flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[11px] font-bold text-[#475569]">{log.user[0]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-[#0F172A]">
                  <span className="font-medium">{log.user}</span>
                  {" "}{log.action}{" "}
                  {log.target && <span className="font-mono text-[12px] text-[#1A4F8A]">{log.target}</span>}
                </p>
                <p className="text-[11px] text-[#94A3B8] mt-0.5">{log.date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
