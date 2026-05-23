import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Icon } from "@/components/jk/Icon";
import { BottomNav } from "@/components/jk/BottomNav";
import { AppLayout } from "@/components/jk/AppLayout";
import { TrustBadge } from "@/components/jk/TrustBadge";
import { API_BASE_URL } from "@/lib/aiStore";
import { getCurrentUser } from "@/lib/auth";
import type { Laporan, TrustLabel } from "@/types/laporan";

export const Route = createFileRoute("/supervisor")({
  component: SupervisorPage,
  head: () => ({ meta: [{ title: "Beranda Supervisor — JalanKita" }] }),
});

// ── Types ──────────────────────────────────────────────────────────────────

interface SupervisorStats {
  menunggu_review: number;
  hijau:           number;
  kuning:          number;
  merah:           number;
}

// ── Komponen ───────────────────────────────────────────────────────────────

function SupervisorPage() {
  const user = getCurrentUser();

  // State laporan
  const [laporan, setLaporan]   = useState<Laporan[]>([]);
  const [stats, setStats]       = useState<SupervisorStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // State modal tolak
  const [tolakTarget, setTolakTarget]   = useState<string | null>(null);
  const [tolakAlasan, setTolakAlasan]   = useState("");
  const [tolakCatatan, setTolakCatatan] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg]         = useState("");

  const token = localStorage.getItem('auth_token') ?? sessionStorage.getItem('auth_token') ?? '';

  // ── Load data laporan ────────────────────────────────────────────────────

  useEffect(() => {
    loadLaporan();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadLaporan() {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/reports?status=menunggu_review&limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const rows: Laporan[] = data.data ?? data ?? [];
        setLaporan(rows);

        // Hitung stats dari data yang ada
        const s: SupervisorStats = {
          menunggu_review: rows.filter(r => r.status === 'menunggu_review').length,
          hijau:           rows.filter(r => r.trust_label === 'hijau').length,
          kuning:          rows.filter(r => r.trust_label === 'kuning').length,
          merah:           rows.filter(r => r.trust_label === 'merah').length,
        };
        setStats(s);
      }
    } catch {
      // Gagal load — tampilkan data statis sebagai fallback
    } finally {
      setIsLoading(false);
    }
  }

  // ── Action handlers ──────────────────────────────────────────────────────

  async function handleApprove(id: string) {
    setActionLoading(true);
    setActionMsg("");
    try {
      const res = await fetch(`${API_BASE_URL}/reports/${id}/approve`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        setActionMsg("Laporan berhasil disetujui.");
        await loadLaporan();
      } else {
        setActionMsg("Gagal menyetujui laporan.");
      }
    } catch {
      setActionMsg("Terjadi kesalahan jaringan.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleTolak(id: string, alasan: string, catatan: string) {
    if (!alasan) return;
    setActionLoading(true);
    setActionMsg("");
    try {
      const res = await fetch(`${API_BASE_URL}/reports/${id}/tolak`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ alasan, catatan }),
      });
      if (res.ok) {
        setActionMsg("Laporan berhasil ditolak.");
        setTolakTarget(null);
        setTolakAlasan("");
        setTolakCatatan("");
        await loadLaporan();
      } else {
        setActionMsg("Gagal menolak laporan.");
      }
    } catch {
      setActionMsg("Terjadi kesalahan jaringan.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDisposisi(id: string) {
    setActionLoading(true);
    setActionMsg("");
    try {
      const res = await fetch(`${API_BASE_URL}/reports/${id}/disposisi`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        setActionMsg("Laporan berhasil didisposisi.");
        await loadLaporan();
      } else {
        setActionMsg("Gagal mendisposisi laporan.");
      }
    } catch {
      setActionMsg("Terjadi kesalahan jaringan.");
    } finally {
      setActionLoading(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'SV';

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen w-full pb-24">

        {/* Header */}
        <header className="flex justify-between items-center h-14 px-4 sticky top-0 z-40 bg-surface border-b border-border-subtle">
          <h1 className="text-headline-sm font-headline-sm font-bold text-primary-container">JalanKita</h1>
          <div className="flex items-center gap-4">
            <div className="relative flex items-center justify-center w-tap-target-min h-tap-target-min">
              <Icon name="notifications" className="text-on-surface-variant" />
              {stats && stats.menunggu_review > 0 && (
                <span className="absolute top-2 right-2 w-4 h-4 bg-error text-[10px] text-white flex items-center justify-center rounded-full font-bold">
                  {stats.menunggu_review > 9 ? '9+' : stats.menunggu_review}
                </span>
              )}
            </div>
            <div className="w-8 h-8 rounded-full bg-primary-container text-white flex items-center justify-center font-bold text-xs">
              {initials}
            </div>
          </div>
        </header>

        {/* Greeting */}
        <section className="bg-[#E8F0FA] px-margin-mobile py-lg">
          <h2 className="text-headline-sm font-headline-sm font-bold text-primary">
            Selamat pagi, {user?.name ?? 'Supervisor'}
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

        {/* ── Task 5A: Kartu ringkasan trust score ── */}
        <section className="px-margin-mobile -mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Menunggu Review', value: stats?.menunggu_review, color: 'blue'   },
              { label: '🟢 Kredibel',    value: stats?.hijau,           color: 'green'  },
              { label: '🟡 Perlu Review', value: stats?.kuning,          color: 'yellow' },
              { label: '🔴 Diragukan',   value: stats?.merah,           color: 'red'    },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className={`rounded-lg p-3 text-center bg-${color}-50 border border-${color}-200`}
              >
                <p className={`text-2xl font-bold text-${color}-700`}>
                  {isLoading ? '—' : (value ?? '—')}
                </p>
                <p className={`text-xs text-${color}-600 mt-0.5`}>{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pesan aksi */}
        {actionMsg && (
          <div className="mx-margin-mobile mb-3 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            {actionMsg}
          </div>
        )}

        {/* ── Tabel laporan dengan trust score (Task 5B) ── */}
        <section className="px-margin-mobile mt-2">
          <div className="flex justify-between items-center mb-md">
            <h3 className="text-headline-sm font-headline-sm font-bold text-primary">
              Laporan Menunggu Review
            </h3>
            <Link to="/reports" className="text-primary text-label-md font-bold">
              Lihat Semua
            </Link>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <span className="w-8 h-8 border-4 border-primary-container/30 border-t-primary-container rounded-full animate-spin" />
            </div>
          ) : laporan.length === 0 ? (
            /* Fallback: data statis jika API belum tersedia */
            <div className="flex flex-col gap-3">
              {[
                {
                  id: "LP-2024-006", street: "Jl. Raya Porong No. 7",
                  reporter: "Bambang Eko", sev: "Rusak Berat",
                  bar: "bg-rusak-berat", chip: "text-rusak-berat bg-rusak-berat/10",
                  trust_score: 85, trust_label: 'hijau' as TrustLabel,
                  status: 'menunggu_review',
                },
                {
                  id: "LP-2024-007", street: "Jl. Raya Krian No. 31",
                  reporter: "Dewi Rahayu", sev: "Rusak Sedang",
                  bar: "bg-rusak-sedang", chip: "text-rusak-sedang bg-rusak-sedang/10",
                  trust_score: 55, trust_label: 'kuning' as TrustLabel,
                  status: 'menunggu_review',
                },
                {
                  id: "LP-2024-010", street: "Jl. Raya Sedati",
                  reporter: "Rizky Firmansyah", sev: "Rusak Ringan",
                  bar: "bg-rusak-ringan", chip: "text-rusak-ringan bg-rusak-ringan/10",
                  trust_score: 30, trust_label: 'merah' as TrustLabel,
                  status: 'menunggu_review',
                },
              ].map((c) => (
                <div
                  key={c.id}
                  className="bg-surface-container-lowest border border-border-subtle rounded-xl overflow-hidden shadow-sm flex"
                >
                  <div className={`w-1.5 ${c.bar}`} />
                  <div className="p-md flex-1">
                    <div className="flex justify-between items-start mb-2 flex-wrap gap-2">
                      <span className="font-id-code text-id-code text-on-surface-variant bg-surface-container-low px-2 py-0.5 rounded">
                        {c.id}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`${c.chip} text-label-sm font-bold px-2 py-0.5 rounded`}>
                          {c.sev}
                        </span>
                        {/* Task 5B: Trust score badge */}
                        <TrustBadge score={c.trust_score} label={c.trust_label} />
                      </div>
                    </div>
                    <h4 className="text-body-lg font-bold text-on-surface mb-1">{c.street}</h4>
                    <div className="flex items-center gap-1 text-on-surface-variant text-label-md mb-3">
                      <Icon name="person" className="!text-[16px]" />
                      <span>Pelapor: {c.reporter}</span>
                    </div>
                    {/* Task 5C: Tombol aksi */}
                    <div className="flex gap-1.5 flex-wrap">
                      <button
                        onClick={() => handleApprove(c.id)}
                        disabled={c.status !== 'menunggu_review' || actionLoading}
                        className="px-2.5 py-1 bg-green-600 text-white text-xs rounded-lg
                                   hover:bg-green-700 disabled:opacity-40 transition-colors"
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() => setTolakTarget(c.id)}
                        disabled={c.status !== 'menunggu_review' || actionLoading}
                        className="px-2.5 py-1 bg-red-100 text-red-700 text-xs rounded-lg
                                   hover:bg-red-200 disabled:opacity-40 transition-colors"
                      >
                        ✕ Tolak
                      </button>
                      <Link
                        to="/review"
                        className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs rounded-lg
                                   hover:bg-blue-200 transition-colors"
                      >
                        Detail
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Data dari API */
            <div className="flex flex-col gap-3">
              {laporan.map((row) => {
                const severityColor = {
                  'Rusak Berat':   { bar: 'bg-rusak-berat',   chip: 'text-rusak-berat bg-rusak-berat/10'   },
                  'Rusak Sedang':  { bar: 'bg-rusak-sedang',  chip: 'text-rusak-sedang bg-rusak-sedang/10' },
                  'Rusak Ringan':  { bar: 'bg-rusak-ringan',  chip: 'text-rusak-ringan bg-rusak-ringan/10' },
                  'berat':         { bar: 'bg-rusak-berat',   chip: 'text-rusak-berat bg-rusak-berat/10'   },
                  'sedang':        { bar: 'bg-rusak-sedang',  chip: 'text-rusak-sedang bg-rusak-sedang/10' },
                  'ringan':        { bar: 'bg-rusak-ringan',  chip: 'text-rusak-ringan bg-rusak-ringan/10' },
                }[row.overall_severity ?? row.ai_severity ?? ''] ?? { bar: 'bg-gray-300', chip: 'text-gray-600 bg-gray-100' };

                return (
                  <div
                    key={row.id}
                    className="bg-surface-container-lowest border border-border-subtle rounded-xl overflow-hidden shadow-sm flex"
                  >
                    <div className={`w-1.5 ${severityColor.bar}`} />
                    <div className="p-md flex-1">
                      <div className="flex justify-between items-start mb-2 flex-wrap gap-2">
                        <span className="font-id-code text-id-code text-on-surface-variant bg-surface-container-low px-2 py-0.5 rounded">
                          {row.report_code}
                        </span>
                        <div className="flex items-center gap-2 flex-wrap">
                          {(row.overall_severity || row.ai_severity) && (
                            <span className={`${severityColor.chip} text-label-sm font-bold px-2 py-0.5 rounded`}>
                              {row.overall_severity ?? row.ai_severity}
                            </span>
                          )}
                          {/* Task 5B: Trust score badge */}
                          <TrustBadge
                            score={row.trust_score ?? 0}
                            label={(row.trust_label as TrustLabel) ?? 'merah'}
                          />
                        </div>
                      </div>
                      <h4 className="text-body-lg font-bold text-on-surface mb-1">{row.road_name}</h4>
                      <div className="flex items-center gap-1 text-on-surface-variant text-label-md mb-1">
                        <Icon name="location_on" className="!text-[14px]" />
                        <span>{row.district}</span>
                      </div>
                      <div className="flex items-center gap-1 text-on-surface-variant text-label-md mb-3">
                        <Icon name="person" className="!text-[16px]" />
                        <span>Pelapor: {row.reporter_name}</span>
                      </div>
                      {/* Task 5C: Tombol aksi */}
                      <div className="flex gap-1.5 flex-wrap">
                        <button
                          onClick={() => handleApprove(row.id)}
                          disabled={row.status !== 'menunggu_review' || actionLoading}
                          className="px-2.5 py-1 bg-green-600 text-white text-xs rounded-lg
                                     hover:bg-green-700 disabled:opacity-40 transition-colors"
                        >
                          ✓ Approve
                        </button>
                        <button
                          onClick={() => setTolakTarget(row.id)}
                          disabled={row.status !== 'menunggu_review' || actionLoading}
                          className="px-2.5 py-1 bg-red-100 text-red-700 text-xs rounded-lg
                                     hover:bg-red-200 disabled:opacity-40 transition-colors"
                        >
                          ✕ Tolak
                        </button>
                        <button
                          onClick={() => handleDisposisi(row.id)}
                          disabled={row.status !== 'disetujui' || actionLoading}
                          className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs rounded-lg
                                     hover:bg-blue-200 disabled:opacity-40 transition-colors"
                        >
                          → Disposisi
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Aktivitas Tim */}
        <section className="px-margin-mobile mt-xl mb-xl">
          <h3 className="text-headline-sm font-headline-sm font-bold text-primary mb-md">
            Aktivitas Tim
          </h3>
          <div className="bg-surface-container-lowest border border-border-subtle rounded-xl shadow-sm">
            {[
              {
                icon: "assignment_turned_in",
                bg: "bg-secondary-container text-on-secondary-container",
                txt: <><b>Rizky</b> memperbarui status <b>Selesai</b> pada LP-2024-002.</>,
                time: "2 menit yang lalu",
              },
              {
                icon: "photo_camera",
                bg: "bg-tertiary-fixed text-on-tertiary-fixed",
                txt: <><b>Dewi</b> mengunggah foto penanganan di <b>Jl. Krian</b>.</>,
                time: "15 menit yang lalu",
              },
              {
                icon: "warning",
                bg: "bg-error-container text-on-error-container",
                txt: <><b>Bambang</b> melaporkan kerusakan baru <b>Rusak Berat</b>.</>,
                time: "45 menit yang lalu",
              },
            ].map((a, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-md border-b border-border-subtle last:border-0"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${a.bg}`}>
                  <Icon name={a.icon} />
                </div>
                <div className="flex-1">
                  <p className="text-body-md text-on-surface leading-tight">{a.txt}</p>
                  <p className="text-label-sm text-outline mt-1">{a.time}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <BottomNav />
      </div>

      {/* ── Task 5C: Modal Tolak ── */}
      {tolakTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
            <h3 className="font-semibold text-gray-900">Tolak Laporan</h3>

            <select
              value={tolakAlasan}
              onChange={e => setTolakAlasan(e.target.value)}
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
              onChange={e => setTolakCatatan(e.target.value)}
              placeholder="Catatan tambahan untuk petugas (opsional)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none h-20 focus:ring-2 focus:ring-red-400 outline-none"
            />

            <div className="flex gap-2">
              <button
                onClick={() => handleTolak(tolakTarget, tolakAlasan, tolakCatatan)}
                disabled={!tolakAlasan || actionLoading}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm
                           hover:bg-red-700 disabled:opacity-40 transition-colors"
              >
                {actionLoading ? 'Memproses...' : 'Konfirmasi Tolak'}
              </button>
              <button
                onClick={() => { setTolakTarget(null); setTolakAlasan(""); setTolakCatatan(""); }}
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
