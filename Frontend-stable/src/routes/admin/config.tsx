import { createFileRoute } from "@tanstack/react-router";
import { Icon } from "@/components/jk/Icon";
import { AdminLayout } from "@/components/jk/AdminLayout";
import { requireAdmin } from "@/lib/adminGuard";
import { useState } from "react";

export const Route = createFileRoute("/admin/config")({
  component: RouteComponent,
  beforeLoad: requireAdmin,
});

function RouteComponent() {
  return <AdminLayout><AdminConfig /></AdminLayout>;
}

function AdminConfig() {
  const [deadlineReview, setDeadlineReview] = useState("48");
  const [deadlineResolusi, setDeadlineResolusi] = useState("168");
  const [warningHours, setWarningHours] = useState("24");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-[#0F172A]">Pengaturan Sistem</h1>
        <p className="text-[13px] text-[#64748B] mt-1">Konfigurasi parameter dan threshold sistem</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
          <h2 className="text-[15px] font-semibold text-[#0F172A] mb-4">Deadline & Threshold</h2>
          <div className="space-y-4">
            <div>
              <label className="text-[12px] font-semibold text-[#475569] block mb-1">Batas Waktu Review (jam)</label>
              <input type="number" value={deadlineReview} onChange={(e) => setDeadlineReview(e.target.value)} className="w-full h-9 px-3 border border-[#E2E8F0] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1A4F8A]/20 focus:border-[#1A4F8A]" />
              <p className="text-[11px] text-[#94A3B8] mt-1">Default: 48 jam (2 hari)</p>
            </div>
            <div>
              <label className="text-[12px] font-semibold text-[#475569] block mb-1">Batas Waktu Resolusi (jam)</label>
              <input type="number" value={deadlineResolusi} onChange={(e) => setDeadlineResolusi(e.target.value)} className="w-full h-9 px-3 border border-[#E2E8F0] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1A4F8A]/20 focus:border-[#1A4F8A]" />
              <p className="text-[11px] text-[#94A3B8] mt-1">Default: 168 jam (7 hari)</p>
            </div>
            <div>
              <label className="text-[12px] font-semibold text-[#475569] block mb-1">Peringatan Mendekati Deadline (jam sebelum)</label>
              <input type="number" value={warningHours} onChange={(e) => setWarningHours(e.target.value)} className="w-full h-9 px-3 border border-[#E2E8F0] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1A4F8A]/20 focus:border-[#1A4F8A]" />
            </div>
          </div>
          <button className="mt-4 bg-[#1A4F8A] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#15407A] transition-colors">
            Simpan Pengaturan
          </button>
        </div>

        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
          <h2 className="text-[15px] font-semibold text-[#0F172A] mb-4">Informasi Sistem</h2>
          <div className="space-y-3 text-[13px]">
            {[
              { label: "Versi Aplikasi", value: "2.0.0" },
              { label: "Framework", value: "React + Laravel" },
              { label: "Database", value: "PostgreSQL" },
              { label: "Jumlah User", value: "42" },
              { label: "Jumlah Laporan", value: "2,847" },
              { label: "Jumlah UPR", value: "4" },
              { label: "Last Migrate", value: "2026-06-05" },
            ].map((d) => (
              <div key={d.label} className="flex justify-between py-1">
                <span className="text-[#64748B]">{d.label}</span>
                <span className="font-medium text-[#0F172A]">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
