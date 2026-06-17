import { createFileRoute } from "@tanstack/react-router";
import { Icon } from "@/components/jk/Icon";
import { AdminLayout } from "@/components/jk/AdminLayout";
import { requireAdmin } from "@/lib/adminGuard";
import { getCurrentUser, getToken } from "@/lib/auth";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/hooks/useReportQueries";

export const Route = createFileRoute("/admin/dashboard")({
  component: RouteComponent,
  beforeLoad: requireAdmin,
  ssr: false,
  head: () => ({ meta: [{ title: "Dashboard Admin — DeltaJalan" }] }),
});

function RouteComponent() {
  return <AdminLayout><AdminDashboard /></AdminLayout>;
}

const BULAN_SINGKAT = ["", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const BULAN_PANJANG = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function getGreeting(client: boolean): string {
  if (!client) return "Selamat Pagi";
  const h = new Date().getHours();
  if (h < 12) return "Selamat Pagi";
  if (h < 15) return "Selamat Siang";
  if (h < 18) return "Selamat Sore";
  return "Selamat Malam";
}

function formatTanggal(client: boolean): string {
  if (!client) return "";
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const d = new Date();
  return `${days[d.getDay()]}, ${d.getDate()} ${BULAN_PANJANG[d.getMonth() + 1]} ${d.getFullYear()}`;
}

function parseBulan(bulanStr: string): { month: number; label: string } {
  const parts = bulanStr.split("-");
  const m = parseInt(parts[1], 10);
  return { month: m, label: BULAN_SINGKAT[m] ?? bulanStr };
}

function AdminDashboard() {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);
  const user = getCurrentUser();
  const token = getToken() ?? "";

  const statsQuery = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => authFetch<{
      total: number; menunggu_review: number; disetujui: number;
      ditolak: number; sedang_diperbaiki: number; selesai: number;
      rusak_berat: number; rusak_sedang: number; rusak_ringan: number;
      monthly_trend: { bulan: string; total: number; selesai: number; rusak_berat: number }[];
    }>("/api/reports/stats", token),
    refetchInterval: 60_000,
  });

  const uprQuery = useQuery({
    queryKey: ["admin-stats-upr"],
    queryFn: () => authFetch<{
      upr_id: number; upr_name: string; wilayah: string;
      total: number; sedang_diperbaiki: number; selesai: number;
    }[]>("/api/reports/stats-by-upr", token),
    refetchInterval: 120_000,
  });

  const deadlineQuery = useQuery({
    queryKey: ["admin-ringkasan-deadline"],
    queryFn: () => authFetch<{
      per_priority: Record<string, { total: number; tepat_waktu: number; mendekati: number; terlambat: number }>;
      total: { total: number; tepat_waktu: number; mendekati: number; terlambat: number };
    }>("/api/reports/ringkasan-deadline", token),
    refetchInterval: 120_000,
  });

  const stats = statsQuery.data;
  const uprList = uprQuery.data;
  const deadline = deadlineQuery.data;
  const isLoading = statsQuery.isPending || uprQuery.isPending || deadlineQuery.isPending;
  const hasError = statsQuery.isError || uprQuery.isError || deadlineQuery.isError;

  const monthlyTrend = stats?.monthly_trend ?? [];
  const maxTotal = monthlyTrend.length > 0 ? Math.max(...monthlyTrend.map((m) => m.total)) : 1;

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const bulanIni = monthlyTrend.find((m) => m.bulan === currentMonthStr);
  const selesaiBulanIni = bulanIni?.selesai ?? stats?.selesai ?? 0;
  const totalBulanIni = bulanIni?.total ?? 0;

  const complianceTotal = deadline?.total;
  const complianceRate = complianceTotal && complianceTotal.total > 0
    ? Math.round((complianceTotal.tepat_waktu / complianceTotal.total) * 100)
    : null;

  const priorityLabels: Record<string, string> = { Tinggi: "Tinggi", Sedang: "Sedang", Rendah: "Rendah" };
  const priorityBars: Record<string, string> = { Tinggi: "bg-red-500", Sedang: "bg-orange-500", Rendah: "bg-emerald-500" };

  if (isLoading) {
    return (
      <div>
        <section className="-m-4 md:-m-6 mb-6 px-4 pt-6 pb-6 bg-[#F1F5F9] rounded-b-lg border-b border-[#E2E8F0]">
          <div className="h-7 w-60 bg-gray-200 rounded animate-pulse mb-2" />
          <div className="h-5 w-48 bg-gray-200 rounded animate-pulse" />
        </section>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white border border-[#E2E8F0] rounded-xl p-4">
              <div className="h-4 w-20 bg-gray-200 rounded animate-pulse mb-3" />
              <div className="h-8 w-16 bg-gray-200 rounded animate-pulse mb-1" />
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Icon name="error" className="!text-[48px] text-[#E11D48] mb-4" />
        <h2 className="font-headline-sm text-headline-sm font-bold text-[#0F172A] mb-2">Gagal Memuat Data</h2>
        <p className="font-body-md text-body-md text-[#475569] mb-4">Tidak dapat terhubung ke server.</p>
        <button
          onClick={() => { statsQuery.refetch(); uprQuery.refetch(); deadlineQuery.refetch(); }}
          className="px-4 py-2 bg-[#1e40af] text-white rounded-lg font-label-md text-label-md"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  return (
    <div>
      <section className="-m-4 md:-m-6 mb-6 px-4 pt-6 pb-6 bg-[#F1F5F9] rounded-b-lg border-b border-[#E2E8F0]">
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-[#0F172A]">
          {getGreeting(isClient)}, {user?.name ?? "Admin"}
        </h1>
        <div className="flex items-center gap-1.5 mt-1">
          <Icon name="location_on" className="!text-[16px] text-[#475569]" />
          <p className="font-body-md text-body-md text-[#475569]">
            Admin &middot; {formatTanggal(isClient)}
          </p>
        </div>
      </section>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Laporan", value: (stats?.total ?? 0).toLocaleString(), subtitle: "Terlapor", icon: "description", color: "text-[#1e40af]" },
          { label: "Selesai", value: selesaiBulanIni.toLocaleString(), subtitle: "Bulan Ini", icon: "check_circle", color: "text-[#10B981]" },
          { label: "Menunggu Review", value: (stats?.menunggu_review ?? 0).toLocaleString(), subtitle: "Perlu Ditinjau", icon: "rate_review", color: "text-[#F97316]" },
          { label: "Kepatuhan", value: complianceRate !== null ? `${complianceRate}%` : "—", subtitle: "Tepat Waktu", icon: "verified", color: "text-[#8B5CF6]" },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-white border border-[#E2E8F0] rounded-xl p-4"
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="font-label-sm text-label-sm font-semibold uppercase tracking-wider" style={{ color: card.color.replace("text-[", "").replace("]", "") }}>
                {card.label}
              </span>
              <Icon name={card.icon} className={`${card.color} !text-[20px]`} filled />
            </div>
            <p className="font-headline-lg text-headline-lg font-bold text-[#0F172A] leading-none mb-1">
              {card.value}
            </p>
            <p className="font-label-sm text-label-sm text-[#475569]">{card.subtitle}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div
          className="lg:col-span-2 bg-white border border-[#E2E8F0] rounded-xl p-4"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
        >
          <h2 className="font-headline-sm text-headline-sm font-bold text-[#0F172A] mb-4">Tren Laporan 6 Bulan</h2>
          <div className="flex items-end gap-2" style={{ height: "180px" }}>
            {monthlyTrend.map((m) => {
              const parsed = parseBulan(m.bulan);
              const lainnya = Math.max(0, m.total - m.selesai - m.rusak_berat);
              const hSelesai = (m.selesai / maxTotal) * 100;
              const hProses = (lainnya / maxTotal) * 100;
              const hBerat = (m.rusak_berat / maxTotal) * 100;
              return (
                <div key={m.bulan} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                  <div className="w-full flex flex-col items-center justify-end rounded-t" style={{ height: `${Math.max(hSelesai + hProses + hBerat, 2)}%` }}>
                    <div className="w-full bg-[#E11D48] rounded-t" style={{ height: `${hBerat}%`, minHeight: hBerat > 0 ? 4 : 0 }} title={`Rusak Berat: ${m.rusak_berat}`} />
                    <div className="w-full bg-[#F59E0B]" style={{ height: `${hProses}%`, minHeight: hProses > 0 ? 4 : 0 }} />
                    <div className="w-full bg-[#10B981]" style={{ height: `${hSelesai}%`, minHeight: hSelesai > 0 ? 4 : 0 }} />
                  </div>
                  <span className="font-label-sm text-label-sm text-[#64748B]">{parsed.label}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#E2E8F0]">
            {[
              { color: "bg-[#10B981]", label: "Selesai" },
              { color: "bg-[#F59E0B]", label: "Dalam Proses" },
              { color: "bg-[#E11D48]", label: "Rusak Berat" },
            ].map((l) => (
              <span key={l.label} className="flex items-center gap-1.5 font-label-sm text-label-sm text-[#475569]">
                <span className={`w-2.5 h-2.5 rounded ${l.color}`} />
                {l.label}
              </span>
            ))}
          </div>
        </div>

        <div
          className="bg-white border border-[#E2E8F0] rounded-xl p-4"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
        >
          <h2 className="font-headline-sm text-headline-sm font-bold text-[#0F172A] mb-4">Ringkasan</h2>
          <div className="space-y-4">
            <div>
              <p className="font-label-sm text-label-sm text-[#64748B] mb-1">Bulan Ini</p>
              <p className="font-headline-lg text-headline-lg font-bold text-[#0F172A] leading-none mb-1">{totalBulanIni.toLocaleString()}</p>
              <p className="font-label-sm text-label-sm text-[#10B981] font-semibold">{selesaiBulanIni.toLocaleString()} selesai diperbaiki</p>
            </div>
            <div className="border-t border-[#E2E8F0] pt-4">
              <p className="font-label-sm text-label-sm text-[#64748B] mb-3">Kepatuhan Deadline per Prioritas</p>
              {["Tinggi", "Sedang", "Rendah"].map((p) => {
                const pp = deadline?.per_priority?.[p];
                const val = pp && pp.total > 0 ? Math.round((pp.tepat_waktu / pp.total) * 100) : 0;
                return (
                  <div key={p} className="mb-2.5 last:mb-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-label-sm text-label-sm text-[#475569]">{priorityLabels[p]}</span>
                      <span className="font-label-sm text-label-sm text-[#0F172A] font-semibold">{val}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${priorityBars[p]} transition-all`} style={{ width: `${val}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div
        className="bg-white border border-[#E2E8F0] rounded-xl"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
      >
        <div className="px-4 py-4 border-b border-[#E2E8F0]">
          <h2 className="font-headline-sm text-headline-sm font-bold text-[#0F172A]">Kinerja Tim UPR</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#F1F5F9] border-b border-[#E2E8F0]">
                <th className="text-left px-4 py-3 font-label-sm text-label-sm font-semibold text-[#475569] uppercase tracking-wider">Tim</th>
                <th className="text-right px-4 py-3 font-label-sm text-label-sm font-semibold text-[#475569] uppercase tracking-wider">Total</th>
                <th className="text-right px-4 py-3 font-label-sm text-label-sm font-semibold text-[#475569] uppercase tracking-wider">Diproses</th>
                <th className="text-right px-4 py-3 font-label-sm text-label-sm font-semibold text-[#475569] uppercase tracking-wider">Selesai</th>
              </tr>
            </thead>
            <tbody>
              {(uprList ?? []).length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8 font-body-md text-body-md text-[#64748B]">Belum ada data UPR</td></tr>
              ) : (uprList ?? []).map((upr) => (
                <tr key={upr.upr_id} className="border-b border-[#E2E8F0] last:border-b-0 hover:bg-[#F8FAFC] transition-colors">
                  <td className="px-4 py-3.5">
                    <span className="font-body-sm text-body-sm font-semibold text-[#0F172A]">{upr.upr_name}</span>
                  </td>
                  <td className="px-4 py-3.5 text-right font-body-sm text-body-sm text-[#0F172A] font-medium">{upr.total.toLocaleString()}</td>
                  <td className="px-4 py-3.5 text-right font-body-sm text-body-sm text-[#F97316] font-medium">{upr.sedang_diperbaiki}</td>
                  <td className="px-4 py-3.5 text-right font-body-sm text-body-sm text-[#10B981] font-medium">{upr.selesai}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
