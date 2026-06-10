import { createFileRoute } from "@tanstack/react-router";
import { Icon } from "@/components/jk/Icon";
import { AdminLayout } from "@/components/jk/AdminLayout";
import { requireAdmin } from "@/lib/adminGuard";
import { useState } from "react";

export const Route = createFileRoute("/admin/uprs")({
  component: RouteComponent,
  beforeLoad: requireAdmin,
});

function RouteComponent() {
  return <AdminLayout><AdminUprs /></AdminLayout>;
}

const MOCK_UPRS = [
  { id: 1, name: "Satgas Wilayah Utara", wilayah: "Utara", leader: "Drs. H. Suprapto", phone: "081234567891", active: true, anggota: 8 },
  { id: 2, name: "Satgas Wilayah Selatan", wilayah: "Selatan", leader: "Ir. Bambang W.", phone: "081234567892", active: true, anggota: 6 },
  { id: 3, name: "Satgas Wilayah Barat", wilayah: "Barat", leader: "Hj. Fatimah, ST", phone: "081234567893", active: true, anggota: 7 },
  { id: 4, name: "Satgas Wilayah Timur", wilayah: "Timur", leader: "M. Rifai, SE", phone: "081234567894", active: true, anggota: 5 },
];

function AdminUprs() {
  const [search, setSearch] = useState("");

  const filtered = MOCK_UPRS.filter((u) => {
    if (search && !u.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#0F172A]">Manajemen UPR</h1>
          <p className="text-[13px] text-[#64748B] mt-1">Kelola tim satgas Unit Pelaksana</p>
        </div>
        <button className="flex items-center gap-1.5 bg-[#1A4F8A] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#15407A] transition-colors">
          <Icon name="add" className="!text-[18px]" />
          Tambah UPR
        </button>
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0]">
        <div className="p-4 border-b border-[#E2E8F0]">
          <div className="relative max-w-xs">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] !text-[18px]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama tim..."
              className="w-full h-9 pl-9 pr-3 border border-[#E2E8F0] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1A4F8A]/20 focus:border-[#1A4F8A]"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th className="text-left py-3 px-4 font-semibold text-[#475569]">Nama Tim</th>
                <th className="text-left py-3 px-4 font-semibold text-[#475569]">Wilayah</th>
                <th className="text-left py-3 px-4 font-semibold text-[#475569]">Ketua</th>
                <th className="text-left py-3 px-4 font-semibold text-[#475569]">Kontak</th>
                <th className="text-center py-3 px-4 font-semibold text-[#475569]">Anggota</th>
                <th className="text-left py-3 px-4 font-semibold text-[#475569]">Status</th>
                <th className="text-right py-3 px-4 font-semibold text-[#475569]">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                  <td className="py-3 px-4 font-medium text-[#0F172A]">{u.name}</td>
                  <td className="py-3 px-4 text-[#64748B]">{u.wilayah}</td>
                  <td className="py-3 px-4 text-[#0F172A]">{u.leader}</td>
                  <td className="py-3 px-4 text-[#64748B]">{u.phone}</td>
                  <td className="py-3 px-4 text-center text-[#0F172A]">{u.anggota}</td>
                  <td className="py-3 px-4">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${u.active ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                      {u.active ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button className="p-1.5 hover:bg-[#F1F5F9] rounded-lg text-[#475569]"><Icon name="edit" className="!text-[18px]" /></button>
                      <button className="p-1.5 hover:bg-[#F1F5F9] rounded-lg text-[#475569]"><Icon name="toggle_on" className="!text-[18px]" /></button>
                    </div>
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
