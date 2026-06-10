import { createFileRoute } from "@tanstack/react-router";
import { Icon } from "@/components/jk/Icon";
import { AdminLayout } from "@/components/jk/AdminLayout";
import { requireAdmin } from "@/lib/adminGuard";
import { useState } from "react";

export const Route = createFileRoute("/admin/users")({
  component: RouteComponent,
  beforeLoad: requireAdmin,
});

function RouteComponent() {
  return <AdminLayout><AdminUsers /></AdminLayout>;
}

const MOCK_USERS = [
  { id: 1, name: "Budi Santoso", email: "budi@pu.sidoarjokab.go.id", role: "petugas" as const, wilayah: "Utara", nip: "198501012010011001", upr: null, aktif: true },
  { id: 2, name: "Siti Rahmawati", email: "siti@pu.sidoarjokab.go.id", role: "supervisor" as const, wilayah: null, nip: "197803152005012002", upr: null, aktif: true },
  { id: 3, name: "Ahmad Hidayat", email: "ahmad@pu.sidoarjokab.go.id", role: "petugas_eksekusi" as const, wilayah: null, nip: "199002202015011003", upr: "Satgas Wilayah Utara", aktif: true },
  { id: 4, name: "Dewi Sartika", email: "dewi@pu.sidoarjokab.go.id", role: "petugas" as const, wilayah: "Selatan", nip: "199105122016012004", upr: null, aktif: true },
  { id: 5, name: "Rudi Hermawan", email: "rudi@pu.sidoarjokab.go.id", role: "petugas_eksekusi" as const, wilayah: null, nip: "198807252014011005", upr: "Satgas Wilayah Selatan", aktif: false },
  { id: 6, name: "Admin Utama", email: "admin@pu.sidoarjokab.go.id", role: "admin" as const, wilayah: null, nip: null, upr: null, aktif: true },
];

const ROLE_LABEL: Record<string, string> = {
  petugas: "Petugas Lapangan",
  supervisor: "Supervisor",
  petugas_eksekusi: "Petugas Eksekusi",
  admin: "Admin",
};

function AdminUsers() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const filtered = MOCK_USERS.filter((u) => {
    if (search && !u.name.toLowerCase().includes(search.toLowerCase()) && !u.email.toLowerCase().includes(search.toLowerCase())) return false;
    if (roleFilter && u.role !== roleFilter) return false;
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#0F172A]">Manajemen User</h1>
          <p className="text-[13px] text-[#64748B] mt-1">Kelola akun pengguna sistem</p>
        </div>
        <button className="flex items-center gap-1.5 bg-[#1A4F8A] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#15407A] transition-colors">
          <Icon name="add" className="!text-[18px]" />
          Tambah User
        </button>
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0]">
        <div className="p-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] !text-[18px]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama atau email..."
              className="w-full h-9 pl-9 pr-3 border border-[#E2E8F0] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1A4F8A]/20 focus:border-[#1A4F8A]"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-9 px-3 border border-[#E2E8F0] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1A4F8A]/20"
          >
            <option value="">Semua Role</option>
            <option value="petugas">Petugas Lapangan</option>
            <option value="supervisor">Supervisor</option>
            <option value="petugas_eksekusi">Petugas Eksekusi</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th className="text-left py-3 px-4 font-semibold text-[#475569]">Nama</th>
                <th className="text-left py-3 px-4 font-semibold text-[#475569]">Email</th>
                <th className="text-left py-3 px-4 font-semibold text-[#475569]">Role</th>
                <th className="text-left py-3 px-4 font-semibold text-[#475569]">Wilayah / UPR</th>
                <th className="text-left py-3 px-4 font-semibold text-[#475569]">Status</th>
                <th className="text-right py-3 px-4 font-semibold text-[#475569]">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                  <td className="py-3 px-4">
                    <span className="font-medium text-[#0F172A]">{u.name}</span>
                  </td>
                  <td className="py-3 px-4 text-[#64748B]">{u.email}</td>
                  <td className="py-3 px-4">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${u.role === "admin" ? "bg-purple-50 text-purple-600 border border-purple-200" : u.role === "supervisor" ? "bg-blue-50 text-blue-600 border border-blue-200" : u.role === "petugas_eksekusi" ? "bg-orange-50 text-orange-600 border border-orange-200" : "bg-emerald-50 text-emerald-600 border border-emerald-200"}`}>
                      {ROLE_LABEL[u.role]}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-[#64748B]">{u.wilayah ?? u.upr ?? "-"}</td>
                  <td className="py-3 px-4">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${u.aktif ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                      {u.aktif ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button className="p-1.5 hover:bg-[#F1F5F9] rounded-lg text-[#475569]"><Icon name="edit" className="!text-[18px]" /></button>
                      <button className="p-1.5 hover:bg-red-50 rounded-lg text-[#E11D48]"><Icon name="delete" className="!text-[18px]" /></button>
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
