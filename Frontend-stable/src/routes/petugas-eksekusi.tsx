import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { Icon } from "@/components/jk/Icon";
import { PageLayout } from "@/components/jk/PageLayout";
import { API_BASE_URL } from "@/lib/aiStore";
import { getCurrentUser, getToken } from "@/lib/auth";
import type { Laporan } from "@/types/laporan";

export const Route = createFileRoute("/petugas-eksekusi")({
  component: PetugasEksekusiPage,
  head: () => ({ meta: [{ title: "Tugas Saya — DeltaJalan" }] }),
});

export default PetugasEksekusiPage;

function getSeverityLabel(severity?: string | null): { chip: string; label: string } {
  const s = (severity ?? "").toLowerCase();
  if (s.includes("berat"))
    return { chip: "bg-red-50 text-[#E11D48] border-red-200", label: "Rusak Berat" };
  if (s.includes("sedang"))
    return { chip: "bg-amber-50 text-[#F97316] border-amber-200", label: "Rusak Sedang" };
  if (s.includes("ringan"))
    return { chip: "bg-green-50 text-[#F59E0B] border-green-200", label: "Rusak Ringan" };
  return { chip: "bg-gray-50 text-[#475569] border-gray-200", label: severity ?? "Baik" };
}

function displayStatus(status: string): string {
  return status === "Ditinjau" ? "Menunggu Review" : status;
}

function statusBadgeStyle(status: string): string {
  const map: Record<string, string> = {
    "Menunggu Review": "bg-[#FEF3C7] text-[#F59E0B] border-[#FCD34D]",
    Ditinjau: "bg-[#FEF3C7] text-[#F59E0B] border-[#FCD34D]",
    Disetujui: "bg-[#DBEAFE] text-[#1e40af] border-[#93C5FD]",
    Ditolak: "bg-red-50 text-[#E11D48] border-red-200",
    "Sedang Diperbaiki": "bg-[#DBEAFE] text-[#1e40af] border-[#93C5FD]",
    Selesai: "bg-[#D1FAE5] text-[#10B981] border-[#6EE7B7]",
    Diedit: "bg-gray-50 text-[#475569] border-gray-200",
  };
  return map[status] ?? "bg-gray-50 text-[#475569] border-gray-200";
}

function priorityBadgeStyle(priority: string | undefined | null): string {
  const map: Record<string, string> = {
    Tinggi: "bg-red-50 text-[#E11D48] border-red-200",
    Sedang: "bg-amber-50 text-[#F97316] border-amber-200",
    Rendah: "bg-green-50 text-[#10B981] border-green-200",
  };
  return map[priority ?? ""] ?? "bg-gray-50 text-[#475569] border-gray-200";
}

function priorityIcon(priority: string | undefined | null): string {
  const map: Record<string, string> = {
    Tinggi: "priority_high",
    Sedang: "remove",
    Rendah: "arrow_downward",
  };
  return map[priority ?? ""] ?? "remove";
}

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins} menit yang lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} jam yang lalu`;
  const days = Math.floor(hrs / 24);
  return `${days} hari yang lalu`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function computeDeadline(createdAt: string | null | undefined): string {
  if (!createdAt) return "-";
  const d = new Date(createdAt);
  d.setDate(d.getDate() + 14);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

function todayFormatted(): string {
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
      const res = await fetch(`${API_BASE_URL}/reports?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
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
      return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
    };
  }, [sortBy]);

  const tugasDisetujui = useMemo(
    () => laporan.filter((r) => r.status === "Disetujui").filter(byFilter).sort(sortFn),
    [laporan, byFilter, sortFn],
  );
  const tugasBerjalan = useMemo(
    () => laporan.filter((r) => r.status === "Sedang Diperbaiki").filter(byFilter).sort(sortFn),
    [laporan, byFilter, sortFn],
  );
  const tugasSelesai = useMemo(
    () => laporan.filter((r) => r.status === "Selesai").filter(byFilter).sort(sortFn),
    [laporan, byFilter, sortFn],
  );

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 10) return "Selamat Pagi";
    if (h < 15) return "Selamat Siang";
    return "Selamat Sore";
  })();

  const stats = useMemo(() => {
    const total = laporan.length;
    const berat = laporan.filter((r) => {
      const s = r.overall_severity ?? r.ai_severity ?? "";
      return s.toLowerCase().includes("berat");
    }).length;
    const hariIni = laporan.filter((r) => {
      if (!r.created_at) return false;
      const today = new Date();
      const created = new Date(r.created_at);
      return (
        created.getDate() === today.getDate() &&
        created.getMonth() === today.getMonth() &&
        created.getFullYear() === today.getFullYear()
      );
    }).length;
    return { total, berat, hariIni };
  }, [laporan]);

  if (loading) {
    return (
      <PageLayout showBrand withBottomNav>
          <main className="flex-1 overflow-y-auto min-h-0 pb-4">
            <section className="px-4 pt-6 pb-6 bg-[#F1F5F9] rounded-b-lg border-b border-[#E2E8F0] mb-6">
              <div className="animate-pulse space-y-3">
                <div className="h-8 w-56 bg-gray-200 rounded" />
                <div className="h-4 w-72 bg-gray-200 rounded" />
              </div>
            </section>
            <section className="px-4 mb-6">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-white border border-[#E2E8F0] rounded-xl p-4 animate-pulse">
                    <div className="h-3 w-24 bg-gray-200 rounded mb-2" />
                    <div className="h-8 w-12 bg-gray-200 rounded mb-2" />
                    <div className="h-3 w-20 bg-gray-200 rounded" />
                  </div>
                ))}
              </div>
            </section>
          </main>
      </PageLayout>
    );
  }

  function renderCard(r: Laporan, variant: "siap" | "berjalan" | "selesai") {
    const sc = getSeverityLabel(r.overall_severity ?? r.ai_severity);
    const isMulti = r.batch_id && (r.photos_count ?? 0) > 0;

    return (
      <div key={r.id} className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden flex flex-col md:flex-row"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div className="md:self-stretch md:aspect-square w-full md:w-36 h-44 md:h-auto shrink-0 bg-gray-100 overflow-hidden relative">
          {r.first_photo_url ? (
            <img src={r.first_photo_url} alt={r.road_name} className="w-full h-full object-cover" />
          ) : isMulti ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <Icon name="photo_library" className="text-primary/60 !text-2xl mx-auto" />
                <span className="block text-[11px] text-primary/60 mt-1">
                  {r.photos_count} foto
                </span>
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Icon name="photo" className="text-gray-300 !text-3xl" />
            </div>
          )}
        </div>
        <div className="flex-1 p-4 min-w-0">
          <div className="flex items-center gap-1.5 mb-2">
            <Icon name="location_on" className="!text-[14px] text-[#10B981]" />
            <span className="font-label-sm text-label-sm text-[#10B981] font-semibold">
              GPS EXIF Valid
            </span>
          </div>

          <h4 className="font-body-md text-body-md font-semibold text-[#0F172A] mb-2">
            {sc.label} - {r.road_name}
          </h4>

          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-label-sm font-bold border ${sc.chip}`}>
              {sc.label}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-label-sm font-bold border ${statusBadgeStyle(r.status)}`}>
              {displayStatus(r.status)}
            </span>
            {r.priority && !["Ditolak", "Selesai"].includes(r.status) && (
              <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-label-sm font-bold border ${priorityBadgeStyle(r.priority)}`}>
                <Icon name={priorityIcon(r.priority)} className="!text-[12px]" />
                {r.priority}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-y-1.5 font-label-sm text-label-sm mb-3">
            <div className="flex items-center gap-1 text-[#475569]">
              <Icon name="map" className="!text-[14px]" />
              <span>Kec. {r.district}</span>
            </div>
            <div className="flex items-center gap-1 text-[#475569]">
              <Icon name="calendar_today" className="!text-[14px]" />
              <span>{r.created_at ? formatDateShort(r.created_at) : "-"}</span>
            </div>
            {(r.kerusakan_panjang ?? r.kerusakan_lebar) && (
              <div className="flex items-center gap-1 text-[#475569]">
                <Icon name="straighten" className="!text-[14px]" />
                <span>P: {r.kerusakan_panjang ?? 0}m{r.kerusakan_lebar ? ` | L: ${r.kerusakan_lebar}m` : ""}</span>
              </div>
            )}
          </div>

          <span className="font-id-code text-id-code text-[#475569]">
            ID: {r.report_code}
          </span>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#E2E8F0]">
            <span className="font-label-sm text-label-sm text-[#475569]">
              {variant === "berjalan"
                ? `Terakhir: ${timeAgo(r.updated_at ?? r.perbaikan_dimulai_at)}`
                : variant === "selesai"
                  ? `Selesai: ${formatDate(r.perbaikan_selesai_at)}`
                  : null}
            </span>
            <div className="flex gap-2">
              {variant === "siap" && (
                <button
                  onClick={() => handleMulai(r.id)}
                  disabled={actionLoading === r.id}
                  className="h-9 px-4 bg-primary text-white rounded-lg text-label-sm font-semibold hover:bg-[#173bab] disabled:opacity-40 transition-all flex items-center justify-center gap-1"
                >
                  {actionLoading === r.id ? (
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Icon name="play_arrow" className="!text-[16px]" />
                      Mulai
                    </>
                  )}
                </button>
              )}
              {variant === "berjalan" && (
                <Link
                  to="/complete-report"
                  search={{ reportId: r.id }}
                  className="h-9 px-4 bg-primary text-white rounded-lg text-label-sm font-semibold hover:bg-[#173bab] transition-all flex items-center justify-center gap-1"
                >
                  <Icon name="check_circle" className="!text-[16px]" />
                  Selesaikan
                </Link>
              )}
              <Link
                to="/review"
                search={{ reportId: r.id }}
                className="h-9 w-9 flex items-center justify-center rounded-lg border border-[#E2E8F0] text-[#475569] hover:bg-gray-50 transition-colors"
              >
                <Icon name="visibility" className="!text-[16px]" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const hasAny = tugasDisetujui.length > 0 || tugasBerjalan.length > 0 || tugasSelesai.length > 0;
  const userName = user?.name ?? "Petugas";
  const uprName = user?.upr_name ?? "";

  return (
    <PageLayout showBrand withBottomNav>
        <main className="flex-1 overflow-y-auto min-h-0 pb-4">
          <section className="px-4 pt-6 pb-6 bg-[#F1F5F9] rounded-b-lg border-b border-[#E2E8F0] mb-6">
            <div className="flex flex-col gap-0.5 mb-4">
              <h2 className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-[#0F172A]">
                {greeting}, {userName}
              </h2>
              <p className="font-body-sm text-body-sm text-[#475569]">
                {uprName ? `${uprName} · ` : ""}{todayFormatted()}
              </p>
              <div className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 rounded-full bg-[#D1FAE5] border border-[#6EE7B7] self-start">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                <span className="font-label-sm text-label-sm font-semibold text-[#10B981]">
                  Status: Aktif Bertugas
                </span>
              </div>
            </div>
          </section>

          <section className="px-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-headline-sm text-headline-sm font-bold text-[#0F172A]">
                Ringkasan Tugas Hari Ini
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-4"
                style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                <div className="flex items-center justify-between mb-3">
                    <span className="font-label-sm text-label-sm font-semibold text-[#E11D48] uppercase tracking-wider">
                      Rusak Berat (Prioritas)
                    </span>
                    <Icon name="error" className="!text-[18px] text-[#E11D48]" />
                </div>
                <p className="font-headline-lg text-headline-lg font-bold text-[#0F172A] leading-none mb-1">
                  {stats.berat}
                </p>
                <p className="font-label-sm text-label-sm text-[#475569]">Tugas Tertunda</p>
              </div>

              <div className="bg-white border border-[#E2E8F0] rounded-xl p-4"
                style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                <div className="flex items-center justify-between mb-3">
                    <span className="font-label-sm text-label-sm font-semibold text-[#F59E0B] uppercase tracking-wider">
                      Dalam Proses
                    </span>
                    <Icon name="sync" className="!text-[18px] text-[#F59E0B]" />
                </div>
                <p className="font-headline-lg text-headline-lg font-bold text-[#0F172A] leading-none mb-1">
                  {tugasBerjalan.length}
                </p>
                <p className="font-label-sm text-label-sm text-[#475569]">Titik Pengerjaan</p>
              </div>

              <div className="bg-white border border-[#E2E8F0] rounded-xl p-4"
                style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                <div className="flex items-center justify-between mb-3">
                    <span className="font-label-sm text-label-sm font-semibold text-[#10B981] uppercase tracking-wider">
                      Selesai Hari Ini
                    </span>
                    <Icon name="check_circle" className="!text-[18px] text-[#10B981]" />
                </div>
                <p className="font-headline-lg text-headline-lg font-bold text-[#0F172A] leading-none mb-1">
                  {tugasSelesai.length}
                </p>
                <p className="font-label-sm text-label-sm text-[#475569]">Titik Diperbaiki</p>
              </div>

              <div className="bg-white border border-[#E2E8F0] rounded-xl p-4"
                style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                <div className="flex items-center justify-between mb-3">
                    <span className="font-label-sm text-label-sm font-semibold text-[#475569] uppercase tracking-wider">
                      Total Penugasan
                    </span>
                    <Icon name="assignment" className="!text-[18px] text-[#475569]" />
                </div>
                <p className="font-headline-lg text-headline-lg font-bold text-[#0F172A] leading-none mb-1">
                  {stats.total}
                </p>
                <p className="font-label-sm text-label-sm text-[#475569]">Minggu Ini</p>
              </div>
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
            <div className="mx-4 mb-4 px-4 py-3 rounded-lg text-sm bg-red-50 border border-red-200 text-[#E11D48]">
              {error}
            </div>
          )}

          <section className="px-4 mb-8">
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
                <div className="flex flex-col gap-3">
                  {tugasBerjalan.map((r) => renderCard(r, "berjalan"))}
                </div>
              </div>
            )}

            {tugasDisetujui.length > 0 && (
              <div className="mb-6">
                <h3 className="font-label-md font-bold text-[#0F172A] mb-3 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                  Siap Dikerjakan ({tugasDisetujui.length})
                </h3>
                <div className="flex flex-col gap-3">
                  {tugasDisetujui.map((r) => renderCard(r, "siap"))}
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
                <div className="flex flex-col gap-3">
                  {tugasSelesai.map((r) => renderCard(r, "selesai"))}
                </div>
              </div>
            )}
          </section>
        </main>
    </PageLayout>
  );
}
