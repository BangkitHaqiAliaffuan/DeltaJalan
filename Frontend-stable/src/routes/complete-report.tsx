import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { Icon } from "@/components/jk/Icon";
import { PageLayout } from "@/components/jk/PageLayout";
import { Portal } from "@/components/jk/Portal";
import { API_BASE_URL } from "@/lib/aiStore";
import { getToken, getCurrentUser } from "@/lib/auth";
import type { Laporan } from "@/types/laporan";

export const Route = createFileRoute("/complete-report")({
  component: CompleteReportPage,
  validateSearch: (search: Record<string, unknown>) => {
    const reportId = search.reportId as string | undefined;
    return { ...(reportId ? { reportId } : {}) };
  },
  head: () => ({ meta: [{ title: "Selesaikan Laporan — DeltaJalan" }] }),
});

function CompleteReportPage() {
  const { reportId } = Route.useSearch();
  const navigate = useNavigate();
  const token = getToken() ?? "";
  const [backUrl, setBackUrl] = useState("/supervisor");
  useEffect(() => {
    setBackUrl(getCurrentUser()?.role === "petugas_eksekusi" ? "/petugas-eksekusi" : "/supervisor");
  }, []);

  const [report, setReport] = useState<Laporan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [afterFiles, setAfterFiles] = useState<File[]>([]);
  const [afterPreviews, setAfterPreviews] = useState<string[]>([]);
  const [catatan, setCatatan] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);

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

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newFiles: File[] = [];
    const newPreviews: string[] = [];
    for (let i = 0; i < files.length; i++) {
      newFiles.push(files[i]);
      newPreviews.push(URL.createObjectURL(files[i]));
    }
    setAfterFiles((prev) => [...prev, ...newFiles]);
    setAfterPreviews((prev) => [...prev, ...newPreviews]);
    if (fileRef.current) fileRef.current.value = "";
  }

  function removeFile(index: number) {
    setAfterFiles((prev) => prev.filter((_, i) => i !== index));
    setAfterPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!report || afterFiles.length === 0) return;
    setSubmitting(true);
    setErrorMsg("");
    try {
      const formData = new FormData();
      for (const file of afterFiles) {
        formData.append("after_photo[]", file);
      }
      if (catatan) formData.append("catatan", catatan);

      const res = await fetch(`${API_BASE_URL}/reports/${report.id}/complete`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const json = await res.json();
      if (res.ok) {
        setSuccessMsg(json.message ?? "Laporan berhasil diselesaikan!");
        setTimeout(() => navigate({ to: backUrl }), 3000);
      } else {
        setErrorMsg(json.message ?? "Gagal menyelesaikan laporan.");
      }
    } catch {
      setErrorMsg("Terjadi kesalahan jaringan.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <PageLayout showBrand back={backUrl}>
        <div className="flex items-center justify-center h-full">
          <span className="w-8 h-8 border-4 border-primary-container/30 border-t-primary-container rounded-full animate-spin" />
        </div>
      </PageLayout>
    );
  }

  if (error || !report) {
    return (
      <PageLayout showBrand back={backUrl}>
        <div className="flex flex-col items-center justify-center text-on-surface-variant px-4">
          <Icon name="error_outline" className="!text-5xl mb-3 opacity-30" />
          <p className="text-body-md">{error || "Laporan tidak ditemukan."}</p>
          <Link to={backUrl} className="mt-4 text-primary text-sm font-semibold">
            Kembali ke Dashboard
          </Link>
        </div>
      </PageLayout>
    );
  }

  const isSedangDiperbaiki = report.status === "Sedang Diperbaiki";

  return (
    <PageLayout showBrand back={backUrl}>
      <div>
      <div className="px-margin-mobile py-lg max-w-lg mx-auto">
        <h2 className="text-headline-sm font-headline-sm font-bold text-on-surface mb-1">
          Selesaikan Laporan
        </h2>
        <p className="text-label-md text-on-surface-variant mb-6">
          Upload foto setelah perbaikan untuk menutup laporan.
        </p>

        {!isSedangDiperbaiki && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-amber-800 font-semibold">
              Laporan ini berstatus "{report.status}"
            </p>
            <p className="text-xs text-amber-700 mt-1">
              Hanya laporan dengan status "Sedang Diperbaiki" yang bisa diselesaikan.
            </p>
            <Link to={backUrl} className="text-sm text-blue-600 font-semibold mt-2 inline-block">
              Kembali ke Dashboard
            </Link>
          </div>
        )}

        {/* Ringkasan laporan */}
        <div className="bg-white border border-[#D0DAE8] rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="font-id-code text-id-code text-on-surface-variant bg-surface-container-low px-2 py-0.5 rounded">
              {report.report_code}
            </span>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-label-sm font-bold rounded">
              {report.status}
            </span>
          </div>
          <h3 className="text-body-lg font-bold text-on-surface">{report.road_name}</h3>
          <p className="text-label-md text-on-surface-variant mt-1">{report.district}</p>
          <p className="text-label-md text-on-surface-variant">Pelapor: {report.reporter_name}</p>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm text-red-800">
            {errorMsg}
          </div>
        )}

        {/* Foto after */}
        <div className="mb-6">
          <label className="block text-label-md font-semibold text-on-surface mb-2">
            Foto Setelah Perbaikan <span className="text-error">*</span>
          </label>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png"
            capture="environment"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />

          {afterPreviews.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {afterPreviews.map((preview, i) => (
                <div key={i} className="relative rounded-lg overflow-hidden border border-[#D0DAE8] aspect-square">
                  <img
                    src={preview}
                    alt={`Foto after ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="absolute top-1.5 right-1.5 w-7 h-7 bg-black/50 text-white rounded-full flex items-center justify-center"
                  >
                    <Icon name="close" className="!text-[14px]" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={!isSedangDiperbaiki}
                className="aspect-square border-2 border-dashed border-[#D0DAE8] rounded-lg flex flex-col items-center justify-center gap-1 text-on-surface-variant hover:bg-surface-container-low transition-colors disabled:opacity-40"
              >
                <Icon name="add_a_photo" className="!text-2xl" />
                <span className="text-[11px]">Tambah</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={!isSedangDiperbaiki}
              className="w-full h-48 border-2 border-dashed border-[#D0DAE8] rounded-lg flex flex-col items-center justify-center gap-2 text-on-surface-variant hover:bg-surface-container-low transition-colors disabled:opacity-40"
            >
              <Icon name="camera_alt" className="!text-4xl" />
              <span className="text-label-md">Ambil atau pilih foto</span>
            </button>
          )}
        </div>

        {/* Catatan */}
        <div className="mb-8">
          <label className="block text-label-md font-semibold text-on-surface mb-2">
            Catatan (opsional)
          </label>
          <textarea
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="Deskripsi perbaikan yang dilakukan..."
            className="w-full border border-[#C0CEDF] rounded-lg px-4 py-3 text-sm resize-none h-24 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
          />
        </div>

        {/* Submit button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={afterFiles.length === 0 || submitting || !isSedangDiperbaiki}
          className="w-full py-3 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-[#163F6E] disabled:opacity-40 transition-all flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Menyelesaikan...
            </>
          ) : (
            "✓ Selesaikan Laporan"
          )}
        </button>
      </div>
      </div>

      {successMsg && (
        <Portal>
          <style>{`
            @keyframes pop-in {
              from { opacity: 0; transform: scale(0.9) translateY(10px); }
              to { opacity: 1; transform: scale(1) translateY(0); }
            }
            .popup-anim { animation: pop-in 0.35s ease-out; }
          `}</style>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl px-8 py-10 flex flex-col items-center gap-4 popup-anim max-w-sm w-full mx-4">
              <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                <Icon name="verified" className="!text-[48px] text-[#16A34A]" />
              </div>
              <p className="text-lg font-bold text-[#0F172A] text-center">{successMsg}</p>
              <p className="text-sm text-[#475569] text-center leading-relaxed">Mengalihkan ke dashboard…</p>
              <button
                type="button"
                onClick={() => navigate({ to: backUrl })}
                className="w-full px-4 py-2.5 text-[13px] font-bold text-white bg-[#16A34A] rounded-xl hover:bg-[#15803D] transition-all flex items-center justify-center gap-1.5"
              >
                <Icon name="dashboard" className="!text-[14px]" />
                Ke Dashboard
              </button>
            </div>
          </div>
        </Portal>
      )}
    </PageLayout>
  );
}
