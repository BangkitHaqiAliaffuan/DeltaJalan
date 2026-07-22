import { createFileRoute } from "@tanstack/react-router";
import { Icon } from "@/components/jk/Icon";
import { AdminLayout } from "@/components/jk/AdminLayout";
import { requireAdmin } from "@/lib/adminGuard";
import { getCurrentUser, getToken } from "@/lib/auth";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/hooks/useReportQueries";
import "./admin.css";

export const Route = createFileRoute("/admin/dashboard")({
  component: RouteComponent,
  beforeLoad: requireAdmin,
  ssr: false,
  head: () => ({ meta: [{ title: "Dashboard Admin — DeltaJalan" }] }),
});

function RouteComponent() {
  return (
    <AdminLayout>
      <AdminDashboard />
    </AdminLayout>
  );
}

const BULAN_SINGKAT = [
  "",
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];
const BULAN_PANJANG = [
  "",
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

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
  useEffect(() => {
    setIsClient(true);
  }, []);
  const user = getCurrentUser();
  const token = getToken() ?? "";

  const statsQuery = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () =>
      authFetch<{
        total: number;
        menunggu_review: number;
        disetujui: number;
        ditolak: number;
        sedang_diperbaiki: number;
        selesai: number;
        rusak_berat: number;
        rusak_sedang: number;
        rusak_ringan: number;
        monthly_trend: { bulan: string; total: number; selesai: number; rusak_berat: number }[];
      }>("/api/reports/stats", token),
    refetchInterval: 60_000,
  });

  const uptdQuery = useQuery({
    queryKey: ["admin-stats-uptd"],
    queryFn: () =>
      authFetch<
        {
          team_id: string;
          team_name: string;
          wilayah: string;
          total: number;
          sedang_diperbaiki: number;
          selesai: number;
        }[]
      >("/api/reports/stats-by-team", token),
    refetchInterval: 120_000,
  });

  const stats = statsQuery.data;
  const uptdList = uptdQuery.data;
  const isLoading = statsQuery.isPending || uptdQuery.isPending;
  const hasError = statsQuery.isError || uptdQuery.isError;

  const monthlyTrend = stats?.monthly_trend ?? [];
  const maxTotal = monthlyTrend.length > 0 ? Math.max(...monthlyTrend.map((m) => m.total)) : 1;

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const bulanIni = monthlyTrend.find((m) => m.bulan === currentMonthStr);
  const selesaiBulanIni = bulanIni?.selesai ?? stats?.selesai ?? 0;
  const totalBulanIni = bulanIni?.total ?? 0;

  if (isLoading) {
    return (
      <div>
        <section className="bg-gradient-to-br from-[#1e40af] to-[#2e68d8] px-4 md:px-6 py-6 -m-4 md:-m-6 mb-6">
          <div className="h-7 w-60 bg-white/20 rounded animate-pulse mb-2" />
          <div className="h-5 w-48 bg-white/20 rounded animate-pulse" />
        </section>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4 mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <div
              key={i}
              className="bg-gradient-to-br from-[#EEF2FF] to-white border border-[#C7D2FE] rounded-xl p-4 aspect-square flex flex-col items-center justify-center"
            >
              <div className="w-6 h-6 bg-[#C7D2FE] rounded animate-pulse mb-2" />
              <div className="h-7 w-16 bg-[#C7D2FE] rounded animate-pulse mb-1" />
              <div className="h-4 w-20 bg-[#C7D2FE] rounded animate-pulse" />
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
        <h2 className="font-headline-sm text-headline-sm font-bold text-[#0F172A] mb-2">
          Gagal Memuat Data
        </h2>
        <p className="font-body-md text-body-md text-[#475569] mb-4">
          Tidak dapat terhubung ke server.
        </p>
        <button
          onClick={() => {
            statsQuery.refetch();
            uptdQuery.refetch();
          }}
          className="px-4 py-2 bg-[#1e40af] text-white rounded-lg font-label-md text-label-md"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  return (
    <div>
      <section className="bg-gradient-to-br from-[#1e40af] to-[#2e68d8] px-4 md:px-6 py-6 text-white -m-4 md:-m-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              {getGreeting(isClient)}, {user?.name ?? "Admin"}
            </h1>
            <p className="text-sm text-blue-200 mt-1">
              Ringkasan data laporan kerusakan jalan Kab. Sidoarjo
            </p>
            <p className="text-xs text-blue-300 mt-0.5">{formatTanggal(isClient)}</p>
          </div>
          <span className="px-2.5 py-1 bg-white/15 text-xs font-semibold text-blue-200 uppercase tracking-wide">
            Admin
          </span>
        </div>
      </section>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        {[
          { label: "Total Laporan", value: stats?.total ?? 0, icon: "description", color: "text-[#1e40af]" },
          { label: "Selesai", value: selesaiBulanIni, icon: "check_circle", color: "text-[#059669]" },
          { label: "Menunggu Review", value: stats?.menunggu_review ?? 0, icon: "rate_review", color: "text-[#D97706]" },
          { label: "Disetujui", value: stats?.disetujui ?? 0, icon: "thumb_up", color: "text-[#2563EB]" },
          { label: "Sedang Diperbaiki", value: stats?.sedang_diperbaiki ?? 0, icon: "build", color: "text-[#F97316]" },
          { label: "Ditolak", value: stats?.ditolak ?? 0, icon: "block", color: "text-[#E11D48]" },
          { label: "Rusak Berat", value: stats?.rusak_berat ?? 0, icon: "report", color: "text-[#E11D48]" },
          { label: "Rusak Sedang", value: stats?.rusak_sedang ?? 0, icon: "warning_amber", color: "text-[#F97316]" },
          { label: "Rusak Ringan", value: stats?.rusak_ringan ?? 0, icon: "info", color: "text-[#F59E0B]" },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-gradient-to-br from-[#EEF2FF] to-white border border-[#C7D2FE] rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 aspect-square group transition-all duration-200 ease-out hover:scale-[1.03] hover:shadow-md hover:border-[#A5B4FC]"
          >
            <div className="flex items-center justify-center gap-1.5">
              <Icon
                name={card.icon}
                className={`${card.color} !text-2xl group-hover:scale-110 group-hover:-translate-y-0.5 transition-transform duration-200`}
              />
              <span className={`text-2xl font-bold ${card.color}`}>
                {card.value != null ? card.value.toLocaleString() : "—"}
              </span>
            </div>
            <p className={`text-sm font-medium ${card.color} opacity-80`}>{card.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div
          className="lg:col-span-2 bg-white border border-[#E2E8F0] rounded-xl p-4"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
        >
          <h2 className="font-headline-sm text-headline-sm font-bold text-[#0F172A] mb-4">
            Tren Laporan 6 Bulan
          </h2>
          <div className="flex items-end gap-2" style={{ height: "180px" }}>
            {monthlyTrend.map((m) => {
              const parsed = parseBulan(m.bulan);
              const lainnya = Math.max(0, m.total - m.selesai - m.rusak_berat);
              const hSelesai = (m.selesai / maxTotal) * 100;
              const hProses = (lainnya / maxTotal) * 100;
              const hBerat = (m.rusak_berat / maxTotal) * 100;
              return (
                <div
                  key={m.bulan}
                  className="flex-1 flex flex-col items-center gap-1 h-full justify-end"
                >
                  <div
                    className="w-full flex flex-col items-center justify-end rounded-t"
                    style={{ height: `${Math.max(hSelesai + hProses + hBerat, 2)}%` }}
                  >
                    <div
                      className="w-full bg-[#E11D48] rounded-t"
                      style={{ height: `${hBerat}%`, minHeight: hBerat > 0 ? 4 : 0 }}
                      title={`Rusak Berat: ${m.rusak_berat}`}
                    />
                    <div
                      className="w-full bg-[#F59E0B]"
                      style={{ height: `${hProses}%`, minHeight: hProses > 0 ? 4 : 0 }}
                    />
                    <div
                      className="w-full bg-[#10B981]"
                      style={{ height: `${hSelesai}%`, minHeight: hSelesai > 0 ? 4 : 0 }}
                    />
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
              <span
                key={l.label}
                className="flex items-center gap-1.5 font-label-sm text-label-sm text-[#475569]"
              >
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
          <h2 className="font-headline-sm text-headline-sm font-bold text-[#0F172A] mb-4">
            Ringkasan
          </h2>
          <div className="space-y-4">
            <div>
              <p className="font-label-sm text-label-sm text-[#64748B] mb-1">Bulan Ini</p>
              <p className="font-headline-lg text-headline-lg font-bold text-[#0F172A] leading-none mb-1">
                {totalBulanIni.toLocaleString()}
              </p>
              <p className="font-label-sm text-label-sm text-[#10B981] font-semibold">
                {selesaiBulanIni.toLocaleString()} selesai diperbaiki
              </p>
            </div>
          </div>
        </div>
      </div>

      <div
        className="bg-white border border-[#E2E8F0] rounded-xl"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
      >
        <div className="px-4 py-4 border-b border-[#E2E8F0]">
          <h2 className="font-headline-sm text-headline-sm font-bold text-[#0F172A]">
            Kinerja Tim Satgas
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#F1F5F9] border-b border-[#E2E8F0]">
                <th className="text-left px-4 py-3 font-label-sm text-label-sm font-semibold text-[#475569] uppercase tracking-wider">
                  Tim
                </th>
                <th className="text-right px-4 py-3 font-label-sm text-label-sm font-semibold text-[#475569] uppercase tracking-wider">
                  Total
                </th>
                <th className="text-right px-4 py-3 font-label-sm text-label-sm font-semibold text-[#475569] uppercase tracking-wider">
                  Diproses
                </th>
                <th className="text-right px-4 py-3 font-label-sm text-label-sm font-semibold text-[#475569] uppercase tracking-wider">
                  Selesai
                </th>
              </tr>
            </thead>
            <tbody>
              {(uptdList ?? []).length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="text-center py-8 font-body-md text-body-md text-[#64748B]"
                  >
                    Belum ada data Tim Satgas
                  </td>
                </tr>
              ) : (
                (uptdList ?? []).map((item) => (
                  <tr
                    key={item.team_id}
                    className="border-b border-[#E2E8F0] last:border-b-0 hover:bg-[#F8FAFC] transition-colors"
                  >
                    <td className="px-4 py-3.5">
                      <span className="font-body-sm text-body-sm font-semibold text-[#0F172A]">
                        {item.team_name}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-body-sm text-body-sm text-[#0F172A] font-medium">
                      {item.total.toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 text-right font-body-sm text-body-sm text-[#F97316] font-medium">
                      {item.sedang_diperbaiki}
                    </td>
                    <td className="px-4 py-3.5 text-right font-body-sm text-body-sm text-[#10B981] font-medium">
                      {item.selesai}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
