import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Icon } from "@/components/jk/Icon";
import { PageLayout } from "@/components/jk/PageLayout";
import { ModalBase } from "@/components/jk/ModalBase";
import { getCurrentUser, getToken } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/aiStore";
import { apiFetch } from "@/lib/api";
import { KECAMATAN_BBOX } from "@/lib/kecamatanBbox";
import { SearchSelect } from "@/components/jk/SearchSelect";
import {
  useCreatePatrolSchedule,
  useUpdatePatrolSchedule,
  useDeletePatrolSchedule,
  useTogglePatrolSchedule,
  useGenerateTasks,
  usePatrolPreview,
} from "@/hooks/usePatrolScheduleQueries";
import type { PatrolSchedule, Team, Hari, Frekuensi } from "@/types/survey";

export const Route = createFileRoute("/supervisor/patrol-schedule")({
  component: RouteComponent,
  ssr: false,
});

const ALL_HARI: Hari[] = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const HARI_LABEL: Record<string, string> = {
  Senin: "Sen", Selasa: "Sel", Rabu: "Rab",
  Kamis: "Kam", Jumat: "Jum", Sabtu: "Sab", Minggu: "Min",
};
const ALL_KECAMATAN = Object.keys(KECAMATAN_BBOX).sort();
const FREKUENSI_OPTIONS: { value: Frekuensi; label: string }[] = [
  { value: "setiap_minggu", label: "Setiap Minggu" },
  { value: "dua_mingguan", label: "2 Mingguan" },
  { value: "bulanan", label: "Bulanan" },
];

function formatDateId(dateStr: string): string {
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  const [y, m, d] = dateStr.split("-");
  return `${parseInt(d)} ${months[parseInt(m, 10) - 1]} ${y}`;
}

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function twoWeeksLater() {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function RouteComponent() {
  return (
    <PageLayout back="/supervisor" withBottomNav>
      <PatrolSchedulePage />
    </PageLayout>
  );
}

function PatrolSchedulePage() {
  const user = getCurrentUser();
  const token = getToken() ?? "";
  const qc = useQueryClient();
  const [authorized, setAuthorized] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    if (user?.role !== "supervisor") {
      window.location.href = "/";
    } else {
      setAuthorized(true);
    }
  }, [user]);

  useEffect(() => setIsClient(true), []);

  const h = new Date().getHours();
  const greeting = !isClient ? "" : h < 12 ? "pagi" : h < 15 ? "siang" : "sore";

  const [modal, setModal] = useState<"create" | "edit" | "generate" | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [form, setForm] = useState({
    team_id: "",
    hari: [] as Hari[],
    kecamatan_list: [] as string[],
    frekuensi: "setiap_minggu" as Frekuensi,
    start_date: todayStr(),
    end_date: "",
    alasan_tugas: "rutin",
  });
  const [formError, setFormError] = useState("");

  const [genScheduleId, setGenScheduleId] = useState<string | null>(null);
  const [genStart, setGenStart] = useState(todayStr());
  const [genEnd, setGenEnd] = useState(twoWeeksLater());

  const schedulesQuery = useQuery({
    queryKey: ["patrol-schedules"],
    queryFn: () =>
      apiFetch(`${API_BASE_URL}/patrol-schedules?per_page=50`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const teamsQuery = useQuery({
    queryKey: ["admin-teams"],
    queryFn: () =>
      apiFetch(`${API_BASE_URL}/teams?limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
  });

  const schedules: PatrolSchedule[] = schedulesQuery.data?.data ?? [];
  const teams: Team[] = teamsQuery.data?.data ?? [];

  const createMut = useCreatePatrolSchedule();
  const updateMut = useUpdatePatrolSchedule(editId ?? "");
  const deleteMut = useDeletePatrolSchedule();
  const toggleMut = useTogglePatrolSchedule();
  const generateMut = useGenerateTasks();
  const { preview, loading: previewLoading, error: previewError, fetchPreview } = usePatrolPreview();

  if (!authorized) return null;

  function resetForm() {
    setForm({ team_id: "", hari: [], kecamatan_list: [], frekuensi: "setiap_minggu", start_date: todayStr(), end_date: "", alasan_tugas: "rutin" });
    setFormError("");
  }

  function openCreate() {
    resetForm();
    setEditId(null);
    setModal("create");
  }

  function openEdit(s: PatrolSchedule) {
    setEditId(s.id);
    setForm({
      team_id: s.team_id,
      hari: s.hari ?? [],
      kecamatan_list: s.kecamatan_list ?? [],
      frekuensi: s.frekuensi,
      start_date: s.start_date,
      end_date: s.end_date ?? "",
      alasan_tugas: s.alasan_tugas ?? "rutin",
    });
    setFormError("");
    setModal("edit");
  }

  function openGenerate(s: PatrolSchedule) {
    setGenScheduleId(s.id);
    setGenStart(todayStr());
    setGenEnd(twoWeeksLater());
    setModal("generate");
  }

  function toggleHari(h: Hari) {
    setForm((prev) => ({
      ...prev,
      hari: prev.hari.includes(h) ? prev.hari.filter((d) => d !== h) : [...prev.hari, h],
    }));
  }

  function toggleKecamatan(k: string) {
    setForm((prev) => ({
      ...prev,
      kecamatan_list: prev.kecamatan_list.includes(k)
        ? prev.kecamatan_list.filter((kc) => kc !== k)
        : [...prev.kecamatan_list, k],
    }));
  }

  async function handleSubmit() {
    setFormError("");
    if (!form.team_id) { setFormError("Pilih tim satgas."); return; }
    if (form.hari.length < 3) { setFormError("Pilih minimal 3 hari dalam seminggu."); return; }
    if (form.kecamatan_list.length === 0) { setFormError("Pilih minimal 1 kecamatan."); return; }

    const payload = {
      team_id: form.team_id,
      hari: form.hari,
      kecamatan_list: form.kecamatan_list,
      frekuensi: form.frekuensi,
      start_date: form.start_date,
      end_date: form.end_date || undefined,
      alasan_tugas: form.alasan_tugas,
    };

    try {
      if (modal === "create") {
        await createMut.mutateAsync(payload);
      } else if (modal === "edit" && editId) {
        await updateMut.mutateAsync(payload);
      }
      setModal(null);
      resetForm();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Gagal menyimpan jadwal");
    }
  }

  async function handleGenerate() {
    if (!genScheduleId) return;
    setFormError("");
    try {
      await generateMut.mutateAsync({ id: genScheduleId, start_date: genStart, end_date: genEnd });
      setModal(null);
      setGenScheduleId(null);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Gagal generate");
    }
  }

  const isMutating = createMut.isPending || updateMut.isPending || deleteMut.isPending || toggleMut.isPending || generateMut.isPending;

  return (
    <main className="pb-4">
      <section className="bg-gradient-to-br from-[#1e40af] to-[#2e68d8] p-5 text-white mb-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight">
              Selamat {greeting}, {user?.name ?? "Supervisor"}
            </h1>
            <p className="text-sm text-blue-200 mt-1">
              Atur pola patroli rutin tim satgas
            </p>
          </div>
          <span className="px-2.5 py-1 bg-white/15 text-xs font-semibold text-blue-200 uppercase tracking-wide rounded-md">
            Supervisor
          </span>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-[#0F172A]">Daftar Jadwal Patroli</h2>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 bg-[#1A4F8A] text-white text-[13px] font-semibold px-4 py-2 rounded-lg hover:bg-[#15407A] transition-colors"
          >
            <Icon name="add" className="!text-[18px]" /> Jadwal Baru
          </button>
        </div>

      {schedulesQuery.isPending ? (
        <div className="text-center py-12 text-[#64748B]">Memuat data...</div>
      ) : schedules.length === 0 ? (
        <div className="text-center py-16 text-[#476788]">
          <Icon name="calendar_month" className="!text-6xl mb-4 opacity-20" />
          <p className="text-[15px] font-semibold mb-1">Belum ada jadwal patroli rutin</p>
          <p className="text-[13px] text-[#64748B] mb-4">Buat jadwal pertama untuk mengatur pola patroli tim</p>
          <button
            onClick={openCreate}
            className="px-5 py-2.5 bg-[#1A4F8A] text-white rounded-lg text-[13px] font-semibold hover:bg-[#15407A] transition-colors"
          >
            Buat Jadwal Baru
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 @[1100px]:grid-cols-3 gap-4">
          {schedules.map((s) => (
            <ScheduleCard
              key={s.id}
              schedule={s}
              onEdit={() => openEdit(s)}
              onDelete={() => setDeleteId(s.id)}
              onToggle={() => toggleMut.mutate(s.id)}
              onGenerate={() => openGenerate(s)}
            />
          ))}
        </div>
      )}

      {modal === "create" || modal === "edit" ? (
        <ModalBase
          onClose={() => !isMutating && setModal(null)}
          icon="calendar_month"
          badge={modal === "create" ? "JADWAL BARU" : "EDIT JADWAL"}
          title={modal === "create" ? "Buat Jadwal Patroli Baru" : "Edit Jadwal Patroli"}
          footer={
            <div className="flex gap-2 w-full">
              <button onClick={() => setModal(null)} disabled={isMutating} className="flex-1 h-11 border border-[#E2E8F0] rounded-lg text-[13px] font-semibold text-[#64748B] hover:bg-[#F8FAFC] disabled:opacity-50">
                Batal
              </button>
              <button
                onClick={handleSubmit}
                disabled={isMutating}
                className="flex-1 h-11 bg-[#1A4F8A] text-white rounded-lg text-[14px] font-semibold hover:bg-[#15407A] disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {isMutating && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {modal === "create" ? "Simpan" : "Perbarui"}
              </button>
            </div>
          }
        >
          {formError && <div className="text-[13px] text-[#E11D48] bg-red-50 border border-red-200 rounded-lg px-4 py-2">{formError}</div>}

          <div>
            <label className="block text-[13px] font-semibold text-[#0F172A] mb-2">Tim Satgas <span className="text-[#E11D48]">*</span></label>
            <SearchSelect
              options={teams.map((t) => ({ value: t.id, label: t.name }))}
              value={form.team_id}
              onChange={(v) => setForm({ ...form, team_id: v as string })}
              placeholder="Cari tim satgas..."
            />
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#0F172A] mb-2">Hari Patroli <span className="text-[#E11D48]">*</span></label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_HARI.map((h) => (
                <button
                  key={h}
                  onClick={() => toggleHari(h)}
                  className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-colors ${
                    form.hari.includes(h)
                      ? "bg-[#1e40af] text-white shadow-sm"
                      : "bg-white text-[#64748B] border border-[#D0DAE8] hover:border-[#1e40af] hover:text-[#1e40af]"
                  }`}
                >
                  {HARI_LABEL[h]}
                </button>
              ))}
            </div>
            <p className={`text-[11px] mt-1.5 ${form.hari.length > 0 && form.hari.length < 3 ? "text-[#E11D48]" : "text-[#64748B]"}`}>
              Terpilih: {form.hari.length ? form.hari.join(", ") : "—"}
              {form.hari.length > 0 && form.hari.length < 3 && " (minimal 3)"}
            </p>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#0F172A] mb-2">Kecamatan <span className="text-[#E11D48]">*</span></label>
            <SearchSelect
              options={ALL_KECAMATAN.map((k) => ({ value: k, label: k }))}
              value={form.kecamatan_list}
              onChange={(v) => setForm({ ...form, kecamatan_list: v as string[] })}
              multiple
              placeholder="Cari kecamatan..."
            />
            <p className="text-[11px] text-[#64748B] mt-1.5">Terpilih: {form.kecamatan_list.length} kecamatan</p>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#0F172A] mb-2">Frekuensi</label>
            <div className="flex gap-2">
              {FREKUENSI_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setForm({ ...form, frekuensi: opt.value })}
                  className={`flex-1 h-9 rounded-lg text-[12px] font-semibold border transition-colors ${
                    form.frekuensi === opt.value
                      ? "bg-[#1e40af] text-white border-[#1e40af]"
                      : "bg-white text-[#475569] border-[#D0DAE8] hover:border-[#1e40af]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-semibold text-[#0F172A] mb-1">Mulai <span className="text-[#E11D48]">*</span></label>
              <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="w-full h-9 px-3 border border-[#E2E8F0] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1A4F8A]/20" />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#0F172A] mb-1">Selesai</label>
              <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="w-full h-9 px-3 border border-[#E2E8F0] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1A4F8A]/20" />
              <p className="text-[10px] text-[#94A3B8] mt-0.5">Kosongi untuk tanpa batas</p>
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#0F172A] mb-1">Jenis Tugas</label>
            <select
              value={form.alasan_tugas}
              onChange={(e) => setForm({ ...form, alasan_tugas: e.target.value })}
              className="w-full h-9 px-3 border border-[#E2E8F0] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1A4F8A]/20 bg-white"
            >
              <option value="rutin">Rutin</option>
              <option value="tindak_lanjut">Tindak Lanjut</option>
              <option value="pengaduan">Pengaduan</option>
            </select>
          </div>

          {modal === "create" && form.team_id && form.hari.length > 0 && form.kecamatan_list.length > 0 && (
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-semibold text-[#475569]">Estimasi Shift</span>
                <button
                  onClick={() =>
                    fetchPreview({
                      team_id: form.team_id,
                      hari: form.hari,
                      kecamatan_list: form.kecamatan_list,
                      frekuensi: form.frekuensi,
                      start_date: form.start_date,
                      end_date: form.end_date || undefined,
                    })
                  }
                  disabled={previewLoading}
                  className="text-[11px] text-[#1e40af] font-semibold hover:underline disabled:opacity-50"
                >
                  {previewLoading ? "..." : "Hitung"}
                </button>
              </div>
              {preview && (
                <div className="text-[12px] text-[#64748B] space-y-0.5">
                  <p>Rentang: {preview.total_hari} hari</p>
                  <p>Hari patroli/minggu: {preview.hari_patroli} hari</p>
                  <p>Kecamatan/sesi: {preview.kecamatan_count} kecamatan</p>
                  <p className="text-[#0F172A] font-bold">Estimasi: ~{preview.estimated_tasks} shift</p>
                </div>
              )}
              {previewError && <p className="text-[11px] text-[#E11D48]">{previewError}</p>}
            </div>
          )}
        </ModalBase>
      ) : null}

      {modal === "generate" ? (
        <ModalBase
          onClose={() => !isMutating && setModal(null)}
          icon="refresh"
          badge="GENERATE"
          title="Generate Shift Patroli"
          footer={
            <div className="flex gap-2 w-full">
              <button onClick={() => setModal(null)} disabled={isMutating} className="flex-1 h-11 border border-[#E2E8F0] rounded-lg text-[13px] font-semibold text-[#64748B] hover:bg-[#F8FAFC] disabled:opacity-50">Batal</button>
              <button onClick={handleGenerate} disabled={isMutating} className="flex-1 h-11 bg-[#1A4F8A] text-white rounded-lg text-[14px] font-semibold hover:bg-[#15407A] disabled:opacity-50 flex items-center justify-center gap-1">
                {isMutating && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Generate
              </button>
            </div>
          }
        >
          {formError && <div className="text-[13px] text-[#E11D48] bg-red-50 border border-red-200 rounded-lg px-4 py-2">{formError}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-semibold text-[#0F172A] mb-1">Dari Tanggal</label>
              <input type="date" value={genStart} onChange={(e) => setGenStart(e.target.value)} className="w-full h-9 px-3 border border-[#E2E8F0] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1A4F8A]/20" />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#0F172A] mb-1">Sampai Tanggal</label>
              <input type="date" value={genEnd} onChange={(e) => setGenEnd(e.target.value)} className="w-full h-9 px-3 border border-[#E2E8F0] rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1A4F8A]/20" />
            </div>
          </div>
          <p className="text-[12px] text-[#64748B]">Generate shift untuk rentang tanggal di atas berdasarkan pola jadwal.</p>
        </ModalBase>
      ) : null}

      {deleteId !== null && (
        <ModalBase
          onClose={() => !isMutating && setDeleteId(null)}
          icon="delete"
          badge="KONFIRMASI"
          title="Hapus Jadwal"
          footer={
            <div className="flex gap-2 w-full">
              <button onClick={() => setDeleteId(null)} disabled={isMutating} className="flex-1 h-11 border border-[#E2E8F0] rounded-lg text-[13px] font-semibold text-[#64748B] hover:bg-[#F8FAFC] disabled:opacity-50">Batal</button>
              <button onClick={() => { deleteMut.mutate(deleteId); setDeleteId(null); }} disabled={isMutating} className="flex-1 h-11 bg-[#E11D48] text-white rounded-lg text-[14px] font-semibold hover:bg-[#C11A3E] disabled:opacity-50 flex items-center justify-center gap-1">
                {isMutating && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Hapus
              </button>
            </div>
          }
        >
          <p className="text-[13px] text-[#475569] leading-relaxed">
            Yakin ingin menghapus jadwal ini? Shift aktif yang belum memiliki laporan akan ikut dihapus.
          </p>
        </ModalBase>
      )}
      </div>
    </main>
  );
}

function ScheduleCard({
  schedule,
  onEdit,
  onDelete,
  onToggle,
  onGenerate,
}: {
  schedule: PatrolSchedule;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onGenerate: () => void;
}) {
  const freqLabel: Record<string, string> = {
    setiap_minggu: "Setiap Minggu",
    dua_mingguan: "2 Mingguan",
    bulanan: "Bulanan",
  };

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-[#EEF3FA] flex items-center justify-center shrink-0">
            <Icon name="calendar_month" className="!text-[18px] text-[#1e40af]" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[14px] font-bold text-[#0F172A] truncate">{schedule.team?.name ?? "—"}</h3>
            <span className="text-[11px] text-[#64748B]">{freqLabel[schedule.frekuensi] ?? schedule.frekuensi}</span>
          </div>
        </div>
        <button
          onClick={onToggle}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
            schedule.status === "aktif" ? "bg-[#1e40af]" : "bg-[#CBD5E1]"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform ${
              schedule.status === "aktif" ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      <div className="flex flex-wrap gap-1 mb-3">
        {ALL_HARI.map((h) => (
          <span
            key={h}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
              (schedule.hari ?? []).includes(h)
                ? "bg-[#1e40af] text-white"
                : "bg-[#F1F5F9] text-[#94A3B8]"
            }`}
          >
            {HARI_LABEL[h]}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-1 mb-3">
        {(schedule.kecamatan_list ?? []).slice(0, 5).map((k) => (
          <span key={k} className="px-2 py-0.5 bg-[#EEF3FA] rounded text-[10px] text-[#476788] font-medium">
            {k}
          </span>
        ))}
        {(schedule.kecamatan_list ?? []).length > 5 && (
          <span className="px-2 py-0.5 bg-[#F1F5F9] rounded text-[10px] text-[#94A3B8]">
            +{schedule.kecamatan_list.length - 5}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-[#64748B] mb-3">
        <span>{formatDateId(schedule.start_date)}{schedule.end_date ? ` — ${formatDateId(schedule.end_date)}` : " — ∞"}</span>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
          schedule.status === "aktif"
            ? "bg-green-50 text-[#10B981]"
            : "bg-gray-50 text-[#94A3B8]"
        }`}>
          {schedule.status === "aktif" ? "Aktif" : "Nonaktif"}
        </span>
      </div>

      <div className="flex items-center gap-1 pt-3 border-t border-[#E2E8F0]">
        <button onClick={onEdit} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-[#475569] hover:bg-[#F1F5F9] transition-colors">
          <Icon name="edit" className="!text-[14px]" /> Edit
        </button>
        <button onClick={onGenerate} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-[#1e40af] hover:bg-[#EEF3FA] transition-colors">
          <Icon name="refresh" className="!text-[14px]" /> Generate
        </button>
        <button onClick={onDelete} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-[#E11D48] hover:bg-red-50 transition-colors ml-auto">
          <Icon name="delete" className="!text-[14px]" />
        </button>
      </div>
    </div>
  );
}
