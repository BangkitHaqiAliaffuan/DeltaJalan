import { createFileRoute } from "@tanstack/react-router";
import { Icon } from "@/components/jk/Icon";
import { AdminLayout } from "@/components/jk/AdminLayout";
import { requireAdmin } from "@/lib/adminGuard";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/admin/export")({
  component: RouteComponent,
  beforeLoad: requireAdmin,
});

function RouteComponent() {
  return <AdminLayout><AdminExport /></AdminLayout>;
}

function AdminExport() {
  const [month, setMonth] = useState("01");
  const [year, setYear] = useState("2026");
  useEffect(() => {
    const n = new Date();
    setMonth(String(n.getMonth() + 1).padStart(2, "0"));
    setYear(String(n.getFullYear()));
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-[#0F172A]">Export Laporan</h1>
        <p className="text-[13px] text-[#64748B] mt-1">Download laporan bulanan dalam format Excel atau PDF</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
          <h2 className="text-[15px] font-semibold text-[#0F172A] mb-4">Export Bulanan</h2>
          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <label className="text-[11px] font-semibold text-[#475569] block mb-1">Bulan</label>
              <select value={month} onChange={(e) => setMonth(e.target.value)} className="w-full h-9 px-3 border border-[#E2E8F0] rounded-lg text-[13px]">
                {["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"].map((m, i) => (
                  <option key={i} value={String(i + 1).padStart(2, "0")}>{m}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-[11px] font-semibold text-[#475569] block mb-1">Tahun</label>
              <select value={year} onChange={(e) => setYear(e.target.value)} className="w-full h-9 px-3 border border-[#E2E8F0] rounded-lg text-[13px]">
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <button className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors text-[13px]">
              <span className="flex items-center gap-2">
                <Icon name="table_chart" className="text-emerald-600 !text-[20px]" />
                <span className="font-medium text-[#0F172A]">Export Excel (.xlsx)</span>
              </span>
              <Icon name="download" className="text-[#64748B] !text-[18px]" />
            </button>
            <button className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors text-[13px]">
              <span className="flex items-center gap-2">
                <Icon name="picture_as_pdf" className="text-red-600 !text-[20px]" />
                <span className="font-medium text-[#0F172A]">Export PDF</span>
              </span>
              <Icon name="download" className="text-[#64748B] !text-[18px]" />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
          <h2 className="text-[15px] font-semibold text-[#0F172A] mb-4">Preview Ringkasan</h2>
          <div className="space-y-3 text-[13px]">
            {[
              { label: "Total Laporan", value: "312" },
              { label: "Selesai", value: "198" },
              { label: "Dalam Proses", value: "67" },
              { label: "Rusak Berat", value: "58" },
              { label: "Rusak Sedang", value: "124" },
              { label: "Rusak Ringan", value: "130" },
            ].map((d) => (
              <div key={d.label} className="flex justify-between">
                <span className="text-[#64748B]">{d.label}</span>
                <span className="font-semibold text-[#0F172A]">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
