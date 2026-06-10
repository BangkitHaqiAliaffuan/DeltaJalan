import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@/components/jk/Icon";
import { getSeverityLabel, statusBadgeStyle } from "@/lib/format";
import { PageLayout } from "@/components/jk/PageLayout";
import { TrustBadge } from "@/components/jk/TrustBadge";
import { API_BASE_URL } from "@/lib/aiStore";
import { authFetch } from "@/hooks/useReportQueries";
import { SupervisorMapView } from "@/components/jk/SupervisorMapView";
import { getCurrentUser, getToken } from "@/lib/auth";
import { DeadlineBadge } from "@/components/jk/DeadlineBadge";
import { DeadlineStatsCards } from "@/components/jk/DeadlineStatsCards";
import { hitungStatusDeadline } from "@/lib/deadline";
import { useStats, useUprs, useAllReports, useUprStats, useRingkasanDeadline } from "@/hooks/useReportQueries";
import type { Laporan, TrustLabel, RingkasanDeadlineResponse } from "@/types/laporan";

export const Route = createFileRoute("/supervisor")({
  component: SupervisorPage,
  head: () => ({ meta: [{ title: "Beranda Supervisor — DeltaJalan" }] }),
});

interface SupervisorStats {
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

function SupervisorPage() {
  const user = getCurrentUser();
  const token = getToken() ?? "";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);

  const { data: stats, isFetching: statsFetching } = useStats(token);
  const { data: allLaporan } = useAllReports(token);
  const { data: uprStats = [], isFetching: uprFetching } = useUprStats(token);
  const { data: ringkasanDeadline } = useRingkasanDeadline(token);
  const { data: uprList = [] } = useUprs(token);

  function refetchAll() {
    queryClient.invalidateQueries({ queryKey: ["stats"] });
    queryClient.invalidateQueries({ queryKey: ["reports"] });
    queryClient.invalidateQueries({ queryKey: ["upr-stats"] });
    queryClient.invalidateQueries({ queryKey: ["ringkasan-deadline"] });
    queryClient.invalidateQueries({ queryKey: ["uprs"] });
  }

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const [tolakTarget, setTolakTarget] = useState<string | null>(null);
  const [tolakAlasan, setTolakAlasan] = useState("");
  const [tolakCatatan, setTolakCatatan] = useState("");

  const [bulkTolakOpen, setBulkTolakOpen] = useState(false);
  const [bulkTolakAlasan, setBulkTolakAlasan] = useState("");

  const [mulaiTarget, setMulaiTarget] = useState<string | null>(null);
  const [mulaiUprId, setMulaiUprId] = useState("");
  const [mulaiCatatan, setMulaiCatatan] = useState("");

  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [actionMsgType, setActionMsgType] = useState<"success" | "error">("success");

  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [showUprStats, setShowUprStats] = useState(false);

  const [activeTab, setActiveTab] = useState<
    "menunggu" | "disetujui" | "ditolak" | "sedang_diperbaiki" | "semua"
  >("menunggu");

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterUpr, setFilterUpr] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");
  const [filterSla, setFilterSla] = useState("");

  const [exportMonth, setExportMonth] = useState(1);
  const [exportYear, setExportYear] = useState(2026);
  useEffect(() => {
    const n = new Date();
    setExportMonth(n.getMonth() + 1);
    setExportYear(n.getFullYear());
  }, []);

  useEffect(() => {
    if (user?.role !== "supervisor") {
      navigate({ to: "/" });
    }
  }, [user, navigate]);

  const laporanParams = useMemo(() => {
    const p = new URLSearchParams();
    if (activeTab === "menunggu") p.set("status", "menunggu_review");
    else if (activeTab === "disetujui") p.set("status", "disetujui");
    else if (activeTab === "ditolak") p.set("status", "ditolak");
    p.set("limit", "100");
    if (searchQuery) p.set("q", searchQuery);
    if (filterStatus) p.set("status", filterStatus);
    if (filterUpr) p.set("upr_id", filterUpr);
    if (filterSeverity) p.set("severity", filterSeverity);
    if (filterSla) p.set("status_deadline", filterSla);
    return p.toString();
  }, [activeTab, searchQuery, filterStatus, filterUpr, filterSeverity, filterSla]);

  const { data: laporan = [], isFetching } = useQuery({
    queryKey: ["reports", "filtered", laporanParams],
    queryFn: () => authFetch<Laporan[]>(`${API_BASE_URL}/reports?${laporanParams}`, token),
    enabled: !!token,
    staleTime: 15_000,
  });

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

  async function handleMulai(id: string, uprId: string, catatan: string) {
    setActionLoading(true);
    try {
      const body: Record<string, string> = {};
      if (uprId) body.assigned_upr_id = uprId;
      if (catatan) body.catatan = catatan;
      const res = await fetch(`${API_BASE_URL}/reports/${id}/mulai`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (res.ok) {
        showMsg(json.message);
        setMulaiTarget(null);
        setMulaiUprId("");
        setMulaiCatatan("");
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

  async function handleBulkApprove() {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/reports/bulk-approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const json = await res.json();
      if (res.ok) {
        showMsg(json.message);
        setSelectedIds(new Set());
        refetchAll();
      } else {
        showMsg(json.message ?? "Gagal.", "error");
      }
    } catch {
      showMsg("Kesalahan jaringan.", "error");
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleBulkTolak() {
    if (!bulkTolakAlasan) return;
    setBulkLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/reports/bulk-tolak`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), alasan: bulkTolakAlasan }),
      });
      const json = await res.json();
      if (res.ok) {
        showMsg(json.message);
        setSelectedIds(new Set());
        setBulkTolakOpen(false);
        setBulkTolakAlasan("");
        refetchAll();
      } else {
        showMsg(json.message ?? "Gagal.", "error");
      }
    } catch {
      showMsg("Kesalahan jaringan.", "error");
    } finally {
      setBulkLoading(false);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const filtered = laporan.filter(
      (r) => r.status === "Menunggu Review" || r.status === "Ditinjau",
    );
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(filtered.map((r) => r.id)));
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

  function displayStatus(status: string) {
    return status === "Ditinjau" ? "Menunggu Review" : status;
  }

  const filteredReports = useMemo(() => {
    let list = allLaporan ?? [];
    if (activeTab === "menunggu")
      list = list.filter((r) => r.status === "Menunggu Review" || r.status === "Ditinjau");
    else if (activeTab === "disetujui") list = list.filter((r) => r.status === "Disetujui");
    else if (activeTab === "sedang_diperbaiki")
      list = list.filter((r) => r.status === "Sedang Diperbaiki");
    else if (activeTab === "ditolak") list = list.filter((r) => r.status === "Ditolak");
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (r) =>
          r.report_code.toLowerCase().includes(q) ||
          r.road_name.toLowerCase().includes(q) ||
          r.reporter_name.toLowerCase().includes(q),
      );
    }
    if (filterStatus) list = list.filter((r) => r.status === filterStatus);
    if (filterUpr) list = list.filter((r) => r.assigned_upr_id === Number(filterUpr));
    if (filterSeverity)
      list = list.filter(
        (r) => r.overall_severity === filterSeverity || r.ai_severity === filterSeverity,
      );
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return list.slice(0, 100);
  }, [allLaporan, activeTab, searchQuery, filterStatus, filterUpr, filterSeverity]);

  return (
    <PageLayout showBrand withBottomNav>

        <main className="pb-4">
          <section className="px-4 pt-6 pb-8 bg-[#E8F0FA] rounded-b-lg border-b border-[#D0DAE8] mb-6">
            <div className="flex flex-col gap-1">
              <h2 className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-primary">
                Selamat pagi, {user?.name ?? "Supervisor"}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-label-sm font-bold rounded border border-amber-200 uppercase tracking-wide">
                  Supervisor
                </span>
              </div>
            </div>
          </section>
        <section className="px-4 mb-6">
          {statsFetching && !stats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4" aria-busy="true" aria-label="Memuat statistik">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white border border-[#D0DAE8] p-4 rounded-lg animate-pulse">
                  <div className="w-6 h-6 bg-[#D0DAE8] rounded mb-2" />
                  <div className="w-12 h-7 bg-[#D0DAE8] rounded mb-1" />
                  <div className="w-24 h-4 bg-[#E8F0FA] rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {[
                { label: "Menunggu Review", value: stats?.menunggu_review, icon: "rate_review", color: "blue" },
                { label: "Disetujui", value: stats?.disetujui, icon: "check_circle", color: "green" },
                { label: "Ditolak", value: stats?.ditolak, icon: "cancel", color: "red" },
                { label: "Diperbaiki", value: stats?.sedang_diperbaiki, icon: "construction", color: "orange" },
              ].map(({ label, value, icon, color }) => (
                <div
                  key={label}
                  className="bg-white border border-[#D0DAE8] p-4 rounded-lg"
                >
                  <div className="flex items-center justify-between mb-2">
                    <Icon name={icon} className={`text-${color}-600`} />
                  </div>
                  <p className="font-headline-md text-headline-md font-bold text-primary mb-1">
                    {value ?? 0}
                  </p>
                  <p className="font-label-md text-label-md text-[#476788]">{label}</p>
                </div>
              ))}
            </div>
          )}

          {statsFetching && !stats ? (
            <div className="flex gap-2 mb-4" aria-busy="true" aria-label="Memuat trust badges">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="w-28 h-6 bg-[#EEF3FA] rounded-full animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="flex gap-2 mb-4">
              {[
                { label: "Kredibel", value: stats?.trust_hijau, dot: "bg-green-500" },
                { label: "Perlu Review", value: stats?.trust_kuning, dot: "bg-yellow-500" },
                { label: "Diragukan", value: stats?.trust_merah, dot: "bg-red-500" },
              ].map(({ label, value, dot }) => (
                <span
                  key={label}
                  className="flex items-center gap-1 px-2 py-1 rounded-full bg-[#EEF3FA] text-[#476788] text-label-sm"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                  {label}: {value ?? 0}
                </span>
              ))}
            </div>
          )}

          {/* Deadline Stats Cards */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="timer" className="!text-lg text-[#476788]" />
              <span className="font-label-sm text-label-sm text-[#476788] font-semibold">Status Deadline</span>
            </div>
            <DeadlineStatsCards data={ringkasanDeadline ?? undefined} isLoading={isFetching} />
          </div>

          {/* Export PDF */}
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
              {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map((y) => (
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

          {/* UPR Stats toggle */}
          <button
            onClick={() => setShowUprStats(!showUprStats)}
            className="w-full flex items-center justify-between px-3 py-2 mb-3 bg-white border border-[#D0DAE8] rounded-lg font-label-sm text-label-sm font-semibold text-[#0F1623] hover:bg-gray-50 transition-colors"
          >
            <span>Statistik per UPR</span>
            <Icon name={showUprStats ? "expand_less" : "expand_more"} className="!text-lg text-[#476788]" />
          </button>

          {showUprStats && (
            <div className="flex flex-col gap-2 mb-4">
              {uprFetching && uprStats.length === 0 ? (
                <div className="flex flex-col gap-2" aria-busy="true" aria-label="Memuat statistik UPR">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="bg-white border border-[#D0DAE8] rounded-lg p-3 animate-pulse">
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
              ) : uprStats.length === 0 ? (
                <p className="text-xs text-[#476788] px-1">Belum ada data UPR</p>
              ) : (
                uprStats.map((u) => (
                  <div
                    key={u.upr_id}
                    className="bg-white border border-[#D0DAE8] rounded-lg p-3"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm text-[#0F1623]">{u.upr_name}</span>
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
                      {Array.from({ length: Math.max(1, Math.min(Math.ceil(u.total / 5), 20)) }).map(
                        (_, i) => {
                          const selesai =
                            u.selesai > 0 && i < Math.round((u.selesai / Math.max(1, u.total)) * 20);
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
                        },
                      )}
                    </div>
                  </div>
                ))
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

        {/* Search + Filters */}
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
            <button
              onClick={() => setViewMode(viewMode === "list" ? "map" : "list")}
              className={`px-3 py-2 rounded-lg border border-[#D0DAE8] text-sm flex items-center gap-1 ${
                viewMode === "map"
                  ? "bg-primary text-white"
                  : "bg-white text-[#476788]"
              }`}
            >
              <Icon name={viewMode === "map" ? "list" : "map"} className="!text-lg" />{" "}
              {viewMode === "map" ? "List" : "Map"}
            </button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-xs px-2 py-1.5 border border-[#D0DAE8] rounded-lg bg-white outline-none text-[#0F1623]"
            >
              <option value="">Semua status</option>
              {[
                "Menunggu Review",
                "Ditinjau",
                "Disetujui",
                "Ditolak",
                "Sedang Diperbaiki",
                "Selesai",
                "Diedit",
              ].map((s) => (
                <option key={s} value={s}>
                  {displayStatus(s)}
                </option>
              ))}
            </select>
            <select
              value={filterUpr}
              onChange={(e) => setFilterUpr(e.target.value)}
              className="text-xs px-2 py-1.5 border border-[#D0DAE8] rounded-lg bg-white outline-none text-[#0F1623]"
            >
              <option value="">Semua UPR</option>
              {uprList.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
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

        {/* Report content */}
        <section className="px-4 flex-1">
          <div className="flex gap-2 mb-3 overflow-x-auto no-scrollbar">
            {[
              { key: "menunggu", label: "Perlu Review", count: stats?.menunggu_review },
              { key: "disetujui", label: "Disetujui", count: stats?.disetujui },
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
                  setFilterUpr("");
                  setFilterSeverity("");
                }}
                className={`whitespace-nowrap px-4 py-1.5 rounded-full font-label-sm font-bold transition-colors ${
                  activeTab === tab.key
                    ? "bg-primary text-white"
                    : "bg-[#EEF3FA] text-[#476788]"
                }`}
              >
                {tab.label}
                {tab.count !== undefined ? ` (${tab.count})` : ""}
              </button>
            ))}
          </div>

          {viewMode === "map" ? (
            <SupervisorMapView reports={filteredReports} />
          ) : isFetching ? (
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
          ) : filteredReports.length === 0 ? (
            <div className="text-center py-12 text-[#476788]">
              <Icon name="inbox" className="!text-5xl mb-3 opacity-30" />
              <p className="font-body-md text-body-md">Belum ada laporan</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Select all checkbox */}
              {activeTab === "menunggu" &&
                filteredReports.some(
                  (r) => r.status === "Menunggu Review" || r.status === "Ditinjau",
                ) && (
                  <label className="flex items-center gap-2 px-1 text-sm text-[#476788] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={
                        selectedIds.size > 0 &&
                        selectedIds.size ===
                          filteredReports.filter(
                            (r) => r.status === "Menunggu Review" || r.status === "Ditinjau",
                          ).length
                      }
                      onChange={toggleSelectAll}
                      className="accent-primary"
                    />
                    Pilih semua
                  </label>
                )}
              {filteredReports.map((row) => {
                const sc = getSeverityLabel(row.overall_severity ?? row.ai_severity);
                const isSelected = selectedIds.has(row.id);
                return (
                  <div
                    key={row.id}
                    className={`bg-white rounded-lg overflow-hidden flex transition-colors ${
                      isSelected
                        ? "border border-primary ring-1 ring-primary/30"
                        : "border border-[#D0DAE8]"
                    }`}
                  >
                    <div className="self-stretch aspect-square shrink-0 bg-gray-50 overflow-hidden max-w-48">
                      {row.first_photo_url ? (
                        <img
                          src={row.first_photo_url}
                          alt={row.road_name}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      ) : row.batch_id && (row.photos_count ?? 0) > 0 ? (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="text-center">
                            <Icon
                              name="photo_library"
                              className="text-primary/60 !text-2xl mx-auto"
                            />
                            <span className="block text-[10px] text-primary/60 mt-0.5">
                              {row.photos_count} foto
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Icon name="photo" className="text-gray-300 !text-2xl" />
                        </div>
                      )}
                    </div>
                    <div className={`w-1.5 `} />
                    <div className="p-4 flex-1">
                      {/* Row 1: Report code + checkbox + batch (left), Status badge (right) */}
                      <div className="flex justify-between items-center mb-1.5 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          {activeTab === "menunggu" &&
                            (row.status === "Menunggu Review" || row.status === "Ditinjau") && (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelect(row.id)}
                                className="accent-primary"
                              />
                            )}
                          <span className="font-id-code text-id-code text-[#476788] bg-[#EEF3FA] px-2 py-0.5 rounded">
                            {row.report_code}
                          </span>
                          {row.batch_id && (row.photos_count ?? 0) > 0 && (
                            <span className="text-[10px] font-bold text-primary bg-primary/5 px-1.5 py-0.5 rounded border border-primary/20">
                              Batch {row.photos_count ?? ""}
                            </span>
                          )}
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-label-sm font-bold ${statusBadgeStyle(row.status)}`}
                        >
                          {displayStatus(row.status)}
                        </span>
                      </div>
                      <h4 className="text-xl font-bold text-[#0F1623] mb-2 leading-snug">
                        {row.road_name}
                      </h4>
                      {/* Badge columns — each label+badge stacked vertically */}
                      <div className="flex flex-wrap items-start gap-x-6 gap-y-2 mb-3">
                        {(row.overall_severity !== "Baik" || (row.ai_severity && row.ai_severity !== "baik")) && (
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-semibold text-[#476788]">Tingkat Kerusakan:</span>
                            <span
                              className={`inline-flex items-center gap-1 text-xs font-medium ${sc.chip} px-2 py-0.5 rounded self-start`}
                            >
                              <Icon name="warning" className="!text-[14px]" />
                              {row.overall_severity ?? row.ai_severity}
                            </span>
                          </div>
                        )}
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-semibold text-[#476788]">Tingkat Kepercayaan:</span>
                          <TrustBadge
                            score={row.trust_score ?? 0}
                            label={(row.trust_label as TrustLabel) ?? "merah"}
                            compact
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-semibold text-[#476788]">Status Deadline:</span>
                          <DeadlineBadge {...hitungStatusDeadline(row, isClient)} />
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[#476788] text-label-sm mb-3">
                        <div className="flex items-center gap-1">
                          <Icon name="location_on" className="!text-[14px]" />
                          <span>{row.district}</span>
                          {row.assigned_upr_name && (
                            <>
                              <span className="mx-0.5">·</span>
                              <span>{row.assigned_upr_name}</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Icon name="person" className="!text-[14px]" />
                          <span>{row.reporter_name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Icon name="calendar_month" className="!text-[14px]" />
                          <span>
                            {row.created_at
                              ? new Date(row.created_at).toLocaleDateString("id-ID", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "-"}
                          </span>
                        </div>
                        {row.kerusakan_panjang && (
                          <div className="flex items-center gap-1">
                            <Icon name="straighten" className="!text-[14px]" />
                            <span>
                              {row.kerusakan_panjang} m
                              {row.kerusakan_lebar ? ` × ${row.kerusakan_lebar} m` : ""}
                              {row.kerusakan_lebar
                                ? ` (${(row.kerusakan_panjang * row.kerusakan_lebar).toFixed(1)} m²)`
                                : ""}
                            </span>
                          </div>
                        )}
                        {(row as any).catatan_petugas && (
                          <div className="flex items-center gap-1">
                            <Icon name="edit_note" className="!text-[14px] shrink-0" />
                            <span className="text-xs text-[#476788] truncate max-w-[160px]">
                              {(row as any).catatan_petugas}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        {row.status === "Disetujui" && (
                          <>
                            <button
                              onClick={() => setMulaiTarget(row.id)}
                              disabled={actionLoading}
                              className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-all flex items-center gap-1"
                            >
                              → Mulai Pengerjaan
                            </button>
                          </>
                        )}
                        {row.status === "Sedang Diperbaiki" && (
                          <span className="px-4 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg border border-blue-200">
                            Sedang Diperbaiki
                          </span>
                        )}
                        {row.status === "Selesai" && (
                          <div className="flex gap-1">
                            <span className="px-4 py-1.5 bg-gray-100 text-gray-500 text-xs font-bold rounded-lg border border-gray-200">
                              Selesai
                            </span>
                          </div>
                        )}
                        <Link
                          to="/review"
                          search={{ reportId: row.id }}
                          className="px-4 py-1.5 bg-[#1A4F8A] text-white text-xs font-bold rounded-lg hover:bg-[#1A4F8A]/90 transition-all flex items-center gap-1.5 shadow-sm"
                        >
                          <Icon name="visibility" className="!text-[14px]" />
                          Detail
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        </main>

      {/* Mulai Pengerjaan modal */}
      {mulaiTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm space-y-4 shadow-lg border border-[#D0DAE8]">
            <h3 className="font-semibold text-gray-900">Mulai Pengerjaan</h3>
            <p className="text-xs text-gray-500">
              Tetapkan tim satgas untuk mengerjakan perbaikan.
            </p>
            <select
              value={mulaiUprId}
              onChange={(e) => setMulaiUprId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 outline-none"
            >
              <option value="">-- Pilih tim satgas --</option>
              {uprList.map((upr) => (
                <option key={upr.id} value={upr.id}>
                  {upr.name} {upr.wilayah ? `(${upr.wilayah})` : ""}
                </option>
              ))}
            </select>
            <textarea
              value={mulaiCatatan}
              onChange={(e) => setMulaiCatatan(e.target.value)}
              placeholder="Catatan untuk tim (opsional)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none h-20 focus:ring-2 focus:ring-blue-400 outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => handleMulai(mulaiTarget, mulaiUprId, mulaiCatatan)}
                disabled={actionLoading}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-40 transition-colors"
              >
                {actionLoading ? "Memproses..." : "Mulai Pengerjaan"}
              </button>
              <button
                onClick={() => {
                  setMulaiTarget(null);
                  setMulaiUprId("");
                  setMulaiCatatan("");
                }}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
export default SupervisorPage;
