import { createFileRoute } from "@tanstack/react-router";
import { Icon } from "@/components/jk/Icon";
import { AdminLayout } from "@/components/jk/AdminLayout";
import { ModalBase } from "@/components/jk/ModalBase";
import { requireAdmin } from "@/lib/adminGuard";
import { getToken } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/aiStore";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { Team } from "@/types/survey";

export const Route = createFileRoute("/admin/teams")({
  component: RouteComponent,
  beforeLoad: requireAdmin,
  ssr: false,
});

const EMPTY_FORM = { name: "", description: "" };

function RouteComponent() {
  return <AdminLayout><AdminTeams /></AdminLayout>;
}

function AdminTeams() {
  const qc = useQueryClient();
  const token = getToken() ?? "";

  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [formBusy, setFormBusy] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const teamsQuery = useQuery({
    queryKey: ["admin-teams"],
    queryFn: () => apiFetch(`${API_BASE_URL}/teams?limit=100`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
  });

  const teams: Team[] = teamsQuery.data?.data ?? [];

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch(`${API_BASE_URL}/teams/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-teams"] }); setDeleteId(null); },
  });

  function openCreate() { setForm(EMPTY_FORM); setEditId(null); setFormError(""); setModal("create"); }

  function openEdit(t: Team) {
    setEditId(t.id);
    setForm({ name: t.name, description: t.description ?? "" });
    setFormError("");
    setModal("edit");
  }

  async function handleSubmit() {
    setFormError("");
    if (!form.name) { setFormError("Nama tim harus diisi."); return; }
    setFormBusy(true);
    try {
      const body: Record<string, unknown> = { name: form.name };
      if (form.description) body.description = form.description;
      const method = modal === "edit" && editId ? "PUT" : "POST";
      const url = modal === "edit" && editId ? `${API_BASE_URL}/teams/${editId}` : `${API_BASE_URL}/teams`;
      const res = await apiFetch(url, {
        method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setFormError(data.message ?? "Gagal menyimpan."); return; }
      qc.invalidateQueries({ queryKey: ["admin-teams"] });
      setModal(null);
    } catch { setFormError("Gagal terhubung ke server."); }
    finally { setFormBusy(false); }
  }

  const filtered = teams.filter(
    (t) => !search || t.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#0F172A]">Kelola Tim Satgas</h1>
          <p className="text-[13px] text-[#64748B] mt-1">Atur tim satgas dan anggota</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 bg-[#1A4F8A] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#15407A] transition-colors">
          <Icon name="add" className="!text-[18px]" /> Buat Tim Baru
        </button>
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0]">
        <div className="p-4 border-b border-[#E2E8F0]">
          <div className="relative">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] !text-[18px]" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama tim..." className="w-full h-9 pl-9 pr-3 border border-[#E2E8F0] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1A4F8A]/20 focus:border-[#1A4F8A]" />
          </div>
        </div>
        <div className="overflow-x-auto">
          {teamsQuery.isPending ? (
            <div className="p-8 text-center text-[#64748B]">Memuat data...</div>
          ) : teamsQuery.isError ? (
            <div className="p-8 text-center text-[#E11D48]">Gagal memuat data.</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-[#64748B]">
              <Icon name="groups" className="!text-5xl mb-3 opacity-30" />
              <p className="font-body-md text-body-md">Belum ada tim satgas</p>
              <button onClick={openCreate} className="mt-3 px-4 py-2 bg-[#1A4F8A] text-white rounded-lg text-sm font-semibold">
                Buat Tim Baru
              </button>
            </div>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className="text-left py-3 px-4 font-semibold text-[#475569]">Nama Tim</th>
                  <th className="text-left py-3 px-4 font-semibold text-[#475569]">Deskripsi</th>
                  <th className="text-left py-3 px-4 font-semibold text-[#475569]">Anggota</th>
                  <th className="text-right py-3 px-4 font-semibold text-[#475569]">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                    <td className="py-3 px-4"><span className="font-medium text-[#0F172A]">{t.name}</span></td>
                    <td className="py-3 px-4 text-[#64748B]">{t.description ?? "-"}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-[#475569]">
                        <Icon name="person" className="!text-[16px]" />
                        {t.members_count ?? 0}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(t)} className="p-1.5 hover:bg-[#F1F5F9] rounded-lg text-[#475569]"><Icon name="edit" className="!text-[18px]" /></button>
                        <button onClick={() => setDeleteId(t.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-[#E11D48]"><Icon name="delete" className="!text-[18px]" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create/Edit modal */}
      {modal && (
        <ModalBase
          onClose={() => !formBusy && setModal(null)}
          icon={modal === "create" ? "group_add" : "group"}
          badge={modal === "create" ? "TIM BARU" : "EDIT TIM"}
          title={modal === "create" ? "Buat Tim Baru" : "Edit Tim"}
          footer={
            <div className="flex gap-2 w-full">
              <button onClick={() => setModal(null)} disabled={formBusy} className="flex-1 h-11 border border-[#E2E8F0] rounded-lg text-[13px] font-semibold text-[#64748B] hover:bg-[#F8FAFC] disabled:opacity-50">Batal</button>
              <button onClick={handleSubmit} disabled={formBusy} className="flex-1 h-11 bg-[#1A4F8A] text-white rounded-lg text-[14px] font-semibold hover:bg-[#15407A] disabled:opacity-50 flex items-center justify-center gap-1">
                {formBusy && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {modal === "create" ? "Simpan" : "Perbarui"}
              </button>
            </div>
          }
        >
          {formError && <div className="text-[13px] text-[#E11D48] bg-red-50 border border-red-200 rounded-lg px-4 py-2">{formError}</div>}
          <div>
            <label className="block text-[13px] font-semibold text-[#0F172A] mb-1">Nama Tim <span className="text-[#E11D48]">*</span></label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nama tim satgas" className="w-full h-9 px-3 border border-[#E2E8F0] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1A4F8A]/20" />
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-[#0F172A] mb-1">Deskripsi</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Deskripsi tim (opsional)" className="w-full h-20 px-3 py-2 border border-[#E2E8F0] rounded-lg text-[13px] resize-none focus:outline-none focus:ring-2 focus:ring-[#1A4F8A]/20" />
          </div>
        </ModalBase>
      )}

      {/* Delete confirmation */}
      {deleteId !== null && (
        <ModalBase
          onClose={() => !deleteMut.isPending && setDeleteId(null)}
          icon="delete"
          badge="KONFIRMASI"
          title="Hapus Tim"
          footer={
            <div className="flex gap-2 w-full">
              <button onClick={() => setDeleteId(null)} disabled={deleteMut.isPending} className="flex-1 h-11 border border-[#E2E8F0] rounded-lg text-[13px] font-semibold text-[#64748B] hover:bg-[#F8FAFC] disabled:opacity-50">Batal</button>
              <button onClick={() => deleteMut.mutate(deleteId)} disabled={deleteMut.isPending} className="flex-1 h-11 bg-[#E11D48] text-white rounded-lg text-[14px] font-semibold hover:bg-[#C11A3E] disabled:opacity-50 flex items-center justify-center gap-1">
                {deleteMut.isPending && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Hapus
              </button>
            </div>
          }
        >
          <p className="text-[13px] text-[#475569] leading-relaxed">Yakin ingin menghapus tim ini? Tim yang memiliki anggota tidak dapat dihapus.</p>
        </ModalBase>
      )}
    </div>
  );
}
