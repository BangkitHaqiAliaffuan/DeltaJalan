import { createFileRoute } from "@tanstack/react-router";
import { Icon } from "@/components/jk/Icon";
import { AdminLayout } from "@/components/jk/AdminLayout";
import { ModalBase } from "@/components/jk/ModalBase";
import { requireAdmin } from "@/lib/adminGuard";
import { getToken } from "@/lib/auth";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export const Route = createFileRoute("/admin/uprs")({
  component: RouteComponent,
  beforeLoad: requireAdmin,
  ssr: false,
});

interface UprForm {
  name: string; wilayah: string; leader_name: string; phone: string;
}

const EMPTY_FORM: UprForm = { name: "", wilayah: "", leader_name: "", phone: "" };

function RouteComponent() {
  return <AdminLayout><AdminUprs /></AdminLayout>;
}

function AdminUprs() {
  const qc = useQueryClient();
  const token = getToken() ?? "";
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [form, setForm] = useState<UprForm>(EMPTY_FORM);
  const [editId, setEditId] = useState<number | null>(null);
  const [formError, setFormError] = useState("");
  const [formBusy, setFormBusy] = useState(false);

  const params = new URLSearchParams();
  if (search) params.set("q", search);
  params.set("limit", "100");
  params.set("is_active", "");

  const uprsQuery = useQuery({
    queryKey: ["admin-uprs", search],
    queryFn: () => apiFetch(`/api/uprs?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
  });

  const uprs: { id: number; name: string; wilayah: string | null; leader_name: string | null; phone: string | null; is_active: boolean; anggota: number }[] = uprsQuery.data?.data ?? [];

  const petugasQuery = useQuery({
    queryKey: ["petugas-eksekusi-list"],
    queryFn: () =>
      apiFetch("/api/users?role=petugas_eksekusi&limit=100", { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json()),
  });
  const petugasList: { id: number; name: string }[] = petugasQuery.data?.data ?? [];

  const toggleMut = useMutation({
    mutationFn: ({ id, currentActive }: { id: number; currentActive: boolean }) =>
      apiFetch(`/api/uprs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_active: !currentActive }),
      }),
    onSuccess: (_data, variables) => {
      qc.setQueriesData({ queryKey: ["admin-uprs"] }, (old: unknown) => {
        if (!old || typeof old !== "object") return old;
        const data = (old as Record<string, unknown>).data;
        if (!Array.isArray(data)) return old;
        return { ...(old as Record<string, unknown>), data: data.map((u: Record<string, unknown>) =>
          u.id === variables.id ? { ...u, is_active: !u.is_active } : u
        )};
      });
    },
  });

  function openCreate() { setForm(EMPTY_FORM); setEditId(null); setFormError(""); setModal("create"); }

  function openEdit(u: typeof uprs[0]) {
    setEditId(u.id);
    setForm({ name: u.name, wilayah: u.wilayah ?? "", leader_name: u.leader_name ?? "", phone: u.phone ?? "" });
    setFormError(""); setModal("edit");
  }

  async function handleSubmit() {
    setFormError("");
    if (!form.name) { setFormError("Nama tim harus diisi."); return; }
    setFormBusy(true);
    try {
      const url = modal === "edit" && editId ? `/api/uprs/${editId}` : "/api/uprs";
      const method = modal === "edit" ? "PUT" : "POST";
      const body: Record<string, unknown> = { name: form.name };
      if (form.wilayah) body.wilayah = form.wilayah;
      if (form.leader_name) body.leader_name = form.leader_name;
      if (form.phone) body.phone = form.phone;

      const res = await apiFetch(url, {
        method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setFormError(data.message ?? "Gagal menyimpan."); return; }
      qc.invalidateQueries({ queryKey: ["admin-uprs"] });
      setModal(null);
    } catch { setFormError("Gagal terhubung ke server."); }
    finally { setFormBusy(false); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#0F172A]">Manajemen UPR</h1>
          <p className="text-[13px] text-[#64748B] mt-1">Kelola tim satgas Unit Pelaksana</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 bg-[#1A4F8A] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#15407A] transition-colors">
          <Icon name="add" className="!text-[18px]" /> Tambah UPR
        </button>
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0]">
        <div className="p-4 border-b border-[#E2E8F0]">
          <div className="relative max-w-xs">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] !text-[18px]" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama tim..." className="w-full h-9 pl-9 pr-3 border border-[#E2E8F0] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1A4F8A]/20 focus:border-[#1A4F8A]" />
          </div>
        </div>
        <div className="overflow-x-auto">
          {uprsQuery.isPending ? (
            <div className="p-8 text-center text-[#64748B]">Memuat data...</div>
          ) : uprsQuery.isError ? (
            <div className="p-8 text-center text-[#E11D48]">Gagal memuat data.</div>
          ) : (
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
                {uprs.length === 0 ? (
                  <tr><td colSpan={7} className="py-8 text-center text-[#64748B]">Tidak ada UPR.</td></tr>
                ) : uprs.map((u) => (
                  <tr key={u.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                    <td className="py-3 px-4 font-medium text-[#0F172A]">{u.name}</td>
                    <td className="py-3 px-4 text-[#64748B]">{u.wilayah ?? "-"}</td>
                    <td className="py-3 px-4 text-[#0F172A]">{u.leader_name ?? "-"}</td>
                    <td className="py-3 px-4 text-[#64748B]">{u.phone ?? "-"}</td>
                    <td className="py-3 px-4 text-center text-[#0F172A]">{u.anggota}</td>
                    <td className="py-3 px-4">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${u.is_active ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                        {u.is_active ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(u)} className="p-1.5 hover:bg-[#F1F5F9] rounded-lg text-[#475569]"><Icon name="edit" className="!text-[18px]" /></button>
                        <button onClick={() => toggleMut.mutate({ id: u.id, currentActive: u.is_active })} title={u.is_active ? "Nonaktifkan" : "Aktifkan"} className="p-1.5 hover:bg-[#F1F5F9] rounded-lg text-[#475569]"><Icon name={u.is_active ? "toggle_on" : "toggle_off"} className="!text-[18px]" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal && (
        <ModalBase
          onClose={() => !formBusy && setModal(null)}
          icon={modal === "create" ? "group_add" : "group"}
          badge={modal === "create" ? "UPR BARU" : "EDIT UPR"}
          title={modal === "create" ? "Tambah UPR" : "Edit UPR"}
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
          <Input label="Nama Tim" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <Input label="Wilayah" value={form.wilayah} onChange={(v) => setForm({ ...form, wilayah: v })} />
          <div>
            <label className="block text-[13px] font-semibold text-[#0F172A] mb-1">Ketua</label>
            <select value={form.leader_name} onChange={(e) => setForm({ ...form, leader_name: e.target.value })}
              className="w-full h-9 px-3 border border-[#E2E8F0] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1A4F8A]/20 bg-white appearance-none"
              style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center", backgroundSize: "16px" }}>
              <option value="">-- Pilih Ketua --</option>
              {petugasQuery.isPending ? <option disabled>Memuat...</option> : petugasList.map((p) => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>
          <Input label="Kontak" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
        </ModalBase>
      )}
    </div>
  );
}

function Input({ label, value, onChange, type = "text", required }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div>
      <label className="block text-[13px] font-semibold text-[#0F172A] mb-1">{label}{required && " *"}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full h-9 px-3 border border-[#E2E8F0] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1A4F8A]/20" />
    </div>
  );
}
