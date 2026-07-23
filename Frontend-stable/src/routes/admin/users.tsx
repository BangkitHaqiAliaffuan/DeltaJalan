import { createFileRoute } from "@tanstack/react-router";
import { Icon } from "@/components/jk/Icon";
import { AdminLayout } from "@/components/jk/AdminLayout";
import { ModalBase } from "@/components/jk/ModalBase";
import { requireAdmin } from "@/lib/adminGuard";
import { getToken } from "@/lib/auth";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export const Route = createFileRoute("/admin/users")({
  component: RouteComponent,
  beforeLoad: requireAdmin,
  ssr: false,
});

const ROLE_LABEL: Record<string, string> = {
  warga: "Warga",
  petugas: "Petugas",
  supervisor: "Supervisor",
  petugas_eksekusi: "Petugas Eksekusi",
  admin: "Admin",
};

const ROLE_VARIANTS: Record<string, string> = {
  admin: "bg-purple-50 text-purple-600 border border-purple-200",
  supervisor: "bg-blue-50 text-blue-600 border border-blue-200",
  petugas_eksekusi: "bg-orange-50 text-orange-600 border border-orange-200",
  petugas: "bg-emerald-50 text-emerald-600 border border-emerald-200",
};

function RouteComponent() {
  return (
    <AdminLayout>
      <AdminUsers />
    </AdminLayout>
  );
}

function AdminUsers() {
  const qc = useQueryClient();
  const token = getToken() ?? "";
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [banTarget, setBanTarget] = useState<{ id: number; name: string; banned: boolean } | null>(
    null,
  );
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (roleFilter) params.set("role", roleFilter);
  params.set("limit", "100");

  const usersQuery = useQuery({
    queryKey: ["admin-users", search, roleFilter],
    queryFn: () =>
      apiFetch(`/api/users?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
  });

  const users: {
    id: number;
    name: string;
    email: string;
    role: string;
    role_label: string;
    wilayah: string | null;
    nip: string | null;
    team_id: number | null;
    team_name: string | null;
    banned_at: string | null;
  }[] = usersQuery.data?.data ?? [];

  const banMut = useMutation({
    mutationFn: ({ id, ban }: { id: number; ban: boolean }) =>
      apiFetch(`/api/users/${id}/ban`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ban }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setBanTarget(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/users/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setDeleteId(null);
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#0F172A]">Manajemen User</h1>
          <p className="text-[13px] text-[#64748B] mt-1">Kelola akun pengguna sistem</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0]">
        <div className="p-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Icon
              name="search"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] !text-[18px]"
            />
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
            <option value="petugas">Petugas Satgas</option>
            <option value="supervisor">Supervisor</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          {usersQuery.isPending ? (
            <div className="p-8 text-center text-[#64748B]">Memuat data...</div>
          ) : usersQuery.isError ? (
            <div className="p-8 text-center text-[#E11D48]">Gagal memuat data.</div>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className="text-left py-3 px-4 font-semibold text-[#475569]">Nama</th>
                  <th className="text-left py-3 px-4 font-semibold text-[#475569]">Email</th>
                  <th className="text-left py-3 px-4 font-semibold text-[#475569]">Role</th>
                  <th className="text-left py-3 px-4 font-semibold text-[#475569]">
                    Wilayah / Tim Satgas
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-[#475569]">Status</th>
                  <th className="text-right py-3 px-4 font-semibold text-[#475569]">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#64748B]">
                      Tidak ada pengguna.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => {
                    const isBanned = u.banned_at != null;
                    return (
                      <tr
                        key={u.id}
                        className={`border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC] ${isBanned ? "opacity-60" : ""}`}
                      >
                        <td className="py-3 px-4">
                          <span className="font-medium text-[#0F172A]">{u.name}</span>
                        </td>
                        <td className="py-3 px-4 text-[#64748B]">{u.email}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded ${ROLE_VARIANTS[u.role] ?? "bg-gray-50 text-gray-600"}`}
                          >
                            {ROLE_LABEL[u.role] ?? u.role}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[#64748B]">
                          {u.wilayah ?? u.team_name ?? "-"}
                        </td>
                        <td className="py-3 px-4">
                          {isBanned ? (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-red-50 text-red-600">
                              Dinonaktifkan
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                              Aktif
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {isBanned ? (
                              <button
                                onClick={() =>
                                  setBanTarget({ id: u.id, name: u.name, banned: false })
                                }
                                className="p-1.5 hover:bg-emerald-50 rounded-lg text-[#16A34A]"
                                title="Aktifkan kembali"
                              >
                                <Icon name="check_circle" className="!text-[18px]" />
                              </button>
                            ) : (
                              <button
                                onClick={() =>
                                  setBanTarget({ id: u.id, name: u.name, banned: true })
                                }
                                className="p-1.5 hover:bg-red-50 rounded-lg text-[#E11D48]"
                                title="Nonaktifkan"
                              >
                                <Icon name="block" className="!text-[18px]" />
                              </button>
                            )}
                            <button
                              onClick={() => setDeleteId(u.id)}
                              className="p-1.5 hover:bg-red-50 rounded-lg text-[#E11D48]"
                              title="Hapus"
                            >
                              <Icon name="delete" className="!text-[18px]" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {banTarget !== null && (
        <ModalBase
          onClose={() => !banMut.isPending && setBanTarget(null)}
          icon={banTarget.banned ? "block" : "check_circle"}
          badge="KONFIRMASI"
          title={banTarget.banned ? "Nonaktifkan User" : "Aktifkan User"}
          footer={
            <div className="flex gap-2 w-full">
              <button
                onClick={() => setBanTarget(null)}
                disabled={banMut.isPending}
                className="flex-1 h-11 border border-[#E2E8F0] rounded-lg text-[13px] font-semibold text-[#64748B] hover:bg-[#F8FAFC] disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={() => banMut.mutate({ id: banTarget.id, ban: banTarget.banned })}
                disabled={banMut.isPending}
                className={`flex-1 h-11 text-white rounded-lg text-[14px] font-semibold disabled:opacity-50 flex items-center justify-center gap-1 ${
                  banTarget.banned
                    ? "bg-[#E11D48] hover:bg-[#C11A3E]"
                    : "bg-[#16A34A] hover:bg-[#15803D]"
                }`}
              >
                {banMut.isPending && (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                {banTarget.banned ? "Nonaktifkan" : "Aktifkan"}
              </button>
            </div>
          }
        >
          <p className="text-[13px] text-[#475569] leading-relaxed">
            {banTarget.banned
              ? `Yakin ingin menonaktifkan akun "${banTarget.name}"? User tidak akan bisa login lagi.`
              : `Yakin ingin mengaktifkan kembali akun "${banTarget.name}"?`}
          </p>
        </ModalBase>
      )}

      {deleteId !== null && (
        <ModalBase
          onClose={() => !deleteMut.isPending && setDeleteId(null)}
          icon="delete"
          badge="KONFIRMASI"
          title="Hapus User"
          footer={
            <div className="flex gap-2 w-full">
              <button
                onClick={() => setDeleteId(null)}
                disabled={deleteMut.isPending}
                className="flex-1 h-11 border border-[#E2E8F0] rounded-lg text-[13px] font-semibold text-[#64748B] hover:bg-[#F8FAFC] disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={() => deleteMut.mutate(deleteId)}
                disabled={deleteMut.isPending}
                className="flex-1 h-11 bg-[#E11D48] text-white rounded-lg text-[14px] font-semibold hover:bg-[#C11A3E] disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {deleteMut.isPending && (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                Hapus
              </button>
            </div>
          }
        >
          <p className="text-[13px] text-[#475569] leading-relaxed">
            Yakin ingin menghapus user ini? Tindakan ini tidak dapat dibatalkan.
          </p>
        </ModalBase>
      )}
    </div>
  );
}
