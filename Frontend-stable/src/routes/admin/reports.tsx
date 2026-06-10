import { createFileRoute } from "@tanstack/react-router";
import { Icon } from "@/components/jk/Icon";
import { AdminLayout } from "@/components/jk/AdminLayout";
import { requireAdmin } from "@/lib/adminGuard";
import { useState } from "react";

export const Route = createFileRoute("/admin/reports")({
  component: RouteComponent,
  beforeLoad: requireAdmin,
});

function RouteComponent() {
  return <AdminLayout><AdminReports /></AdminLayout>;
}

const MOCK_REPORTS = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  code: `LP-2026-${String(10000 + i).slice(1)}`,
  road: ["Jl. Raya Utama", "Jl. Pahlawan", "Jl. Ahmad Yani", "Jl. Diponegoro", "Jl. Sudirman"][i % 5],
  district: ["Utara", "Selatan", "Barat", "Timur"][i % 4],
  severity: ["Rusak Berat", "Rusak Sedang", "Rusak Ringan"][i % 3],
  status: ["Menunggu Review", "Disetujui", "Sedang Diperbaiki", "Selesai", "Ditolak"][i % 5],
  upr: [null, "Satgas Wilayah Utara", "Satgas Wilayah Selatan", null, "Satgas Wilayah Barat"][i % 5],
  reporter: `Pelapor ${i + 1}`,
  date: `2026-0${(i % 9) + 1}-${String(10 + (i % 20)).padStart(2, "0")}`,
}));

function AdminReports() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [uprFilter, setUprFilter] = useState("");

  const filtered = MOCK_REPORTS.filter((r) => {
    if (search && !r.code.toLowerCase().includes(search.toLowerCase()) && !r.road.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter && r.status !== statusFilter) return false;
    if (uprFilter && r.upr !== uprFilter && !(uprFilter === "null" && r.upr === null)) return false;
    return true;
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-[#0F172A]">Semua Laporan</h1>
        <p className="text-[13px] text-[#64748B] mt-1">Lihat dan kelola seluruh laporan kerusakan jalan</p>
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0]">
        <div className="p-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] !text-[18px]" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari kode atau ruas jalan..." className="w-full h-9 pl-9 pr-3 border border-[#E2E8F0] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1A4F8A]/20 focus:border-[#1A4F8A]" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 px-3 border border-[#E2E8F0] rounded-lg text-[13px]">
            <option value="">Semua Status</option>
            <option value="Menunggu Review">Menunggu Review</option>
            <option value="Disetujui">Disetujui</option>
            <option value="Sedang Diperbaiki">Sedang Diperbaiki</option>
            <option value="Selesai">Selesai</option>
            <option value="Ditolak">Ditolak</option>
          </select>
          <select value={uprFilter} onChange={(e) => setUprFilter(e.target.value)} className="h-9 px-3 border border-[#E2E8F0] rounded-lg text-[13px]">
            <option value="">Semua UPR</option>
            <option value="null">Belum Assign</option>
            <option value="Satgas Wilayah Utara">Satgas Wilayah Utara</option>
            <option value="Satgas Wilayah Selatan">Satgas Wilayah Selatan</option>
            <option value="Satgas Wilayah Barat">Satgas Wilayah Barat</option>
            <option value="Satgas Wilayah Timur">Satgas Wilayah Timur</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th className="text-left py-3 px-4 font-semibold text-[#475569]">Kode</th>
                <th className="text-left py-3 px-4 font-semibold text-[#475569]">Ruas Jalan</th>
                <th className="text-left py-3 px-4 font-semibold text-[#475569]">Kecamatan</th>
                <th className="text-left py-3 px-4 font-semibold text-[#475569]">Severity</th>
                <th className="text-left py-3 px-4 font-semibold text-[#475569]">Status</th>
                <th className="text-left py-3 px-4 font-semibold text-[#475569]">UPR</th>
                <th className="text-left py-3 px-4 font-semibold text-[#475569]">Tanggal</th>
                <th className="text-right py-3 px-4 font-semibold text-[#475569]">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                  <td className="py-3 px-4 font-mono text-[12px] font-semibold text-[#0F172A]">{r.code}</td>
                  <td className="py-3 px-4 text-[#0F172A]">{r.road}</td>
                  <td className="py-3 px-4 text-[#64748B]">{r.district}</td>
                  <td className="py-3 px-4">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${r.severity === "Rusak Berat" ? "bg-[#E11D48] text-white" : r.severity === "Rusak Sedang" ? "bg-orange-50 text-[#F97316] border-orange-200" : "bg-amber-50 text-[#F59E0B] border-amber-200"}`}>
                      {r.severity}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${r.status === "Selesai" ? "bg-[#10B981] text-white" : r.status === "Sedang Diperbaiki" ? "bg-orange-50 text-[#F97316] border-orange-200" : r.status === "Disetujui" ? "bg-blue-50 text-[#2563EB] border-blue-200" : r.status === "Ditolak" ? "bg-[#E11D48] text-white" : "bg-amber-50 text-[#F59E0B] border-amber-200"}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-[#64748B]">{r.upr ?? "—"}</td>
                  <td className="py-3 px-4 text-[#64748B]">{r.date}</td>
                  <td className="py-3 px-4 text-right">
                    <button className="p-1.5 hover:bg-[#F1F5F9] rounded-lg text-[#475569]"><Icon name="more_vert" className="!text-[18px]" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
