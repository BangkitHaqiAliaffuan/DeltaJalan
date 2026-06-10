import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Icon } from "@/components/jk/Icon";
import { PageLayout } from "@/components/jk/PageLayout";
import { API_BASE_URL } from "@/lib/aiStore";
import { getCurrentUser, getToken } from "@/lib/auth";
import {
  getMockStats,
  getMockMonthlyTrend,
  getMockUprStats,
  type DistrictStat,
  type MonthlyTrend,
} from "@/lib/mockData";

const MONTH_LABELS: Record<string, string> = {
  "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr",
  "05": "Mei", "06": "Jun", "07": "Jul", "08": "Agu",
  "09": "Sep", "10": "Okt", "11": "Nov", "12": "Des",
};

import { DistrictPieChart } from "@/components/charts/DistrictPieChart";
import { MonthlyTrendChart } from "@/components/charts/MonthlyTrendChart";

function parseMonthlyTrend(data: { bulan: string; total: number; selesai: number; rusak_berat: number }[]): MonthlyTrend[] {
  return data.map((d) => {
    const parts = d.bulan.split("-");
    return {
      month: d.bulan,
      label: `${MONTH_LABELS[parts[1]!] ?? parts[1]} ${parts[0]}`,
      total: d.total,
      selesai: d.selesai,
      rusak_berat: d.rusak_berat,
    };
  });
}

export const Route = createFileRoute("/stats")({
  component: StatsPage,
  head: () => ({ meta: [{ title: "Statistik — DeltaJalan" }] }),
});

interface StatsData {
  total: number;
  menunggu_review: number;
  disetujui: number;
  ditolak: number;
  sedang_diperbaiki: number;
  selesai: number;
  trust_hijau: number;
  trust_kuning: number;
  trust_merah: number;
  rusak_berat?: number;
  rusak_sedang?: number;
  rusak_ringan?: number;
  monthly_trend?: { bulan: string; total: number; selesai: number; rusak_berat: number }[];
}

interface UprStat {
  upr_id: number;
  upr_name: string;
  wilayah: string;
  total: number;
  sedang_diperbaiki: number;
  selesai: number;
  total_panjang_m: number;
  total_luas_m2: number;
}

function pct(value: number, total: number): string {
  if (!total) return "0%";
  return Math.round((value / total) * 100) + "%";
}

function StatsPage() {
  const user = getCurrentUser();
  const token = getToken() ?? "";
  const [stats, setStats] = useState<StatsData | null>(null);
  const [districtStats, setDistrictStats] = useState<DistrictStat[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);
  const [uprStats, setUprStats] = useState<UprStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || (user.role !== "supervisor" && user.role !== "petugas_eksekusi")) {
      return;
    }
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [statsRes, uprRes, mapRes] = await Promise.all([
        fetch(`${API_BASE_URL}/reports/stats`, { headers }),
        fetch(`${API_BASE_URL}/reports/stats-by-upr`, { headers }),
        fetch(`${API_BASE_URL}/reports/map-data`, { headers }),
      ]);

      let s: StatsData | null = null;
      let u: UprStat[] = [];
      let d: DistrictStat[] = [];

      if (statsRes.ok) {
        const sj = await statsRes.json();
        if (sj.data) s = sj.data;
      }
      if (uprRes.ok) {
        const uj = await uprRes.json();
        if (uj.data) u = uj.data;
      }
      if (mapRes.ok) {
        const mj = await mapRes.json();
        if (mj.data?.districts) {
          d = Object.values(mj.data.districts) as DistrictStat[];
        }
      }

      if (!s || s.total === 0) {
        const mock = getMockStats();
        s = {
          total: mock.total,
          menunggu_review: mock.menunggu_review,
          disetujui: mock.disetujui,
          ditolak: mock.ditolak,
          sedang_diperbaiki: mock.sedang_diperbaiki,
          selesai: mock.selesai,
          trust_hijau: mock.trust_hijau,
          trust_kuning: mock.trust_kuning,
          trust_merah: mock.trust_merah,
          rusak_berat: mock.rusak_berat,
          rusak_sedang: mock.rusak_sedang,
          rusak_ringan: mock.rusak_ringan,
          monthly_trend: mock.monthly_trend,
        };
        d = mock.districts;
      }
      if (u.length === 0) u = getMockUprStats();
      if (d.length === 0) d = getMockStats().districts;

      setStats(s);
      setDistrictStats(d);
      setMonthlyTrend(s?.monthly_trend ? parseMonthlyTrend(s.monthly_trend) : getMockMonthlyTrend());
      setUprStats(u);
    } catch {
      const mock = getMockStats();
      setStats({
        total: mock.total,
        menunggu_review: mock.menunggu_review,
        disetujui: mock.disetujui,
        ditolak: mock.ditolak,
        sedang_diperbaiki: mock.sedang_diperbaiki,
        selesai: mock.selesai,
        trust_hijau: mock.trust_hijau,
        trust_kuning: mock.trust_kuning,
        trust_merah: mock.trust_merah,
        rusak_berat: mock.rusak_berat,
        rusak_sedang: mock.rusak_sedang,
        rusak_ringan: mock.rusak_ringan,
      });
      setDistrictStats(mock.districts);
      setMonthlyTrend(mock.monthly_trend ? parseMonthlyTrend(mock.monthly_trend as any) : getMockMonthlyTrend());
      setUprStats(getMockUprStats());
      setError("Gagal memuat data dari server — menampilkan data contoh.");
    } finally {
      setLoading(false);
    }
  }

  const totalLuas = uprStats.reduce((sum, u) => sum + u.total_luas_m2, 0);
  const totalPanjang = uprStats.reduce((sum, u) => sum + u.total_panjang_m, 0);
  const completionRate = stats && stats.total > 0 ? Math.round((stats.selesai / stats.total) * 100) : 0;

  return (
    <PageLayout showBrand withBottomNav>
      <main className="pb-4 w-full">
        <div className="max-w-5xl mx-auto px-4 pt-6 pb-4 flex flex-col gap-6">
          {/* ── Header ─────────────────────────────────────────────── */}
          <section className="bg-gradient-to-br from-[#1e40af] to-[#2e68d8] rounded-2xl p-6 text-white">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-bold tracking-tight">Statistik Laporan</h1>
                <p className="text-sm text-blue-200 mt-1">
                  Ringkasan data laporan kerusakan jalan Kab. Sidoarjo
                </p>
              </div>
              <div className="hidden sm:flex items-center gap-2 bg-white/15 rounded-lg px-4 py-2">
                <Icon name="fact_check" className="!text-lg text-blue-200" />
                <span className="text-sm font-semibold">
                  {stats ? `${stats.total} laporan` : "-"}
                </span>
              </div>
            </div>
            {stats && (
              <div className="flex items-center gap-6 mt-4 pt-4 border-t border-white/20">
                <div>
                  <p className="text-3xl font-bold">{stats.total}</p>
                  <p className="text-xs text-blue-200 mt-0.5">Total Laporan</p>
                </div>
                <div>
                  <p className="text-3xl font-bold">{completionRate}%</p>
                  <p className="text-xs text-blue-200 mt-0.5">Tingkat Penyelesaian</p>
                </div>
                <div>
                  <p className="text-3xl font-bold">{uprStats.length}</p>
                  <p className="text-xs text-blue-200 mt-0.5">Tim Satgas</p>
                </div>
              </div>
            )}
          </section>

          {error && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5 text-sm text-amber-800 flex items-center gap-2.5">
              <Icon name="info" className="!text-lg text-amber-600 shrink-0" />
              {error}
            </div>
          )}

          {/* ── Content ────────────────────────────────────────────── */}
          {loading ? (
            <div className="space-y-6" aria-busy="true" aria-label="Memuat statistik">
              {/* Status cards skeleton */}
              <section>
                <div className="w-32 h-4 bg-[#D0DAE8] rounded animate-pulse mb-3" />
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="bg-white border border-[#E2E8F0] rounded-xl p-4 animate-pulse">
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-6 h-6 bg-[#D0DAE8] rounded" />
                        <div className="w-10 h-5 bg-[#D0DAE8] rounded" />
                      </div>
                      <div className="w-20 h-3 bg-[#E8F0FA] rounded" />
                    </div>
                  ))}
                </div>
              </section>
              {/* 2-column skeleton: severity + trust */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <section>
                  <div className="w-44 h-4 bg-[#D0DAE8] rounded animate-pulse mb-3" />
                  <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-4 animate-pulse">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="w-24 h-3.5 bg-[#D0DAE8] rounded" />
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-3.5 bg-[#D0DAE8] rounded" />
                            <div className="w-10 h-3 bg-[#E8F0FA] rounded" />
                          </div>
                        </div>
                        <div className="w-full h-2.5 bg-[#E8F0FA] rounded-full" />
                      </div>
                    ))}
                  </div>
                </section>
                <section>
                  <div className="w-36 h-4 bg-[#D0DAE8] rounded animate-pulse mb-3" />
                  <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-4 animate-pulse">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="w-20 h-3.5 bg-[#D0DAE8] rounded" />
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-3.5 bg-[#D0DAE8] rounded" />
                            <div className="w-10 h-3 bg-[#E8F0FA] rounded" />
                          </div>
                        </div>
                        <div className="w-full h-2.5 bg-[#E8F0FA] rounded-full" />
                      </div>
                    ))}
                    <div className="pt-3 border-t border-[#E2E8F0]">
                      <div className="w-40 h-3 bg-[#E8F0FA] rounded" />
                    </div>
                  </div>
                </section>
              </div>
              {/* Monthly chart skeleton */}
              <section>
                <div className="w-36 h-4 bg-[#D0DAE8] rounded animate-pulse mb-3" />
                <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 animate-pulse">
                  <div className="flex items-end gap-2 h-28">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className="flex-1 bg-[#E8F0FA] rounded-t"
                        style={{ height: `${(i % 3 + 1) * 20 + 20}px` }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2 mt-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="flex-1 h-2.5 bg-[#E8F0FA] rounded" />
                    ))}
                  </div>
                </div>
              </section>
              {/* UPR stats skeleton */}
              <section>
                <div className="w-28 h-4 bg-[#D0DAE8] rounded animate-pulse mb-3" />
                <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden animate-pulse">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 border-b border-[#E2E8F0] last:border-b-0">
                      <div className="w-1/3 h-3.5 bg-[#D0DAE8] rounded" />
                      <div className="w-1/6 h-3 bg-[#E8F0FA] rounded" />
                      <div className="w-1/6 h-3 bg-[#E8F0FA] rounded" />
                      <div className="w-1/6 h-3 bg-[#E8F0FA] rounded" />
                      <div className="flex-1 h-2 bg-[#E8F0FA] rounded" />
                    </div>
                  ))}
                </div>
              </section>
            </div>
          ) : stats ? (
            <>
              {/* Status Cards */}
              <section>
                <h2 className="text-[15px] font-bold text-[#0F172A] mb-3 flex items-center gap-2">
                  <Icon name="bar_chart" className="!text-lg text-[#1e40af]" />
                  Status Laporan
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {[
                    { icon: "assignment", label: "Total", value: stats.total, color: "text-[#1e40af]", bg: "bg-[#EEF2FF]", border: "border-[#C7D2FE]" },
                    { icon: "rate_review", label: "Menunggu Review", value: stats.menunggu_review, color: "text-[#D97706]", bg: "bg-[#FFFBEB]", border: "border-[#FDE68A]" },
                    { icon: "thumb_up", label: "Disetujui", value: stats.disetujui, color: "text-[#1e40af]", bg: "bg-[#EEF2FF]", border: "border-[#C7D2FE]" },
                    { icon: "build", label: "Diperbaiki", value: stats.sedang_diperbaiki, color: "text-[#D97706]", bg: "bg-[#FFFBEB]", border: "border-[#FDE68A]" },
                    { icon: "check_circle", label: "Selesai", value: stats.selesai, color: "text-[#059669]", bg: "bg-[#ECFDF5]", border: "border-[#A7F3D0]" },
                    { icon: "block", label: "Ditolak", value: stats.ditolak, color: "text-[#DC2626]", bg: "bg-[#FEF2F2]", border: "border-[#FECACA]" },
                  ].map((c) => (
                    <div
                      key={c.label}
                      className={`${c.bg} border ${c.border} rounded-xl p-4 flex flex-col`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Icon name={c.icon} className={`${c.color} !text-xl`} />
                        <span className={`text-lg font-bold ${c.color}`}>{c.value}</span>
                      </div>
                      <p className={`text-[11px] font-medium ${c.color} opacity-80`}>{c.label}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Severity + Trust Score 2 kolom */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Severity Distribution */}
                <section>
                  <h2 className="text-[15px] font-bold text-[#0F172A] mb-3 flex items-center gap-2">
                    <Icon name="warning" className="!text-lg text-[#1e40af]" />
                    Sebaran Tingkat Kerusakan
                  </h2>
                  <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
                    <div className="flex flex-col gap-4">
                      {[
                        { label: "Rusak Berat", value: stats.rusak_berat ?? 0, bar: "bg-[#E11D48]", text: "text-[#E11D48]", light: "bg-red-50" },
                        { label: "Rusak Sedang", value: stats.rusak_sedang ?? 0, bar: "bg-[#F97316]", text: "text-[#F97316]", light: "bg-orange-50" },
                        { label: "Rusak Ringan", value: stats.rusak_ringan ?? 0, bar: "bg-[#F59E0B]", text: "text-[#F59E0B]", light: "bg-amber-50" },
                      ].map((s) => {
                        const max = Math.max(stats.rusak_berat ?? 0, stats.rusak_sedang ?? 0, stats.rusak_ringan ?? 0, 1);
                        return (
                          <div key={s.label}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-sm font-medium text-[#0F172A]">{s.label}</span>
                              <div className="flex items-center gap-3">
                                <span className={`text-sm font-bold ${s.text}`}>{s.value}</span>
                                <span className="text-[11px] text-[#475569] w-10 text-right">
                                  {pct(s.value, (stats.rusak_berat ?? 0) + (stats.rusak_sedang ?? 0) + (stats.rusak_ringan ?? 0))}
                                </span>
                              </div>
                            </div>
                            <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${s.bar} transition-all duration-500`}
                                style={{ width: `${Math.round((s.value / max) * 100)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>

                {/* Trust Score */}
                <section>
                  <h2 className="text-[15px] font-bold text-[#0F172A] mb-3 flex items-center gap-2">
                    <Icon name="verified" className="!text-lg text-[#1e40af]" />
                    Distribusi Trust Score
                  </h2>
                  <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
                    <div className="flex flex-col gap-4">
                      {[
                        { label: "Kredibel", value: stats.trust_hijau, bar: "bg-[#10B981]", text: "text-[#10B981]" },
                        { label: "Perlu Review", value: stats.trust_kuning, bar: "bg-[#F59E0B]", text: "text-[#F59E0B]" },
                        { label: "Diragukan", value: stats.trust_merah, bar: "bg-[#E11D48]", text: "text-[#E11D48]" },
                      ].map((t) => {
                        const totalTrust = stats.trust_hijau + stats.trust_kuning + stats.trust_merah;
                        const p = totalTrust > 0 ? Math.round((t.value / totalTrust) * 100) : 0;
                        return (
                          <div key={t.label}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-sm font-medium text-[#0F172A]">{t.label}</span>
                              <div className="flex items-center gap-3">
                                <span className={`text-sm font-bold ${t.text}`}>{t.value}</span>
                                <span className="text-[11px] text-[#475569] w-10 text-right">{p}%</span>
                              </div>
                            </div>
                            <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${t.bar} transition-all duration-500`}
                                style={{ width: `${p}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 pt-3 border-t border-[#E2E8F0] flex items-center justify-between text-xs text-[#475569]">
                      <span>Skor kepercayaan sistem berdasarkan validasi data</span>
                      <span className="font-semibold text-[#0F172A]">
                        Rata-rata:{" "}
                        {(() => {
                          const totalTrust = stats.trust_hijau + stats.trust_kuning + stats.trust_merah;
                          if (totalTrust === 0) return "-";
                          const score = Math.round(
                            (stats.trust_hijau * 100 + stats.trust_kuning * 60 + stats.trust_merah * 20) / totalTrust
                          );
                          return score + "%";
                        })()}
                      </span>
                    </div>
                  </div>
                </section>
              </div>

              {/* Charts 2 kolom */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                {/* Pie Chart Kecamatan */}
                <section className="lg:col-span-2">
                  <h2 className="text-[15px] font-bold text-[#0F172A] mb-3 flex items-center gap-2">
                    <Icon name="map" className="!text-lg text-[#1e40af]" />
                    Per Kecamatan
                  </h2>
                  <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
                    <DistrictPieChart data={districtStats} />
                  </div>
                </section>

                {/* Trend Chart */}
                <section className="lg:col-span-3">
                  <h2 className="text-[15px] font-bold text-[#0F172A] mb-3 flex items-center gap-2">
                    <Icon name="trending_up" className="!text-lg text-[#1e40af]" />
                    Tren 6 Bulan
                  </h2>
                  <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
                    <MonthlyTrendChart data={monthlyTrend} />
                  </div>
                </section>
              </div>

              {/* Dimensi Kerusakan */}
              {(totalPanjang > 0 || totalLuas > 0) && (
                <section>
                  <h2 className="text-[15px] font-bold text-[#0F172A] mb-3 flex items-center gap-2">
                    <Icon name="straighten" className="!text-lg text-[#1e40af]" />
                    Dimensi Kerusakan
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gradient-to-br from-[#EEF2FF] to-white border border-[#C7D2FE] rounded-xl p-5">
                      <div className="flex items-center gap-2 text-[#1e40af] mb-2">
                        <Icon name="straighten" className="!text-xl" />
                      </div>
                      <p className="text-2xl font-bold text-[#1e40af]">
                        {totalPanjang.toLocaleString("id-ID")} <span className="text-sm font-medium">m</span>
                      </p>
                      <p className="text-xs text-[#475569] mt-1">Total Panjang Kerusakan</p>
                    </div>
                    <div className="bg-gradient-to-br from-[#EEF2FF] to-white border border-[#C7D2FE] rounded-xl p-5">
                      <div className="flex items-center gap-2 text-[#1e40af] mb-2">
                        <Icon name="grid_view" className="!text-xl" />
                      </div>
                      <p className="text-2xl font-bold text-[#1e40af]">
                        {totalLuas.toLocaleString("id-ID")} <span className="text-sm font-medium">m²</span>
                      </p>
                      <p className="text-xs text-[#475569] mt-1">Total Luas Kerusakan</p>
                    </div>
                  </div>
                </section>
              )}

              {/* UPR Table */}
              {uprStats.length > 0 && (
                <section>
                  <h2 className="text-[15px] font-bold text-[#0F172A] mb-3 flex items-center gap-2">
                    <Icon name="groups" className="!text-lg text-[#1e40af]" />
                    Per UPR / Tim Satgas
                  </h2>
                  <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                            <th className="text-left px-5 py-3 font-semibold text-[#475569] text-[11px] uppercase tracking-wider">UPR</th>
                            <th className="text-center px-3 py-3 font-semibold text-[#475569] text-[11px] uppercase tracking-wider">Total</th>
                            <th className="text-center px-3 py-3 font-semibold text-[#475569] text-[11px] uppercase tracking-wider">Diproses</th>
                            <th className="text-center px-3 py-3 font-semibold text-[#475569] text-[11px] uppercase tracking-wider">Selesai</th>
                            <th className="text-center px-3 py-3 font-semibold text-[#475569] text-[11px] uppercase tracking-wider">Progress</th>
                            <th className="text-right px-5 py-3 font-semibold text-[#475569] text-[11px] uppercase tracking-wider">Luas (m²)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {uprStats.map((u, i) => {
                            const progress = u.total > 0 ? Math.round((u.selesai / u.total) * 100) : 0;
                            return (
                              <tr
                                key={u.upr_id}
                                className={`${i < uprStats.length - 1 ? "border-b border-[#E2E8F0]" : ""} hover:bg-[#F8FAFC] transition-colors`}
                              >
                                <td className="px-5 py-3.5">
                                  <span className="font-semibold text-[#0F172A]">{u.upr_name}</span>
                                  <span className="block text-[11px] text-[#475569] mt-0.5">{u.wilayah}</span>
                                </td>
                                <td className="text-center px-3 py-3.5 text-[#0F172A] font-medium">{u.total}</td>
                                <td className="text-center px-3 py-3.5 text-[#D97706] font-semibold">{u.sedang_diperbaiki}</td>
                                <td className="text-center px-3 py-3.5 text-[#059669] font-semibold">{u.selesai}</td>
                                <td className="px-3 py-3.5">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                      <div
                                        className="h-full rounded-full bg-[#10B981] transition-all"
                                        style={{ width: `${progress}%` }}
                                      />
                                    </div>
                                    <span className="text-[11px] font-semibold text-[#475569] w-8 text-right">{progress}%</span>
                                  </div>
                                </td>
                                <td className="text-right px-5 py-3.5 text-[#0F172A] font-mono text-xs">
                                  {u.total_luas_m2.toLocaleString("id-ID", { maximumFractionDigits: 1 })}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>
              )}

              {/* Back link for petugas_eksekusi */}
              {user?.role === "petugas_eksekusi" && uprStats.length > 0 && (
                <Link
                  to="/petugas-eksekusi"
                  className="flex items-center justify-center gap-2 h-11 bg-white border border-[#E2E8F0] text-[#1e40af] rounded-xl text-sm font-semibold hover:bg-[#F8FAFC] transition-all"
                >
                  <Icon name="arrow_back" className="!text-lg" />
                  Kembali ke Tugas Saya
                </Link>
              )}
            </>
          ) : null}
        </div>
      </main>
    </PageLayout>
  );
}

export default StatsPage;
