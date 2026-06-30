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

interface UserForm {
  name: string;
  email: string;
  password: string;
  role: string;
  wilayah: string;
  nip: string;
  team_id: string;
}

const EMPTY_FORM: UserForm = {
  name: "",
  email: "",
  password: "",
  role: "petugas",
  wilayah: "",
  nip: "",
  team_id: "",
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
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [editId, setEditId] = useState<number | null>(null);
  const [formError, setFormError] = useState("");
  const [formBusy, setFormBusy] = useState(false);

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

  const teamsQuery = useQuery({
    queryKey: ["admin-teams-list"],
    queryFn: () =>
      apiFetch("/api/teams?limit=100", { headers: { Authorization: `Bearer ${token}` } }).then(
        (r) => r.json(),
      ),
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
  }[] = usersQuery.data?.data ?? [];
  const teams: { id: number; name: string }[] = teamsQuery.data?.data ?? [];

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

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setFormError("");
    setModal("create");
  }

  function openEdit(u: (typeof users)[0]) {
    setEditId(u.id);
    setForm({
      name: u.name,
      email: u.email,
      password: "",
      role: u.role,
      wilayah: u.wilayah ?? "",
      nip: u.nip ?? "",
      team_id: u.team_id ? String(u.team_id) : "",
    });
    setFormError("");
    setModal("edit");
  }

  async function handleSubmit() {
    setFormError("");
    if (!form.name || !form.email) {
      setFormError("Nama dan email harus diisi.");
      return;
    }
    if (modal === "create" && !form.password) {
      setFormError("Password harus diisi untuk user baru.");
      return;
    }
    setFormBusy(true);
    try {
      const url = modal === "edit" && editId ? `/api/users/${editId}` : "/api/users";
      const method = modal === "edit" ? "PUT" : "POST";
      const body: Record<string, unknown> = { name: form.name, email: form.email, role: form.role };
      if (form.password) body.password = form.password;
      if (form.wilayah) body.wilayah = form.wilayah;
      if (form.nip) body.nip = form.nip;
      if (form.team_id) body.team_id = Number(form.team_id);

      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setFormError(data.message ?? "Gagal menyimpan.");
        return;
      }
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setModal(null);
    } catch {
      setFormError("Gagal terhubung ke server.");
    } finally {
      setFormBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#0F172A]">Manajemen User</h1>
          <p className="text-[13px] text-[#64748B] mt-1">Kelola akun pengguna sistem</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 bg-[#1A4F8A] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#15407A] transition-colors"
        >
          <Icon name="add" className="!text-[18px]" /> Tambah User
        </button>
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
                  users.map((u) => (
                    <tr
                      key={u.id}
                      className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]"
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
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                          Aktif
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(u)}
                            className="p-1.5 hover:bg-[#F1F5F9] rounded-lg text-[#475569]"
                          >
                            <Icon name="edit" className="!text-[18px]" />
                          </button>
                          <button
                            onClick={() => setDeleteId(u.id)}
                            className="p-1.5 hover:bg-red-50 rounded-lg text-[#E11D48]"
                          >
                            <Icon name="delete" className="!text-[18px]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal && (
        <ModalBase
          onClose={() => !formBusy && setModal(null)}
          icon={modal === "create" ? "person_add" : "person_edit"}
          badge={modal === "create" ? "USER BARU" : "EDIT USER"}
          title={modal === "create" ? "Tambah User" : "Edit User"}
          footer={
            <div className="flex gap-2 w-full">
              <button
                onClick={() => setModal(null)}
                disabled={formBusy}
                className="flex-1 h-11 border border-[#E2E8F0] rounded-lg text-[13px] font-semibold text-[#64748B] hover:bg-[#F8FAFC] disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleSubmit}
                disabled={formBusy}
                className="flex-1 h-11 bg-[#1A4F8A] text-white rounded-lg text-[14px] font-semibold hover:bg-[#15407A] disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {formBusy && (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                {modal === "create" ? "Simpan" : "Perbarui"}
              </button>
            </div>
          }
        >
          {formError && (
            <div className="text-[13px] text-[#E11D48] bg-red-50 border border-red-200 rounded-lg px-4 py-2">
              {formError}
            </div>
          )}
          <Input
            label="Nama"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
            required
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(v) => setForm({ ...form, email: v })}
            required
          />
          <Input
            label={modal === "create" ? "Password" : "Password (kosongkan jika tidak diubah)"}
            type="password"
            value={form.password}
            onChange={(v) => setForm({ ...form, password: v })}
            required={modal === "create"}
          />
          <div>
            <label className="block text-[13px] font-semibold text-[#0F172A] mb-1">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full h-9 px-3 border border-[#E2E8F0] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1A4F8A]/20"
            >
              {Object.entries(ROLE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Wilayah"
            value={form.wilayah}
            onChange={(v) => setForm({ ...form, wilayah: v })}
          />
          <Input label="NIP" value={form.nip} onChange={(v) => setForm({ ...form, nip: v })} />
          <div>
            <label className="block text-[13px] font-semibold text-[#0F172A] mb-1">
              Tim Satgas
            </label>
            <select
              value={form.team_id}
              onChange={(e) => setForm({ ...form, team_id: e.target.value })}
              className="w-full h-9 px-3 border border-[#E2E8F0] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1A4F8A]/20"
            >
              <option value="">Tidak ada</option>
              {teams.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
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

function Input({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-[13px] font-semibold text-[#0F172A] mb-1">
        {label}
        {required && " *"}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 px-3 border border-[#E2E8F0] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1A4F8A]/20"
      />
    </div>
  );
}
