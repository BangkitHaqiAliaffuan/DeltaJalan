import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { Icon } from "@/components/jk/Icon";
import { PageLayout } from "@/components/jk/PageLayout";
import { API_BASE_URL } from "@/lib/aiStore";
import { ReportCard } from "@/components/jk/ReportCard";
import { getCurrentUser, getToken } from "@/lib/auth";
import type { Laporan } from "@/types/laporan";

export const Route = createFileRoute("/petugas-eksekusi")({
  component: PetugasEksekusiPage,
  head: () => ({ meta: [{ title: "Tugas Saya — DeltaJalan" }] }),
});

export default PetugasEksekusiPage;


function todayFormatted(isClient: boolean): string {
  if (!isClient) return "";
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  const d = new Date();
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function PetugasEksekusiPage() {
  const user = getCurrentUser();
  const token = getToken() ?? "";
  const navigate = useNavigate();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => { setIsClient(true); }, []);

  const [laporan, setLaporan] = useState<Laporan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string>("semua");
  const [sortBy, setSortBy] = useState<string>("prioritas");

  useEffect(() => {
    if (user?.role !== "petugas_eksekusi") {
      navigate({ to: "/" });
      return;
    }
    loadReports();
  }, []);

  async function loadReports() {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const reportsRes = await fetch(`${API_BASE_URL}/reports?limit=50`, { headers });
      if (reportsRes.ok) {
        const json = await reportsRes.json();
        setLaporan(json.data ?? []);
      } else {
        setError("Gagal memuat data.");
      }
    } catch {
      setError("Terjadi kesalahan jaringan.");
    } finally {
      setLoading(false);
    }
  }

  async function handleMulai(id: string) {
    setActionLoading(id);
    try {
      const res = await fetch(`${API_BASE_URL}/reports/${id}/mulai`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        await loadReports();
      } else {
        const json = await res.json();
        alert(json.message ?? "Gagal memulai pengerjaan.");
      }
    } catch {
      alert("Terjadi kesalahan jaringan.");
    } finally {
      setActionLoading(null);
    }
  }

  const byFilter = useMemo(() => {
    return (r: Laporan) => {
      if (priorityFilter !== "semua") {
        if ((r.priority ?? "") !== priorityFilter) return false;
      }
      return true;
    };
  }, [priorityFilter]);

  const sortFn = useMemo(() => {
    return (a: Laporan, b: Laporan) => {
      if (sortBy === "prioritas") {
        const prioOrder: Record<string, number> = { Tinggi: 0, Sedang: 1, Rendah: 2 };
        const ap = prioOrder[a.priority ?? ""] ?? 3;
        const bp = prioOrder[b.priority ?? ""] ?? 3;
        if (ap !== bp) return ap - bp;
      }
      if (sortBy === "deadline") {
        const aDeadline = a.deadline_resolusi ?? a.deadline_review;
        const bDeadline = b.deadline_resolusi ?? b.deadline_review;
        if (aDeadline && bDeadline) return new Date(aDeadline).getTime() - new Date(bDeadline).getTime();
        if (aDeadline) return -1;
        if (bDeadline) return 1;
      }
      return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
    };
  }, [sortBy]);

  const { tugasDisetujui, tugasBerjalan, tugasSelesai, stats } = useMemo(() => {
    const disetujui: typeof laporan = [];
    const berjalan: typeof laporan = [];
    const selesai: typeof laporan = [];
    let berat = 0;
    const today = isClient ? new Date() : null;
    for (const r of laporan) {
      const pass = byFilter(r);
      if (r.status === "Disetujui" && pass) disetujui.push(r);
      if (r.status === "Sedang Diperbaiki" && pass) berjalan.push(r);
      if (r.status === "Selesai" && pass) selesai.push(r);

      const s = r.overall_severity ?? r.ai_severity ?? "";
      if (s.toLowerCase().includes("berat")) berat++;
    }
    const sort = (arr: typeof laporan) => arr.sort(sortFn);
    return {
      tugasDisetujui: sort(disetujui),
      tugasBerjalan: sort(berjalan),
      tugasSelesai: sort(selesai),
      stats: { total: laporan.length, berat },
    };
  }, [laporan, byFilter, sortFn, isClient]);

  const greeting = useMemo(() => {
    if (!isClient) return "Selamat Pagi";
    const h = new Date().getHours();
    if (h < 10) return "Selamat Pagi";
    if (h < 15) return "Selamat Siang";
    return "Selamat Sore";
  }, [isClient]);

  if (loading) {
    return (
      <PageLayout showBrand withBottomNav>
          <main className="pb-4" aria-busy="true" aria-label="Memuat data tugas">
            <section className="bg-gradient-to-br from-[#1e40af] to-[#2e68d8] p-6 mb-6">
              <div className="animate-pulse space-y-3">
                <div className="h-8 w-56 bg-white/20 rounded" />
                <div className="h-4 w-72 bg-white/10 rounded" />
              </div>
            </section>
            <div className="max-w-5xl mx-auto px-4">
            <section className="mb-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 aspect-square bg-[#EEF2FF] border border-[#C7D2FE] animate-pulse">
                    <div className="w-8 h-8 bg-[#C7D2FE] rounded" />
                    <div className="w-16 h-7 bg-[#C7D2FE] rounded mt-1" />
                    <div className="w-24 h-4 bg-[#C7D2FE] rounded" />
                  </div>
                ))}
              </div>
            </section>
            <section className="space-y-3 mb-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden animate-pulse">
                  <div className="flex flex-col md:flex-row">
                    <div className="w-full md:w-36 h-44 md:h-auto bg-[#E8F0FA]" />
                    <div className="flex-1 p-4 space-y-3">
                      <div className="w-28 h-4 bg-[#D0DAE8] rounded" />
                      <div className="w-3/4 h-5 bg-[#D0DAE8] rounded" />
                      <div className="flex gap-2">
                        <div className="w-20 h-5 bg-[#E8F0FA] rounded" />
                        <div className="w-24 h-5 bg-[#E8F0FA] rounded" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </section>
            </div>
          </main>
      </PageLayout>
    );
  }


  const hasAny = tugasDisetujui.length > 0 || tugasBerjalan.length > 0 || tugasSelesai.length > 0;
  const userName = user?.name ?? "Petugas";
  const uprName = user?.upr_name ?? "";

  return (
    <PageLayout showBrand withBottomNav>
        <main className="pb-4">
          <section className="bg-gradient-to-br from-[#1e40af] to-[#2e68d8] p-6 text-white mb-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-bold tracking-tight">
                  {greeting}, {userName}
                </h1>
                <p className="text-sm text-blue-200 mt-1">
                  {uprName ? `${uprName} · ` : ""}{todayFormatted(isClient)}
                </p>
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/15 text-xs font-semibold text-blue-200 uppercase tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6EE7B7]" />
                Aktif Bertugas
              </div>
            </div>
          </section>

          <div className="max-w-5xl mx-auto px-4">
          <section className="mb-6">
            <h3 className="text-[15px] font-bold text-[#0F172A] mb-3 flex items-center gap-2">
              <Icon name="bar_chart" className="!text-lg text-[#1e40af]" />
              Ringkasan Tugas Hari Ini
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { icon: "error", label: "Rusak Berat (Prioritas)", value: stats.berat, color: "text-[#DC2626]" },
                { icon: "sync", label: "Dalam Proses", value: tugasBerjalan.length, color: "text-[#D97706]" },
                { icon: "check_circle", label: "Selesai Hari Ini", value: tugasSelesai.length, color: "text-[#059669]" },
                { icon: "assignment", label: "Total Penugasan", value: stats.total, color: "text-[#1e40af]" },
              ].map((c) => (
                <div key={c.label} className="bg-gradient-to-br from-[#EEF2FF] to-white border border-[#C7D2FE] rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 aspect-square group transition-all duration-200 ease-out hover:scale-[1.03] hover:shadow-md hover:border-[#A5B4FC]">
                    <div className="flex items-center justify-center gap-1.5">
                      <Icon name={c.icon} className={`${c.color} !text-2xl group-hover:scale-110 group-hover:-translate-y-0.5 transition-transform duration-200`} />
                      <span className={`text-2xl font-bold ${c.color}`}>{c.value}</span>
                    </div>
                    <p className={`text-sm font-medium ${c.color} opacity-80`}>{c.label}</p>
                  </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-4">
              <span className="font-label-md text-label-md text-[#475569] font-semibold">
                Prioritas:
              </span>
              {(["semua", "Rendah", "Sedang", "Tinggi"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setPriorityFilter(f)}
                  className={`px-3 py-1 rounded-full text-label-sm font-semibold border transition-all ${
                    priorityFilter === f
                      ? f === "Tinggi"
                        ? "bg-red-50 text-[#E11D48] border-red-200"
                        : f === "Sedang"
                          ? "bg-amber-50 text-[#F97316] border-amber-200"
                          : f === "Rendah"
                            ? "bg-green-50 text-[#10B981] border-green-200"
                            : "bg-primary text-white border-primary"
                      : "bg-white text-[#475569] border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {f === "semua" ? "Semua" : f}
                </button>
              ))}
            </div>
          </section>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg text-sm bg-red-50 border border-red-200 text-[#E11D48]">
              {error}
            </div>
          )}

          <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-headline-sm text-headline-sm font-bold text-[#0F172A]">
                Tugas Aktif (Queue)
              </h3>
              <div className="flex items-center gap-2">
                <span className="font-label-sm text-label-sm text-[#475569]">Urutkan:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="font-label-sm text-label-sm text-[#0F172A] bg-white border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20 focus:border-[#1e40af]"
                >
                  <option value="prioritas">Prioritas Tertinggi</option>
                  <option value="deadline">Paling Mendesak</option>
                  <option value="terdekat">Terdekat</option>
                  <option value="waktu">Waktu Laporan</option>
                </select>
              </div>
            </div>

            {tugasBerjalan.length > 0 && (
              <div className="mb-6">
                <h3 className="font-label-md font-bold text-[#0F172A] mb-3 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                  Sedang Dikerjakan ({tugasBerjalan.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {tugasBerjalan.map((r) => <ReportCard key={r.id} variant="petugas" report={r} extra={{ isClient }} actions={{ onMulai: handleMulai, actionLoading }} />)}
                </div>
              </div>
            )}

            {tugasDisetujui.length > 0 && (
              <div className="mb-6">
                <h3 className="font-label-md font-bold text-[#0F172A] mb-3 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                  Siap Dikerjakan ({tugasDisetujui.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {tugasDisetujui.map((r) => <ReportCard key={r.id} variant="petugas" report={r} extra={{ isClient }} actions={{ onMulai: handleMulai, actionLoading }} />)}
                </div>
              </div>
            )}

            {!hasAny && (
              <div className="flex flex-col items-center justify-center py-16 text-center bg-white border border-[#E2E8F0] rounded-xl">
                <div className="w-12 h-12 rounded-xl bg-[#F1F5F9] border border-[#E2E8F0] flex items-center justify-center mb-4">
                  <Icon name="assignment" className="text-[#475569] !text-[22px]" />
                </div>
                <p className="font-body-md font-semibold text-[#0F172A] mb-1">Belum ada tugas</p>
                <p className="font-body-sm text-body-sm text-[#475569]">
                  Laporan yang ditugaskan supervisor akan muncul di sini.
                </p>
              </div>
            )}

            {tugasSelesai.length > 0 && (
              <div className="mb-6">
                <h3 className="font-label-md font-bold text-[#0F172A] mb-3 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                  Riwayat Selesai ({tugasSelesai.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {tugasSelesai.map((r) => <ReportCard key={r.id} variant="petugas" report={r} extra={{ isClient }} />)}
                </div>
              </div>
            )}
          </section>
          </div>
        </main>
    </PageLayout>
  );
}
