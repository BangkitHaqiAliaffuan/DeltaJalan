import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { Icon } from "@/components/jk/Icon";
import { BottomNav } from "@/components/jk/BottomNav";
import { AppLayout } from "@/components/jk/AppLayout";
import { TrustBadge } from "@/components/jk/TrustBadge";
import { API_BASE_URL } from "@/lib/aiStore";
import { getCurrentUser, getToken, clearAuth } from "@/lib/auth";
import type { Laporan, TrustLabel } from "@/types/laporan";

export const Route = createFileRoute("/supervisor")({
  component: SupervisorPage,
  head: () => ({ meta: [{ title: "Beranda Supervisor — JalanKita" }] }),
});

interface SupervisorStats {
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

  const [laporan, setLaporan] = useState<Laporan[]>([]);
  const [stats, setStats] = useState<SupervisorStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"menunggu" | "semua">("menunggu");

  const [tolakTarget, setTolakTarget] = useState<string | null>(null);
  const [tolakAlasan, setTolakAlasan] = useState("");
  const [tolakCatatan, setTolakCatatan] = useState("");

  const [mulaiTarget, setMulaiTarget] = useState<string | null>(null);
  const [mulaiUprId, setMulaiUprId] = useState("");
  const [mulaiCatatan, setMulaiCatatan] = useState("");
  const [uprList, setUprList] = useState<{ id: number; name: string; wilayah: string }[]>([]);

  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [actionMsgType, setActionMsgType] = useState<"success" | "error">("success");

  const token = getToken() ?? "";

  useEffect(() => {
    loadData();
    loadUprs();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      await Promise.all([loadLaporan(), loadStats()]);
    } catch {
      // fallback silent
    } finally {
      setIsLoading(false);
    }
  }

  async function loadUprs() {
    try {
      const res = await fetch(`${API_BASE_URL}/uprs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setUprList(json.data ?? []);
      }
    } catch {}
  }

  async function loadLaporan() {
    const params = activeTab === "menunggu" ? "?status=menunggu_review&limit=50" : "?limit=50";
    const res = await fetch(`${API_BASE_URL}/reports${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const json = await res.json();
      setLaporan(json.data ?? []);
    }
  }

  async function loadStats() {
    const res = await fetch(`${API_BASE_URL}/reports/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const json = await res.json();
      setStats(json.data ?? null);
    }
  }

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
        showMsg(json.message ?? "Laporan berhasil disetujui.");
        await loadData();
      } else {
        showMsg(json.message ?? "Gagal menyetujui laporan.", "error");
      }
    } catch {
      showMsg("Terjadi kesalahan jaringan.", "error");
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
        showMsg(json.message ?? "Laporan berhasil ditolak.");
        setTolakTarget(null);
        setTolakAlasan("");
        setTolakCatatan("");
        await loadData();
      } else {
        showMsg(json.message ?? "Gagal menolak laporan.", "error");
      }
    } catch {
      showMsg("Terjadi kesalahan jaringan.", "error");
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
        showMsg(json.message ?? "Perbaikan telah dimulai.");
        setMulaiTarget(null);
        setMulaiUprId("");
        setMulaiCatatan("");
        await loadData();
      } else {
        showMsg(json.message ?? "Gagal memulai perbaikan.", "error");
      }
    } catch {
      showMsg("Terjadi kesalahan jaringan.", "error");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDisposisi(id: string) {
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/reports/${id}/disposisi`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (res.ok) {
        showMsg(json.message ?? "Laporan berhasil didisposisi.");
        await loadData();
      } else {
        showMsg(json.message ?? "Gagal mendisposisi laporan.", "error");
      }
    } catch {
      showMsg("Terjadi kesalahan jaringan.", "error");
    } finally {
      setActionLoading(false);
    }
  }

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "SV";

  // Profile dropdown
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!profileOpen) return;
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [profileOpen]);

  async function handleLogout() {
    const token = getToken();
    if (token) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {}
    }
    clearAuth();
    navigate({ to: "/" });
  }

  function getSeverityColor(severity: string | undefined | null) {
    const map: Record<string, { bar: string; chip: string }> = {
      "Rusak Berat": { bar: "bg-rusak-berat", chip: "text-rusak-berat bg-rusak-berat/10" },
      "Rusak Sedang": { bar: "bg-rusak-sedang", chip: "text-rusak-sedang bg-rusak-sedang/10" },
      "Rusak Ringan": { bar: "bg-rusak-ringan", chip: "text-rusak-ringan bg-rusak-ringan/10" },
      berat: { bar: "bg-rusak-berat", chip: "text-rusak-berat bg-rusak-berat/10" },
      sedang: { bar: "bg-rusak-sedang", chip: "text-rusak-sedang bg-rusak-sedang/10" },
      ringan: { bar: "bg-rusak-ringan", chip: "text-rusak-ringan bg-rusak-ringan/10" },
    };
    return map[severity ?? ""] ?? { bar: "bg-gray-300", chip: "text-gray-600 bg-gray-100" };
  }

  function statusBadge(status: string) {
    const map: Record<string, string> = {
      "Menunggu Review": "bg-amber-100 text-amber-800",
      Disetujui: "bg-green-100 text-green-800",
      Ditolak: "bg-red-100 text-red-800",
      "Sedang Diperbaiki": "bg-blue-100 text-blue-800",
      Selesai: "bg-gray-100 text-gray-800",
    };
    return map[status] ?? "bg-gray-100 text-gray-600";
  }

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen w-full pb-24">
        {/* Header */}
        <header className="flex justify-between items-center h-14 px-4 sticky top-0 z-40 bg-surface border-b border-border-subtle">
          <h1 className="text-headline-sm font-headline-sm font-bold text-primary-container">
            JalanKita
          </h1>
          <div className="flex items-center gap-4">
            <div className="relative flex items-center justify-center w-tap-target-min h-tap-target-min">
              <Icon name="notifications" className="text-on-surface-variant" />
              {stats && stats.menunggu_review > 0 && (
                <span className="absolute top-2 right-2 w-4 h-4 bg-error text-[10px] text-white flex items-center justify-center rounded-full font-bold">
                  {stats.menunggu_review > 9 ? "9+" : stats.menunggu_review}
                </span>
              )}
            </div>
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileOpen(!profileOpen)}
                className="w-8 h-8 rounded-full bg-primary-container text-white flex items-center justify-center font-bold text-xs hover:opacity-90 transition-opacity"
              >
                {initials}
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-border-subtle overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-border-subtle">
                    <p className="font-label-md text-label-md font-semibold text-on-surface truncate">
                      {user?.name ?? "Supervisor"}
                    </p>
                    <p className="text-[11px] text-on-surface-variant capitalize">
                      {user?.role === "supervisor" ? "Supervisor" : "Petugas Lapangan"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-3 text-[13px] text-on-surface font-medium hover:bg-surface-container-low transition-colors active:bg-surface-container"
                  >
                    <Icon name="logout" className="!text-[18px] text-on-surface-variant" />
                    Keluar
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Greeting */}
        <section className="bg-[#E8F0FA] px-margin-mobile py-lg">
          <h2 className="text-headline-sm font-headline-sm font-bold text-primary">
            Selamat pagi, {user?.name ?? "Supervisor"}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="px-2 py-0.5 bg-selesai/10 text-selesai text-label-sm font-bold rounded border border-selesai/20 uppercase tracking-wide">
              Supervisor
            </span>
            {user?.wilayah && (
              <span className="text-on-surface-variant text-label-md font-label-md">
                · {user.wilayah}
              </span>
            )}
          </div>
        </section>

        {/* Stats cards */}
        <section className="px-margin-mobile -mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Menunggu Review", value: stats?.menunggu_review, color: "blue" },
              { label: "Disetujui", value: stats?.disetujui, color: "green" },
              { label: "Ditolak", value: stats?.ditolak, color: "red" },
              { label: "Diperbaiki", value: stats?.sedang_diperbaiki, color: "orange" },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="rounded-lg p-3 text-center bg-surface-container-lowest border border-border-subtle"
              >
                <p className={`text-2xl font-bold text-${color}-700`}>
                  {isLoading ? "—" : (value ?? 0)}
                </p>
                <p className={`text-xs text-${color}-600 mt-0.5`}>{label}</p>
              </div>
            ))}
          </div>

          {/* Trust score breakdown */}
          <div className="flex gap-2 mb-6 text-xs">
            {[
              { label: "🟢 Kredibel", value: stats?.trust_hijau },
              { label: "🟡 Perlu Review", value: stats?.trust_kuning },
              { label: "🔴 Diragukan", value: stats?.trust_merah },
            ].map(({ label, value }) => (
              <span
                key={label}
                className="px-2 py-1 rounded-full bg-surface-container-low text-on-surface-variant"
              >
                {label}: {value ?? 0}
              </span>
            ))}
          </div>
        </section>

        {/* Action message */}
        {actionMsg && (
          <div
            className={`mx-margin-mobile mb-3 px-4 py-2 rounded-lg text-sm ${
              actionMsgType === "success"
                ? "bg-green-50 border border-green-200 text-green-800"
                : "bg-red-50 border border-red-200 text-red-800"
            }`}
          >
            {actionMsg}
          </div>
        )}

        {/* Tab filter */}
        <section className="px-margin-mobile mb-3">
          <div className="flex gap-2">
            <button
              onClick={() => {
                setActiveTab("menunggu");
                loadLaporan();
              }}
              className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors ${
                activeTab === "menunggu"
                  ? "bg-primary-container text-white"
                  : "bg-surface-container-low text-on-surface-variant"
              }`}
            >
              Menunggu Review {stats?.menunggu_review ? `(${stats.menunggu_review})` : ""}
            </button>
            <button
              onClick={() => {
                setActiveTab("semua");
                loadLaporan();
              }}
              className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors ${
                activeTab === "semua"
                  ? "bg-primary-container text-white"
                  : "bg-surface-container-low text-on-surface-variant"
              }`}
            >
              Semua Laporan
            </button>
          </div>
        </section>

        {/* Report list */}
        <section className="px-margin-mobile">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <span className="w-8 h-8 border-4 border-primary-container/30 border-t-primary-container rounded-full animate-spin" />
            </div>
          ) : laporan.length === 0 ? (
            <div className="text-center py-12 text-on-surface-variant">
              <Icon name="inbox" className="!text-5xl mb-3 opacity-30" />
              <p className="text-body-md">Belum ada laporan</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {laporan.map((row) => {
                const sc = getSeverityColor(row.overall_severity ?? row.ai_severity);
                return (
                  <div
                    key={row.id}
                    className="bg-surface-container-lowest border border-border-subtle rounded-xl overflow-hidden shadow-sm flex"
                  >
                    <div className={`w-1.5 ${sc.bar}`} />
                    <div className="p-md flex-1">
                      <div className="flex justify-between items-start mb-2 flex-wrap gap-2">
                        <span className="font-id-code text-id-code text-on-surface-variant bg-surface-container-low px-2 py-0.5 rounded">
                          {row.report_code}
                        </span>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded text-label-sm font-bold ${statusBadge(row.status)}`}
                          >
                            {row.status}
                          </span>
                          {(row.overall_severity || row.ai_severity) && (
                            <span
                              className={`${sc.chip} text-label-sm font-bold px-2 py-0.5 rounded`}
                            >
                              {row.overall_severity ?? row.ai_severity}
                            </span>
                          )}
                          <TrustBadge
                            score={row.trust_score ?? 0}
                            label={(row.trust_label as TrustLabel) ?? "merah"}
                          />
                        </div>
                      </div>
                      <h4 className="text-body-lg font-bold text-on-surface mb-1">
                        {row.road_name}
                      </h4>
                      <div className="flex items-center gap-1 text-on-surface-variant text-label-md mb-1">
                        <Icon name="location_on" className="!text-[14px]" />
                        <span>{row.district}</span>
                      </div>
                      <div className="flex items-center gap-1 text-on-surface-variant text-label-md mb-3">
                        <Icon name="person" className="!text-[16px]" />
                        <span>Pelapor: {row.reporter_name}</span>
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        {row.status === "Menunggu Review" && (
                          <>
                            <button
                              onClick={() => handleApprove(row.id)}
                              disabled={actionLoading}
                              className="px-2.5 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 disabled:opacity-40 transition-colors"
                            >
                              ✓ Approve
                            </button>
                            <button
                              onClick={() => setTolakTarget(row.id)}
                              disabled={actionLoading}
                              className="px-2.5 py-1 bg-red-100 text-red-700 text-xs rounded-lg hover:bg-red-200 disabled:opacity-40 transition-colors"
                            >
                              ✕ Tolak
                            </button>
                          </>
                        )}
                        {row.status === "Disetujui" && (
                          <>
                            <button
                              onClick={() => setMulaiTarget(row.id)}
                              disabled={actionLoading}
                              className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs rounded-lg hover:bg-blue-200 disabled:opacity-40 transition-colors"
                            >
                              → Mulai Pengerjaan
                            </button>
                            <button
                              onClick={() => handleDisposisi(row.id)}
                              disabled={actionLoading}
                              className="px-2.5 py-1 bg-blue-50 text-blue-500 text-xs rounded-lg hover:bg-blue-100 disabled:opacity-40 transition-colors"
                            >
                              Disposisi
                            </button>
                          </>
                        )}
                        {row.status === "Sedang Diperbaiki" && (
                          <Link
                            to="/complete"
                            search={{ reportId: row.id }}
                            className="px-2.5 py-1 bg-green-100 text-green-700 text-xs rounded-lg hover:bg-green-200 transition-colors"
                          >
                            ✓ Selesaikan
                          </Link>
                        )}
                        {row.status === "Selesai" && (
                          <span className="px-2.5 py-1 bg-gray-100 text-gray-400 text-xs rounded-lg">
                            ✓ Selesai
                          </span>
                        )}
                        <Link
                          to="/review"
                          search={{ reportId: row.id }}
                          className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs rounded-lg hover:bg-gray-200 transition-colors"
                        >
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

        <BottomNav />
      </div>

      {/* Tolak modal */}
      {tolakTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
            <h3 className="font-semibold text-gray-900">Tolak Laporan</h3>
            <select
              value={tolakAlasan}
              onChange={(e) => setTolakAlasan(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-400 outline-none"
            >
              <option value="">-- Pilih alasan --</option>
              <option value="koordinat_tidak_valid">Koordinat tidak valid</option>
              <option value="foto_tidak_jelas">Foto tidak jelas</option>
              <option value="bukan_kerusakan_jalan">Bukan kerusakan jalan</option>
              <option value="duplikat">Duplikat laporan lain</option>
              <option value="lainnya">Lainnya</option>
            </select>
            <textarea
              value={tolakCatatan}
              onChange={(e) => setTolakCatatan(e.target.value)}
              placeholder="Catatan tambahan untuk petugas (opsional)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none h-20 focus:ring-2 focus:ring-red-400 outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => handleTolak(tolakTarget, tolakAlasan, tolakCatatan)}
                disabled={!tolakAlasan || actionLoading}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-40 transition-colors"
              >
                {actionLoading ? "Memproses..." : "Konfirmasi Tolak"}
              </button>
              <button
                onClick={() => {
                  setTolakTarget(null);
                  setTolakAlasan("");
                  setTolakCatatan("");
                }}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mulai Pengerjaan modal */}
      {mulaiTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
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
    </AppLayout>
  );
}
