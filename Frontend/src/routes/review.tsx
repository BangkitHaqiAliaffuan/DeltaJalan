import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Icon } from "@/components/jk/Icon";
import { TrustBadge } from "@/components/jk/TrustBadge";
import { useState, useEffect, Fragment } from "react";
import { AppLayout } from "@/components/jk/AppLayout";
import { API_BASE_URL } from "@/lib/aiStore";
import { getToken, getCurrentUser } from "@/lib/auth";
import type { Laporan, TrustLabel } from "@/types/laporan";

export const Route = createFileRoute("/review")({
  component: ReviewPage,
  validateSearch: (search: Record<string, unknown>) => {
    const reportId = search.reportId as string | undefined;
    return { ...(reportId ? { reportId } : {}) };
  },
  head: () => ({ meta: [{ title: "Review Laporan — JalanKita" }] }),
});

function ReviewPage() {
  const { reportId } = Route.useSearch();
  const navigate = useNavigate();
  const token = getToken() ?? "";

  const [report, setReport] = useState<Laporan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [priority, setPriority] = useState<"Rendah" | "Sedang" | "Tinggi">("Tinggi");
  const [catatan, setCatatan] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  const [tolakAlasan, setTolakAlasan] = useState("");
  const [showTolak, setShowTolak] = useState(false);

  useEffect(() => {
    if (!reportId) {
      setError("ID laporan tidak ditemukan.");
      setLoading(false);
      return;
    }
    loadReport();
  }, [reportId]);

  async function loadReport() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/reports/${reportId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Gagal memuat laporan.");
      const json = await res.json();
      setReport(json.data ?? null);
    } catch {
      setError("Gagal memuat data laporan.");
    } finally {
      setLoading(false);
    }
  }

  function statusStep(s: string) {
    const steps = ["Menunggu Review", "Disetujui", "Sedang Diperbaiki", "Selesai"];
    const idx = steps.indexOf(s);
    return idx >= 0 ? idx + 1 : 0;
  }

  function severityBadge(sev: string | undefined | null) {
    const map: Record<string, string> = {
      "Rusak Berat": "bg-rusak-berat/10 text-rusak-berat border-rusak-berat/20",
      "Rusak Sedang": "bg-rusak-sedang/10 text-rusak-sedang border-rusak-sedang/20",
      "Rusak Ringan": "bg-rusak-ringan/10 text-rusak-ringan border-rusak-ringan/20",
      Baik: "bg-green-50 text-green-700 border-green-200",
    };
    return map[sev ?? ""] ?? "bg-gray-100 text-gray-600 border-gray-200";
  }

  async function handleApprove() {
    if (!report) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/reports/${report.id}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const json = await res.json();
      setActionMsg(json.message ?? (res.ok ? "Disetujui" : "Gagal"));
      if (res.ok) await loadReport();
    } catch {
      setActionMsg("Gagal menyetujui.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleTolak() {
    if (!report || !tolakAlasan) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/reports/${report.id}/tolak`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ alasan: tolakAlasan, catatan }),
      });
      const json = await res.json();
      setActionMsg(json.message ?? (res.ok ? "Ditolak" : "Gagal"));
      if (res.ok) {
        setShowTolak(false);
        setTolakAlasan("");
        setCatatan("");
        await loadReport();
      }
    } catch {
      setActionMsg("Gagal menolak.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSetujuiDanDisposisi() {
    if (!report) return;
    await handleApprove();
    if (report.status === "Disetujui") {
      const res = await fetch(`${API_BASE_URL}/reports/${report.id}/disposisi`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const json = await res.json();
      setActionMsg(json.message ?? (res.ok ? "Disetujui & didisposisi" : "Gagal disposisi"));
      if (res.ok) await loadReport();
    }
  }

  const detections: { type: string; confidence: number }[] =
    (report?.ai_raw_output as Array<{ type: string; confidence: number }> | null) ?? [];

  const topDetection = detections[0] ?? null;
  const hasImage = report?.image_original_url || report?.image_result_url;

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <span className="w-8 h-8 border-4 border-primary-container/30 border-t-primary-container rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (error || !report) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-screen gap-3 px-4">
          <Icon name="error" className="!text-5xl text-error opacity-50" />
          <p className="text-on-surface-variant">{error || "Laporan tidak ditemukan."}</p>
          <Link to="/supervisor" className="text-primary text-sm font-bold">
            Kembali ke Dashboard
          </Link>
        </div>
      </AppLayout>
    );
  }

  const step = statusStep(report.status);
  const steps = [
    { l: "Laporan Masuk", done: step > 1, active: step === 1 },
    { l: "Review", active: step === 2, done: step > 2 },
    { l: "Disposisi", active: step === 3, done: step > 3 },
    { l: "Selesai", active: step === 4, done: step > 4 },
  ];

  const sev = report.overall_severity ?? report.ai_severity ?? "";

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen w-full">
        <header className="sticky top-0 z-40 bg-surface border-b border-border-subtle flex justify-between items-center px-4 h-14">
          <div className="flex items-center gap-3">
            <Link to="/supervisor">
              <Icon name="arrow_back" className="text-primary" />
            </Link>
            <h1 className="font-headline-sm text-[17px] font-bold text-on-surface">
              Review Laporan
            </h1>
          </div>
          <span className="font-id-code text-[12px] text-slate-400">{report.report_code}</span>
        </header>

        {/* Action message */}
        {actionMsg && (
          <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 text-sm text-blue-800">
            {actionMsg}
          </div>
        )}

        {/* Progress steps */}
        <section className="bg-surface-container-lowest px-4 py-3 flex items-center justify-between overflow-x-auto hide-scrollbar border-b border-border-subtle">
          {steps.map((s, i, arr) => (
            <Fragment key={s.l}>
              <div className="flex flex-col items-center gap-1 min-w-[64px]">
                {s.done ? (
                  <div className="w-5 h-5 rounded-full bg-selesai flex items-center justify-center">
                    <Icon name="check" className="!text-[14px] text-white" weight={700} />
                  </div>
                ) : s.active ? (
                  <div className="w-5 h-5 rounded-full bg-primary-container flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-border-subtle" />
                )}
                <span
                  className={`font-label-sm text-[10px] text-center whitespace-nowrap ${s.active ? "text-primary-container font-bold" : s.done ? "text-on-surface-variant" : "text-slate-400"}`}
                >
                  {s.l}
                </span>
              </div>
              {i < arr.length - 1 && (
                <div
                  className={`h-px flex-1 mx-1 min-w-[20px] ${s.done ? "bg-selesai" : s.active ? "bg-primary-container" : "bg-border-subtle"}`}
                />
              )}
            </Fragment>
          ))}
        </section>

        <main className="flex-1 p-4 flex flex-col gap-4 pb-[120px]">
          {/* Info laporan */}
          <div className="bg-white rounded-xl border border-border-subtle p-4 shadow-sm">
            <h2 className="font-headline-sm text-base font-bold text-on-surface mb-3">
              {report.road_name}
            </h2>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-slate-600">
                <Icon name="location_pin" className="!text-[18px]" />
                <span className="text-[13px]">Kec. {report.district}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-slate-400">
                  <Icon name="calendar_month" className="!text-[18px]" />
                  <span className="text-[12px]">
                    {report.created_at
                      ? new Date(report.created_at).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })
                      : "-"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <Icon name="person" className="!text-[18px]" />
                  <span className="text-[12px]">{report.reporter_name}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <TrustBadge
                  score={report.trust_score}
                  label={(report.trust_label as TrustLabel) ?? "merah"}
                />
                {sev && (
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded border ${severityBadge(sev)}`}
                  >
                    {sev}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Hasil AI */}
          {hasImage && (
            <div className="bg-white rounded-xl border border-border-subtle overflow-hidden shadow-sm">
              <div className="relative aspect-video bg-slate-100">
                <img
                  className="w-full h-full object-contain"
                  src={report.image_result_url ?? report.image_original_url ?? ""}
                  alt="Road damage"
                />
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-label-md text-on-surface font-bold">Hasil Deteksi AI</h3>
                </div>
                {topDetection ? (
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-[11px] text-on-surface-variant mb-1">Jenis Kerusakan</p>
                      <p className="text-sm font-semibold text-on-surface">{topDetection.type}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-on-surface-variant mb-1">Tingkat</p>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-error-container text-error border border-error/20">
                        {sev || "Tidak diketahui"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Tidak ada data deteksi AI.</p>
                )}
                {detections.length > 0 && (
                  <div>
                    <p className="text-[11px] text-on-surface-variant mb-1.5">Semua Deteksi</p>
                    <div className="space-y-1">
                      {detections.map((d, i) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span>{d.type}</span>
                          <span className="font-bold">{(d.confidence * 100).toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(report.total_detections ?? 0) > 0 && (
                  <p className="text-[11px] text-on-surface-variant mt-2">
                    Total deteksi: {report.total_detections ?? 0}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Foto asli */}
          {report.image_original_url && (
            <div className="bg-white rounded-xl border border-border-subtle overflow-hidden shadow-sm">
              <div className="p-3 border-b border-border-subtle">
                <h3 className="font-label-md font-bold text-on-surface">Foto Asli</h3>
              </div>
              <div className="relative aspect-video bg-slate-100">
                <img
                  className="w-full h-full object-contain"
                  src={report.image_original_url}
                  alt="Original"
                />
              </div>
            </div>
          )}

          {/* Foto bukti */}
          {(report as any).evidences?.length > 0 && (
            <div className="bg-white rounded-xl border border-border-subtle p-4 shadow-sm">
              <h3 className="font-label-md font-bold text-on-surface mb-3">Foto Bukti Tambahan</h3>
              <div className="grid grid-cols-2 gap-2">
                {(report as any).evidences.map((e: any) => (
                  <div key={e.id} className="aspect-video rounded-lg overflow-hidden bg-slate-100">
                    <img className="w-full h-full object-cover" src={e.image_url} alt="Evidence" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* System notes */}
          {report.system_notes && (
            <div className="bg-white rounded-xl border border-border-subtle p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="info" className="text-primary !text-[18px]" />
                <h3 className="font-label-md font-bold text-on-surface">Catatan Sistem</h3>
              </div>
              <p className="text-xs text-slate-600 whitespace-pre-wrap">{report.system_notes}</p>
            </div>
          )}

          {/* Penilaian Supervisor (hanya kalo masih Menunggu Review) */}
          {report.status === "Menunggu Review" && (
            <div className="bg-white rounded-xl border border-border-subtle p-4 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Icon name="format_text_clip" className="text-primary" />
                  <h3 className="font-label-md font-bold text-on-surface">Penilaian Supervisor</h3>
                </div>
                <span className="bg-orange-50 text-orange-600 text-[10px] font-bold px-2 py-0.5 rounded border border-orange-200 uppercase">
                  Wajib Diisi
                </span>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-[12px] font-medium text-slate-600 mb-2.5">
                    Prioritas Penanganan
                  </label>
                  <div className="flex gap-2">
                    {(["Rendah", "Sedang", "Tinggi"] as const).map((p) => {
                      const active = priority === p;
                      return (
                        <button
                          key={p}
                          onClick={() => setPriority(p)}
                          className={`flex-1 py-2 text-[12px] font-semibold rounded-lg border ${
                            active
                              ? p === "Tinggi"
                                ? "bg-rusak-berat text-white border-transparent shadow-sm"
                                : "bg-primary-container text-white border-transparent shadow-sm"
                              : "bg-white border-border-subtle text-slate-500"
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-slate-600 mb-1.5">
                    Catatan Supervisor
                  </label>
                  <textarea
                    value={catatan}
                    onChange={(e) => setCatatan(e.target.value)}
                    placeholder="Tambahkan instruksi khusus di sini..."
                    className="w-full border border-border-subtle rounded-lg p-3 text-sm bg-slate-50 min-h-[80px] outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Modal tolak */}
          {showTolak && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
              <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
                <h3 className="font-semibold text-gray-900">Tolak Laporan</h3>
                <select
                  value={tolakAlasan}
                  onChange={(e) => setTolakAlasan(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">-- Pilih alasan --</option>
                  <option value="koordinat_tidak_valid">Koordinat tidak valid</option>
                  <option value="foto_tidak_jelas">Foto tidak jelas</option>
                  <option value="bukan_kerusakan_jalan">Bukan kerusakan jalan</option>
                  <option value="duplikat">Duplikat laporan lain</option>
                  <option value="lainnya">Lainnya</option>
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={handleTolak}
                    disabled={!tolakAlasan || actionLoading}
                    className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm disabled:opacity-40"
                  >
                    {actionLoading ? "Memproses..." : "Konfirmasi Tolak"}
                  </button>
                  <button
                    onClick={() => {
                      setShowTolak(false);
                      setTolakAlasan("");
                    }}
                    className="flex-1 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Footer actions */}
        <footer className="sticky bottom-0 bg-white border-t border-border-subtle p-4 flex gap-3 z-50">
          {report.status === "Menunggu Review" ? (
            <>
              <button
                onClick={() => setShowTolak(true)}
                disabled={actionLoading}
                className="flex-1 h-tap-target-min border-2 border-rusak-berat text-rusak-berat font-bold rounded-xl text-sm active:scale-95 transition-all disabled:opacity-40"
              >
                Tolak Laporan
              </button>
              <button
                onClick={handleSetujuiDanDisposisi}
                disabled={actionLoading}
                className="flex-[2] h-tap-target-min bg-primary-container text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-40"
              >
                <Icon name="check_circle" className="!text-[20px]" filled />
                {actionLoading ? "Memproses..." : "Setujui & Disposisi"}
              </button>
            </>
          ) : report.status === "Disetujui" ? (
            <button
              onClick={() => navigate({ to: "/supervisor" })}
              className="flex-1 h-tap-target-min bg-primary-container text-white font-bold rounded-xl text-sm"
            >
              Kembali ke Dashboard
            </button>
          ) : (
            <Link
              to="/supervisor"
              className="flex-1 h-tap-target-min bg-primary-container text-white font-bold rounded-xl text-sm flex items-center justify-center"
            >
              Kembali ke Dashboard
            </Link>
          )}
        </footer>
      </div>
    </AppLayout>
  );
}
