import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { Icon } from "@/components/jk/Icon";
import { BottomNav } from "@/components/jk/BottomNav";
import { AppLayout } from "@/components/jk/AppLayout";
import { TopBar } from "@/components/jk/TopBar";
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

function computeDeadline(createdAt: string | null | undefined): string {
  if (!createdAt) return "-";
  const d = new Date(createdAt);
  d.setDate(d.getDate() + 14);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
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

  const tugasDisetujui = useMemo(
    () => laporan.filter((r) => r.status === "Disetujui").filter(byFilter),
    [laporan, byFilter],
  );
  const tugasBerjalan = useMemo(
    () => laporan.filter((r) => r.status === "Sedang Diperbaiki").filter(byFilter),
    [laporan, byFilter],
  );
  const tugasSelesai = useMemo(
    () => laporan.filter((r) => r.status === "Selesai").filter(byFilter),
    [laporan, byFilter],
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
      <AppLayout>
        <div className="flex flex-col h-screen w-full">
          <TopBar showBrand />
          <main className="flex-1 overflow-y-auto min-h-0 pb-4">
            <section className="px-4 pt-6 pb-8 bg-[#F1F5F9] rounded-b-lg border-b border-[#E2E8F0] mb-6">
              <div className="animate-pulse space-y-4">
                <div className="h-10 w-64 bg-gray-200 rounded" />
                <div className="h-4 w-48 bg-gray-200 rounded" />
              </div>
            </section>
            <section className="px-4 mb-6">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-white border border-[#E2E8F0] p-4 rounded-lg animate-pulse">
                    <div className="h-8 w-12 bg-gray-200 rounded mb-2" />
                    <div className="h-4 w-20 bg-gray-200 rounded" />
                  </div>
                ))}
              </div>
            </section>
          </main>
          <BottomNav />
        </div>
      </AppLayout>
    );
  }

  function renderCard(r: Laporan, variant: "siap" | "berjalan" | "selesai") {
    const sc = getSeverityLabel(r.overall_severity ?? r.ai_severity);
    const isMulti = r.batch_id && (r.photos_count ?? 0) > 0;

    return (
      <div key={r.id} className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden flex">
        <div className="self-stretch aspect-square shrink-0 bg-gray-100 overflow-hidden max-w-48">
          {r.first_photo_url ? (
            <img src={r.first_photo_url} alt={r.road_name} className="w-full h-full object-cover" />
          ) : isMulti ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <Icon name="photo_library" className="text-primary/60 !text-xl mx-auto" />
                <span className="block text-[9px] text-primary/60 mt-0.5">
                  {r.photos_count} foto
                </span>
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Icon name="photo" className="text-gray-300 !text-xl" />
            </div>
          )}
        </div>
        <div className="flex-1 p-4 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="font-id-code text-id-code text-[#475569]">
              {r.report_code}
            </span>
            <div className="flex items-center gap-1.5">
              {r.priority && !["Ditolak", "Selesai"].includes(r.status) && (
                <span
                  className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-label-sm font-bold border ${priorityBadgeStyle(r.priority)}`}
                >
                  <Icon name={priorityIcon(r.priority)} className="!text-[12px]" />
                  {r.priority}
                </span>
              )}
              <span
                className={`px-2 py-0.5 rounded-lg text-label-sm font-bold border ${statusBadgeStyle(r.status)}`}
              >
                {displayStatus(r.status)}
              </span>
            </div>
          </div>
          <h4 className="font-label-md text-label-md font-bold text-[#0F172A] mb-1">{r.road_name}</h4>
          <div className="flex items-center gap-1 font-label-sm text-label-sm text-[#475569] mb-3">
            <Icon name="near_me" className="!text-[14px]" />
            <span>Kec. {r.district}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-label-sm mb-2">
            {(r.kerusakan_panjang ?? r.kerusakan_lebar) && (
              <>
                <span className="text-[#475569]">Luas Area</span>
                <span className="text-[#0F172A] font-semibold text-right">
                  {r.kerusakan_panjang ?? 0} m{r.kerusakan_lebar ? ` × ${r.kerusakan_lebar} m` : ""}
                  {r.kerusakan_lebar
                    ? ` (${((r.kerusakan_panjang ?? 0) * r.kerusakan_lebar).toFixed(1)} m²)`
                    : ""}
                </span>
              </>
            )}
            <span className="text-[#475569]">Pelapor</span>
            <span className="text-[#0F172A] font-semibold text-right">{r.reporter_name}</span>
            <span className="text-[#475569]">Keparahan</span>
            <span
              className={`text-right font-semibold ${sc.chip.split(" ")[0]} ${sc.chip.split(" ")[1]}`}
            >
              {sc.label}
            </span>
            <span className="text-[#475569]">Deadline</span>
            <span className="text-[#0F172A] font-semibold text-right">
              {computeDeadline(r.created_at)}
            </span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="font-label-sm text-label-sm text-[#475569]">
              {variant === "berjalan"
                ? `Terakhir diperbarui: ${timeAgo(r.updated_at ?? r.perbaikan_dimulai_at)}`
                : variant === "selesai"
                  ? `Selesai diperbaiki pada ${formatDate(r.perbaikan_selesai_at)}`
                  : null}
            </span>
          </div>
          <div className="flex gap-2">
            {variant === "siap" && (
              <button
                onClick={() => handleMulai(r.id)}
                disabled={actionLoading === r.id}
                className="flex-1 h-11 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-[#173bab] disabled:opacity-40 transition-all flex items-center justify-center gap-1.5"
              >
                {actionLoading === r.id ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Memulai...
                  </>
                ) : (
                  <>
                    <Icon name="play_arrow" className="!text-lg" />
                    Mulai Pengerjaan
                  </>
                )}
              </button>
            )}
            {variant === "berjalan" && (
              <Link
                to="/complete-report"
                search={{ reportId: r.id }}
                className="flex-1 h-11 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-[#173bab] transition-all flex items-center justify-center gap-1.5"
              >
                <Icon name="check_circle" className="!text-lg" />
                Selesaikan
              </Link>
            )}
            <Link
              to="/review"
              search={{ reportId: r.id }}
              className={`h-11 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5 border-2 border-[#E2E8F0] text-[#475569] hover:bg-gray-50 ${variant === "selesai" ? "flex-1" : "w-11"}`}
            >
              <Icon name="visibility" className="!text-lg" />
              {variant === "selesai" ? "Lihat Detail" : null}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const hasAny = tugasDisetujui.length > 0 || tugasBerjalan.length > 0 || tugasSelesai.length > 0;

  return (
    <AppLayout>
      <div className="flex flex-col h-screen w-full">
        <TopBar showBrand />
        <main className="flex-1 overflow-y-auto min-h-0 pb-4">
          <section className="px-4 pt-6 pb-8 bg-[#F1F5F9] rounded-b-lg border-b border-[#E2E8F0] mb-6">
            <div className="flex flex-col gap-1">
              <h2 className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-primary">
                {greeting}, {user?.name ?? "Petugas"}
              </h2>
              <div className="flex items-center gap-1 text-[#475569]">
                <Icon name="assignment" className="!text-[16px]" />
                <p className="font-body-md text-body-md">
                  Petugas Eksekusi
                  {user?.upr_name ? ` · ${user.upr_name}` : ""}
                </p>
              </div>
            </div>
          </section>

          <section className="px-4 mb-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="bg-white border border-[#E2E8F0] p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <Icon name="assignment" className="text-primary" />
                </div>
                <p className="font-headline-md text-headline-md font-bold text-primary mb-1">
                  {stats.total}
                </p>
                <p className="font-label-md text-label-md text-[#475569]">Total Laporan</p>
                {stats.hariIni > 0 && (
                  <p className="font-label-sm text-label-sm text-[#10B981] mt-1">
                    +{stats.hariIni} hari ini
                  </p>
                )}
              </div>
              <div className="bg-white border border-[#E2E8F0] p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <Icon name="report_problem" className="text-[#E11D48]" />
                </div>
                <p className="font-headline-md text-headline-md font-bold text-[#E11D48] mb-1">
                  {stats.berat}
                </p>
                <p className="font-label-md text-label-md text-[#475569]">Rusak Berat</p>
              </div>
              <div className="bg-white border border-[#E2E8F0] p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <Icon name="sync" className="text-[#F59E0B]" />
                </div>
                <p className="font-headline-md text-headline-md font-bold text-[#F59E0B] mb-1">
                  {tugasBerjalan.length}
                </p>
                <p className="font-label-md text-label-md text-[#475569]">Diproses</p>
              </div>
              <div className="bg-white border border-[#E2E8F0] p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <Icon name="check_circle" className="text-[#10B981]" />
                </div>
                <p className="font-headline-md text-headline-md font-bold text-[#10B981] mb-1">
                  {tugasSelesai.length}
                </p>
                <p className="font-label-md text-label-md text-[#475569]">Selesai</p>
              </div>
            </div>

            {/* Filter prioritas */}
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
              <div className="flex flex-col items-center justify-center py-16 text-[#475569]">
                <Icon name="assignment" className="!text-5xl mx-auto mb-3 opacity-40" />
                <p className="font-body-md">Belum ada tugas untuk UPR Anda.</p>
                <p className="font-label-sm mt-1">Laporan yang ditugaskan supervisor akan muncul di sini.</p>
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
        <BottomNav />
      </div>
    </AppLayout>
  );
}
