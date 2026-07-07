import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@/components/jk/Icon";
import { formatDateRelative, displayStatus } from "@/lib/format";
import { PageLayout } from "@/components/jk/PageLayout";
import { API_BASE_URL } from "@/lib/aiStore";

import { getCurrentUser, getToken } from "@/lib/auth";
import { ReportCard } from "@/components/jk/ReportCard";
import { ConfirmDialog } from "@/components/jk/ConfirmDialog";
import { useStats, useTeams, useTeamStats } from "@/hooks/useReportQueries";
import type { Laporan } from "@/types/laporan";
import type { ActionButton } from "@/components/jk/report-card/types";

export const Route = createFileRoute("/supervisor/")({
  component: SupervisorDashboard,
  head: () => ({ meta: [{ title: "Beranda Supervisor — DeltaJalan" }] }),
});

interface SupervisorStats {
  total: number;
  menunggu_review: number;
  menunggu_verifikasi: number;
  hasil_ai: number;
  disetujui: number;
  ditolak: number;
  ditugaskan: number;
  sedang_diperbaiki: number;
  selesai: number;
  trust_hijau: number;
  trust_kuning: number;
  trust_merah: number;
}

function SupervisorDashboard() {
  const user = getCurrentUser();
  const token = getToken() ?? "";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (user?.role !== "supervisor") {
      navigate({ to: "/masuk" });
    }
  }, [user, navigate]);

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["reports"] });
  }, [queryClient]);

  const { data: stats, isFetching: statsFetching } = useStats(token);
  const { data: uptdStats = [], isFetching: uptdFetching } = useTeamStats(token);
  const { data: teamList = [] } = useTeams(token);

  async function refetchAll() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["stats"] }),
      queryClient.invalidateQueries({ queryKey: ["reports"] }),
      queryClient.invalidateQueries({ queryKey: ["team-stats"] }),
      queryClient.invalidateQueries({ queryKey: ["teams"] }),
    ]);
  }

  const [tolakTarget, setTolakTarget] = useState<string | null>(null);
  const [tolakAlasan, setTolakAlasan] = useState("");
  const [tolakCatatan, setTolakCatatan] = useState("");

  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [actionMsgType, setActionMsgType] = useState<"success" | "error">("success");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [showUptdStats, setShowUptdStats] = useState(false);

  const [activeTab, setActiveTab] = useState<
    "menunggu" | "disetujui" | "ditugaskan" | "ditolak" | "sedang_diperbaiki" | "semua"
  >("menunggu");

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterUptd, setFilterUptd] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");
  const [filterSla, setFilterSla] = useState("");

  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [activeTab, searchQuery, filterStatus, filterUptd, filterSource, filterSeverity, filterSla]);

  const [exportMonth, setExportMonth] = useState(1);
  const [exportYear, setExportYear] = useState(2026);
  useEffect(() => {
    const n = new Date();
    setExportMonth(n.getMonth() + 1);
    setExportYear(n.getFullYear());
  }, []);

  const paginatedParams = useMemo(() => {
    const p = new URLSearchParams();
    if (activeTab === "menunggu") p.set("status", "menunggu_review");
    else if (activeTab === "disetujui") p.set("status", "disetujui");
    else if (activeTab === "ditugaskan") p.set("status", "ditugaskan");
    else if (activeTab === "sedang_diperbaiki") p.set("status", "sedang_diperbaiki");
    else if (activeTab === "ditolak") p.set("status", "ditolak");
    p.set("page", String(page));
    p.set("limit", "20");

    if (activeTab === "menunggu") p.set("sort_by", "deadline_review");
    else if (activeTab === "disetujui" || activeTab === "sedang_diperbaiki")
      p.set("sort_by", "deadline_resolusi");

    if (searchQuery) p.set("q", searchQuery);
    if (filterStatus) p.set("status", filterStatus);
    if (filterUptd) p.set("uptd_id", filterUptd);
    if (filterSource) p.set("source", filterSource);
    if (filterSeverity) p.set("severity", filterSeverity);
    if (filterSla) p.set("status_deadline", filterSla);
    return p.toString();
  }, [activeTab, page, searchQuery, filterStatus, filterUptd, filterSource, filterSeverity, filterSla]);

  const { data: paginatedResponse, isFetching } = useQuery({
    queryKey: ["reports", "paginated", paginatedParams],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/reports?${paginatedParams}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return {
        items: (json.data ?? []) as Laporan[],
        total: json.total as number,
        page: json.page as number,
        last_page: json.last_page as number,
      };
    },
    enabled: !!token,
    staleTime: 15_000,
    refetchOnMount: 'always',
  });

  const teamToUptdMap = useMemo(() => {
    const map: Record<string, string> = {};
    teamList.forEach((t) => {
      if (t.uptd) map[t.id] = t.uptd.nama;
    });
    return map;
  }, [teamList]);

  const uptdOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: { id: string; nama: string }[] = [];
    teamList.forEach((t) => {
      if (t.uptd && !seen.has(t.uptd.id)) {
        seen.add(t.uptd.id);
        options.push({ id: t.uptd.id, nama: t.uptd.nama });
      }
    });
    return options;
  }, [teamList]);

  const reports = paginatedResponse?.items ?? [];
  const currentPage = paginatedResponse?.page ?? 1;
  const totalPages = paginatedResponse?.last_page ?? 1;

  function showMsg(msg: string, type: "success" | "error" = "success") {
    setActionMsg(msg);
    setActionMsgType(type);
    setTimeout(() => setActionMsg(""), 4000);
  }

  async function handleApprove(id: string) {
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/reports/${id}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (res.ok) {
        showMsg(json.message);
        refetchAll();
      } else {
        showMsg(json.message ?? "Gagal.", "error");
      }
    } catch {
      showMsg("Kesalahan jaringan.", "error");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleTolak(id: string, alasan: string, catatan: string) {
    if (!alasan) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/reports/${id}/tolak`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ alasan, catatan }),
      });
      const json = await res.json();
      if (res.ok) {
        showMsg(json.message);
        setTolakTarget(null);
        setTolakAlasan("");
        setTolakCatatan("");
        refetchAll();
      } else {
        showMsg(json.message ?? "Gagal.", "error");
      }
    } catch {
      showMsg("Kesalahan jaringan.", "error");
    } finally {
      setActionLoading(false);
    }
  }

  function handleDeleteClick(id: string) {
    setDeleteTarget(id);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/reports/${deleteTarget}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showMsg("Laporan berhasil dihapus.");
        setDeleteTarget(null);
        refetchAll();
      } else {
        const json = await res.json();
        showMsg(json.message ?? "Gagal menghapus laporan.", "error");
        setDeleteTarget(null);
      }
    } catch {
      showMsg("Kesalahan jaringan.", "error");
      setDeleteTarget(null);
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleExportPdf() {
    try {
      const res = await fetch(
        `${API_BASE_URL}/reports/export/monthly-pdf?month=${exportMonth}&year=${exportYear}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) {
        const text = await res.text();
        showMsg(text || "Gagal mengexport PDF.", "error");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rekap-bulanan-${exportYear}-${String(exportMonth).padStart(2, "0")}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showMsg("PDF berhasil diunduh.");
    } catch {
      showMsg("Kesalahan jaringan saat mengunduh PDF.", "error");
    }
  }

  return (
    <PageLayout showBrand withBottomNav onRefresh={refetchAll}>
      <main className="pb-4">
        <section className="bg-gradient-to-br from-[#1e40af] to-[#2e68d8] p-6 text-white mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                Selamat pagi, {user?.name ?? "Supervisor"}
              </h1>
              <p className="text-sm text-blue-200 mt-1">
                Ringkasan data laporan kerusakan jalan Kab. Sidoarjo
              </p>
            </div>
            <span className="px-2.5 py-1 bg-white/15 text-xs font-semibold text-blue-200 uppercase tracking-wide">
              Supervisor
            </span>
          </div>
        </section>
        <div className="max-w-5xl mx-auto px-4">
          <section className="mb-6">
            <h3 className="text-[15px] font-bold text-[#0F172A] mb-3 flex items-center gap-2">
              <Icon name="bar_chart" className="!text-lg text-[#1e40af]" />
              Status Laporan
            </h3>
            {statsFetching && !stats ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-white border border-[#C7D2FE] p-4 animate-pulse">
                    <div className="w-6 h-6 bg-[#C7D2FE] mb-2" />
                    <div className="w-12 h-7 bg-[#C7D2FE] mb-1" />
                    <div className="w-24 h-4 bg-[#C7D2FE]" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {[
                  {
                    label: "Perlu Review",
                    value: (stats?.menunggu_review ?? 0) + (stats?.menunggu_verifikasi ?? 0),
                    icon: "rate_review",
                    color: "text-[#D97706]",
                  },
                  {
                    label: "Menunggu Verifikasi",
                    value: stats?.menunggu_verifikasi,
                    icon: "pending_actions",
                    color: "text-[#7C3AED]",
                  },
                  {
                    label: "Ditugaskan",
                    value: stats?.ditugaskan,
                    icon: "assignment",
                    color: "text-[#2563EB]",
                  },
                  {
                    label: "Diperbaiki",
                    value: stats?.sedang_diperbaiki,
                    icon: "construction",
                    color: "text-[#D97706]",
                  },
                ].map(({ label, value, icon, color }) => (
                  <div
                    key={label}
                    className="bg-gradient-to-br from-[#EEF2FF] to-white border border-[#C7D2FE] rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 aspect-square group transition-all duration-200 ease-out hover:scale-[1.03] hover:shadow-md hover:border-[#A5B4FC]"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <Icon
                        name={icon}
                        className={`${color} !text-2xl group-hover:scale-110 group-hover:-translate-y-0.5 transition-transform duration-200`}
                      />
                      <span className={`text-2xl font-bold ${color}`}>{value ?? 0}</span>
                    </div>
                    <p className={`text-sm font-medium ${color} opacity-80`}>{label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* ── TRUST SCORE [NONAKTIF] — trust stat pills dihapus */}

            <div className="flex items-center gap-2 mb-4">
              <span className="font-label-sm text-label-sm text-[#476788] font-semibold whitespace-nowrap">
                Export PDF
              </span>
              <select
                value={exportMonth}
                onChange={(e) => setExportMonth(Number(e.target.value))}
                className="text-xs px-2 py-1 rounded-lg border border-[#D0DAE8] bg-white text-[#0F1623]"
              >
                {[
                  { v: 1, l: "Januari" },
                  { v: 2, l: "Februari" },
                  { v: 3, l: "Maret" },
                  { v: 4, l: "April" },
                  { v: 5, l: "Mei" },
                  { v: 6, l: "Juni" },
                  { v: 7, l: "Juli" },
                  { v: 8, l: "Agustus" },
                  { v: 9, l: "September" },
                  { v: 10, l: "Oktober" },
                  { v: 11, l: "November" },
                  { v: 12, l: "Desember" },
                ].map((m) => (
                  <option key={m.v} value={m.v}>
                    {m.l}
                  </option>
                ))}
              </select>
              <select
                value={exportYear}
                onChange={(e) => setExportYear(Number(e.target.value))}
                className="text-xs px-2 py-1 rounded-lg border border-[#D0DAE8] bg-white text-[#0F1623]"
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleExportPdf}
                className="ml-auto flex items-center gap-1 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
              >
                <Icon name="download" className="!text-sm" />
                Export
              </button>
            </div>

            <button
              onClick={() => setShowUptdStats(!showUptdStats)}
              className="w-full flex items-center justify-between px-3 py-2 mb-3 bg-white border border-[#D0DAE8] rounded-lg font-label-sm text-label-sm font-semibold text-[#0F1623] hover:bg-gray-50 transition-colors"
            >
              <span>Statistik per UPTD</span>
              <Icon
                name={showUptdStats ? "expand_less" : "expand_more"}
                className="!text-lg text-[#476788]"
              />
            </button>

            {showUptdStats && (
              <div className="flex flex-col gap-2 mb-4">
                {uptdFetching && uptdStats.length === 0 ? (
                  <div
                    className="flex flex-col gap-2"
                    aria-busy="true"
                    aria-label="Memuat statistik UPTD"
                  >
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div
                        key={i}
                        className="bg-white border border-[#D0DAE8] rounded-lg p-3 animate-pulse"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="w-36 h-4 bg-[#D0DAE8] rounded" />
                          <div className="w-16 h-3 bg-[#E8F0FA] rounded" />
                        </div>
                        <div className="w-44 h-3 bg-[#E8F0FA] rounded mb-2" />
                        <div className="flex gap-0.5">
                          {Array.from({ length: 10 }).map((_, j) => (
                            <div key={j} className="h-1.5 flex-1 rounded-full bg-[#E8F0FA]" />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : uptdStats.length === 0 ? (
                  <p className="text-xs text-[#476788] px-1">Belum ada data UPTD</p>
                ) : (
                  uptdStats.map((u) => {
                    const uptdName = teamToUptdMap[u.team_id] ?? u.team_name;
                    return (
                      <div key={u.team_id} className="bg-white border border-[#D0DAE8] rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-sm text-[#0F1623]">{uptdName}</span>
                          <span className="text-xs text-[#476788]">{u.total} laporan</span>
                        </div>
                        <div className="text-xs text-[#476788] space-y-0.5 mb-2">
                          <span>
                            {u.selesai} selesai · {u.sedang_diperbaiki} dikerjakan
                          </span>
                          {u.total_panjang_m > 0 && (
                            <div className="text-[11px]">
                              Total: {u.total_panjang_m} m ({u.total_luas_m2} m²)
                            </div>
                          )}
                        </div>
                        <div className="flex gap-0.5">
                          {Array.from({
                            length: Math.max(1, Math.min(Math.ceil(u.total / 5), 20)),
                          }).map((_, i) => {
                            const selesai =
                              u.selesai > 0 &&
                              i < Math.round((u.selesai / Math.max(1, u.total)) * 20);
                            const dikerjakan =
                              !selesai &&
                              u.sedang_diperbaiki > 0 &&
                              i <
                                Math.round(
                                  ((u.selesai + u.sedang_diperbaiki) / Math.max(1, u.total)) * 20,
                                );
                            return (
                              <div
                                key={i}
                                className={`h-1.5 flex-1 rounded-full ${selesai ? "bg-green-400" : dikerjakan ? "bg-blue-400" : "bg-gray-200"}`}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </section>

          {actionMsg && (
            <div
              className={`mx-4 mb-3 px-4 py-2 rounded-lg text-sm ${
                actionMsgType === "success"
                  ? "bg-green-50 border border-green-200 text-green-800"
                  : "bg-red-50 border border-red-200 text-red-800"
              }`}
            >
              {actionMsg}
            </div>
          )}

          <section className="px-4 mb-3">
            <div className="flex gap-2 mb-2">
              <div className="relative flex-1">
                <Icon
                  name="search"
                  className="absolute left-3 top-1/2 -translate-y-1/2 !text-lg text-[#476788]"
                />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari kode/jalan/pelapor..."
                  className="w-full pl-9 pr-3 py-2 border border-[#D0DAE8] rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/25 bg-white"
                />
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <select
                value={filterUptd}
                onChange={(e) => setFilterUptd(e.target.value)}
                className="text-xs px-2 py-1.5 border border-[#D0DAE8] rounded-lg bg-white outline-none text-[#0F1623]"
              >
                <option value="">Semua UPTD</option>
                {uptdOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nama}
                  </option>
                ))}
              </select>
              <select
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value)}
                className="text-xs px-2 py-1.5 border border-[#D0DAE8] rounded-lg bg-white outline-none text-[#0F1623]"
              >
                <option value="">Semua sumber</option>
                <option value="warga">Warga</option>
                <option value="petugas">Petugas</option>
                <option value="telegram">Telegram</option>
              </select>
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value)}
                className="text-xs px-2 py-1.5 border border-[#D0DAE8] rounded-lg bg-white outline-none text-[#0F1623]"
              >
                <option value="">Semua severity</option>
                {["Rusak Berat", "Rusak Sedang", "Rusak Ringan", "Baik"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                value={filterSla}
                onChange={(e) => setFilterSla(e.target.value)}
                className="text-xs px-2 py-1.5 border border-[#D0DAE8] rounded-lg bg-white outline-none text-[#0F1623]"
              >
                <option value="">Semua Deadline</option>
                <option value="tepat_waktu">Tepat Waktu</option>
                <option value="terlambat">Terlewat Deadline</option>
              </select>
            </div>
          </section>

          <section className="px-4 flex-1">
            <div className="flex gap-2 mb-3 overflow-x-auto no-scrollbar">
              {[
                { key: "menunggu", label: "Perlu Review", count: (stats?.menunggu_review ?? 0) + (stats?.menunggu_verifikasi ?? 0) },
                { key: "disetujui", label: "Disetujui", count: stats?.disetujui },
                { key: "ditugaskan", label: "Ditugaskan", count: stats?.ditugaskan },
                { key: "sedang_diperbaiki", label: "Diperbaiki", count: stats?.sedang_diperbaiki },
                { key: "ditolak", label: "Ditolak", count: stats?.ditolak },
                { key: "semua", label: "Semua" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key as typeof activeTab);
                    setSearchQuery("");
                    setFilterStatus("");
                    setFilterUptd("");
                    setFilterSource("");
                    setFilterSeverity("");
                    setPage(1);
                  }}
                  className={`whitespace-nowrap px-4 py-1.5 rounded-full font-label-sm font-bold transition-colors ${
                    activeTab === tab.key ? "bg-primary text-white" : "bg-[#EEF3FA] text-[#476788]"
                  }`}
                >
                  {tab.label}
                  {tab.count !== undefined ? ` (${tab.count})` : ""}
                </button>
              ))}
            </div>

            {isFetching ? (
              <div className="flex flex-col gap-3" aria-busy="true" aria-label="Memuat laporan">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-lg border border-[#D0DAE8] overflow-hidden animate-pulse"
                  >
                    <div className="flex">
                      <div className="w-36 shrink-0 bg-[#E8F0FA]" />
                      <div className="w-1.5 bg-[#D0DAE8]" />
                      <div className="p-4 flex-1 space-y-3">
                        <div className="flex justify-between">
                          <div className="w-24 h-5 bg-[#D0DAE8] rounded" />
                          <div className="w-20 h-5 bg-[#E8F0FA] rounded" />
                        </div>
                        <div className="w-3/4 h-6 bg-[#D0DAE8] rounded" />
                        <div className="flex gap-4">
                          <div className="w-28 h-4 bg-[#E8F0FA] rounded" />
                          <div className="w-24 h-4 bg-[#E8F0FA] rounded" />
                          <div className="w-20 h-4 bg-[#E8F0FA] rounded" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : reports.length === 0 ? (
              <div className="text-center py-12 text-[#476788]">
                <Icon name="inbox" className="!text-5xl mb-3 opacity-30" />
                <p className="font-body-md text-body-md">Belum ada laporan</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {reports.map((row) => {
                    const ac: ActionButton[] = [];
                    if (row.status === "Ditolak")
                      ac.push({
                        label: "Hapus",
                        icon: "delete",
                        variant: "destructive",
                        onClick: () => handleDeleteClick(row.id),
                      });
                    ac.push({
                      label: "Lihat Detail",
                      icon: "arrow_forward",
                      variant: "secondary",
                      to: "/detail-report",
                      search: { reportId: row.id },
                    });
                    return (
                      <ReportCard
                        key={row.id}
                        report={row}
                        // ── TRUST SCORE [NONAKTIF] — showTrust: true dihapus
                        options={{ showTrust: false, showDeadline: true, isClient }}
                        actions={ac}
                      />
                    );
                  })}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-4 mt-4 pb-4">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className="px-4 py-2 bg-white border border-[#D0DAE8] rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50 transition-colors"
                    >
                      ← Sebelumnya
                    </button>
                    <span className="text-sm text-[#476788] font-medium">
                      Halaman {currentPage} dari {totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      className="px-4 py-2 bg-white border border-[#D0DAE8] rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50 transition-colors"
                    >
                      Selanjutnya →
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </main>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Hapus Laporan?"
        message="Laporan yang dihapus tidak bisa dikembalikan. Semua foto dan data terkait akan dihapus permanen."
        confirmText="Ya, Hapus"
        cancelText="Batal"
        confirmLoading={deleteLoading}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </PageLayout>
  );
}
export default SupervisorDashboard;
