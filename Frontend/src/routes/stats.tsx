import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Icon } from "@/components/jk/Icon";
import { BottomNav } from "@/components/jk/BottomNav";
import { AppLayout } from "@/components/jk/AppLayout";
import { TopBar } from "@/components/jk/TopBar";
import { API_BASE_URL } from "@/lib/aiStore";
import { getCurrentUser, getToken } from "@/lib/auth";

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

function StatsPage() {
  const user = getCurrentUser();
  const token = getToken() ?? "";
  const [stats, setStats] = useState<StatsData | null>(null);
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
      const [statsRes, uprRes] = await Promise.all([
        fetch(`${API_BASE_URL}/reports/stats`, { headers }),
        fetch(`${API_BASE_URL}/reports/stats-by-upr`, { headers }),
      ]);
      if (statsRes.ok) {
        const sj = await statsRes.json();
        setStats(sj.data ?? null);
      }
      if (uprRes.ok) {
        const uj = await uprRes.json();
        setUprStats(uj.data ?? []);
      }
    } catch {
      setError("Gagal memuat data statistik.");
    } finally {
      setLoading(false);
    }
  }

  const statusCards = stats
    ? [
        { icon: "assignment", label: "Total Laporan", value: stats.total, color: "text-primary" },
        {
          icon: "rate_review",
          label: "Menunggu Review",
          value: stats.menunggu_review,
          color: "text-amber-600",
        },
        { icon: "thumb_up", label: "Disetujui", value: stats.disetujui, color: "text-blue-600" },
        {
          icon: "build",
          label: "Diperbaiki",
          value: stats.sedang_diperbaiki,
          color: "text-amber-600",
        },
        { icon: "check_circle", label: "Selesai", value: stats.selesai, color: "text-green-600" },
        { icon: "block", label: "Ditolak", value: stats.ditolak, color: "text-red-600" },
      ]
    : [];

  const trustCards = stats
    ? [
        {
          label: "Kredibel",
          value: stats.trust_hijau,
          color: "text-green-600",
          bar: "bg-green-500",
        },
        {
          label: "Perlu Review",
          value: stats.trust_kuning,
          color: "text-amber-600",
          bar: "bg-amber-500",
        },
        { label: "Diragukan", value: stats.trust_merah, color: "text-red-600", bar: "bg-red-500" },
      ]
    : [];

  const totalLuas = uprStats.reduce((sum, u) => sum + u.total_luas_m2, 0);
  const totalPanjang = uprStats.reduce((sum, u) => sum + u.total_panjang_m, 0);

  return (
    <AppLayout>
      <div className="flex flex-col h-screen w-full bg-[#F5F7FA]">
        <TopBar showBrand />
        <main className="flex-1 overflow-y-auto min-h-0 px-4 pt-6 pb-4 w-full">
          <div
            style={{ maxWidth: "42rem", marginLeft: "auto", marginRight: "auto" }}
            className="flex flex-col gap-5"
          >
            <section className="bg-[#E8F0FA] rounded-xl p-4 border border-[#D0DAE8]">
              <h2 className="font-headline-sm text-headline-sm font-bold text-primary">
                Statistik Laporan
              </h2>
              <p className="text-label-md text-[#476788] mt-1">
                Ringkasan data laporan kerusakan jalan Kabupaten Sidoarjo
              </p>
            </section>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <span className="w-8 h-8 border-4 border-primary-container/30 border-t-primary-container rounded-full animate-spin" />
              </div>
            ) : (
              <>
                <section>
                  <h3 className="font-label-md font-bold text-on-surface mb-3">Status Laporan</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {statusCards.map((c) => (
                      <div
                        key={c.label}
                        className="bg-white border border-[#D0DAE8] p-4 rounded-lg"
                      >
                        <Icon name={c.icon} className={c.color} />
                        <p
                          className={`font-headline-md text-headline-md font-bold ${c.color} mt-2 mb-1`}
                        >
                          {c.value}
                        </p>
                        <p className="font-label-md text-label-md text-[#476788]">{c.label}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h3 className="font-label-md font-bold text-on-surface mb-3">
                    Distribusi Trust Score
                  </h3>
                  <div className="bg-white border border-[#D0DAE8] rounded-lg p-4">
                    <div className="flex flex-col gap-3">
                      {trustCards.map((t) => {
                        const max = Math.max(...trustCards.map((x) => x.value), 1);
                        const pct = Math.round((t.value / max) * 100);
                        return (
                          <div key={t.label}>
                            <div className="flex justify-between mb-1">
                              <span className="text-label-sm text-on-surface-variant">
                                {t.label}
                              </span>
                              <span className={`text-label-sm font-bold ${t.color}`}>
                                {t.value}
                              </span>
                            </div>
                            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${t.bar} transition-all`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>

                {totalPanjang > 0 || totalLuas > 0 ? (
                  <section>
                    <h3 className="font-label-md font-bold text-on-surface mb-3">
                      Dimensi Kerusakan
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white border border-[#D0DAE8] p-4 rounded-lg">
                        <Icon name="straighten" className="text-primary" />
                        <p className="font-headline-md text-headline-md font-bold text-primary mt-2 mb-1">
                          {totalPanjang.toLocaleString("id-ID")} m
                        </p>
                        <p className="font-label-md text-label-md text-[#476788]">Total Panjang</p>
                      </div>
                      <div className="bg-white border border-[#D0DAE8] p-4 rounded-lg">
                        <Icon name="grid_view" className="text-primary" />
                        <p className="font-headline-md text-headline-md font-bold text-primary mt-2 mb-1">
                          {totalLuas.toLocaleString("id-ID")} m²
                        </p>
                        <p className="font-label-md text-label-md text-[#476788]">Total Luas</p>
                      </div>
                    </div>
                  </section>
                ) : null}

                {uprStats.length > 0 && (
                  <section>
                    <h3 className="font-label-md font-bold text-on-surface mb-3">
                      Per UPR / Tim Satgas
                    </h3>
                    <div className="bg-white border border-[#D0DAE8] rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#D0DAE8] bg-[#F5F7FA]">
                            <th className="text-left px-4 py-2.5 font-semibold text-on-surface-variant">
                              UPR
                            </th>
                            <th className="text-center px-3 py-2.5 font-semibold text-on-surface-variant">
                              Total
                            </th>
                            <th className="text-center px-3 py-2.5 font-semibold text-on-surface-variant">
                              Diperbaiki
                            </th>
                            <th className="text-center px-3 py-2.5 font-semibold text-on-surface-variant">
                              Selesai
                            </th>
                            <th className="text-right px-4 py-2.5 font-semibold text-on-surface-variant">
                              Luas (m²)
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {uprStats.map((u, i) => (
                            <tr
                              key={u.upr_id}
                              className={i < uprStats.length - 1 ? "border-b border-[#D0DAE8]" : ""}
                            >
                              <td className="px-4 py-3 font-medium text-on-surface">
                                {u.upr_name}
                                <span className="block text-label-sm text-on-surface-variant">
                                  {u.wilayah}
                                </span>
                              </td>
                              <td className="text-center px-3 py-3 text-on-surface">{u.total}</td>
                              <td className="text-center px-3 py-3 text-amber-600 font-semibold">
                                {u.sedang_diperbaiki}
                              </td>
                              <td className="text-center px-3 py-3 text-green-600 font-semibold">
                                {u.selesai}
                              </td>
                              <td className="text-right px-4 py-3 text-on-surface font-mono text-xs">
                                {u.total_luas_m2.toLocaleString("id-ID", {
                                  maximumFractionDigits: 1,
                                })}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-[#F5F7FA] border-t border-[#D0DAE8] font-semibold">
                            <td className="px-4 py-3 text-on-surface">Total</td>
                            <td className="text-center px-3 py-3 text-on-surface">
                              {uprStats.reduce((s, u) => s + u.total, 0)}
                            </td>
                            <td className="text-center px-3 py-3 text-amber-600">
                              {uprStats.reduce((s, u) => s + u.sedang_diperbaiki, 0)}
                            </td>
                            <td className="text-center px-3 py-3 text-green-600">
                              {uprStats.reduce((s, u) => s + u.selesai, 0)}
                            </td>
                            <td className="text-right px-4 py-3 text-on-surface font-mono text-xs">
                              {totalLuas.toLocaleString("id-ID", { maximumFractionDigits: 1 })}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                {user?.role === "petugas_eksekusi" && uprStats.length > 0 && (
                  <Link
                    to="/petugas-eksekusi"
                    className="flex items-center justify-center gap-2 h-11 bg-white border border-[#D0DAE8] text-primary rounded-lg text-sm font-semibold hover:bg-gray-50 transition-all"
                  >
                    <Icon name="arrow_back" className="!text-lg" />
                    Kembali ke Tugas Saya
                  </Link>
                )}
              </>
            )}
          </div>
        </main>
        <BottomNav />
      </div>
    </AppLayout>
  );
}

export default StatsPage;
