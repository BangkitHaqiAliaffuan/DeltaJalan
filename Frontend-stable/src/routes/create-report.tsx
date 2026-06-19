import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Icon } from "@/components/jk/Icon";
import { PageLayout } from "@/components/jk/PageLayout";
import { Portal } from "@/components/jk/Portal";
import { getCurrentUser, getToken } from "@/lib/auth";
import {
  SEVERITY_CONFIG,
  getSeverityConfig,
  getAiResult,
  getFormData,
  clearAiStore,
  API_BASE_URL,
} from "@/lib/aiStore";
import { useState, useEffect } from "react";
import { snapToRoad } from "@/lib/geo";

export const Route = createFileRoute("/create-report")({
  component: CreateReportPage,
  head: () => ({ meta: [{ title: "Buat Laporan — DeltaJalan" }] }),
});

// Status pengiriman laporan ke backend Laravel
type SubmitState = "idle" | "loading" | "success" | "error";

function CreateReportPage() {
  const navigate = useNavigate();
  const [reporterName, setReporterName] = useState("Agus Setiawan");
  useEffect(() => { setReporterName(getCurrentUser()?.name ?? "Petugas"); }, []);

  // Ambil data hasil AI dan form dari in-memory store (diisi di halaman upload)
  const aiResult = getAiResult();
  const formData = getFormData();

  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [savedReportCode, setSavedReportCode] = useState<string | null>(null);

  // Jika tidak ada data AI (akses langsung ke URL), redirect ke upload
  useEffect(() => {
    if (!aiResult || !formData) {
      navigate({ to: "/upload" });
    }
  }, [aiResult, formData, navigate]);

  if (!aiResult || !formData) {
    return null; // Akan redirect via useEffect
  }

  const overallCfg = getSeverityConfig(aiResult.overall_severity);
  const isLoading = submitState === "loading";

  // ── Handler Submit ─────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitState("loading");
    setErrorMsg("");

    // formData sudah dijamin tidak null oleh useEffect redirect di atas
    if (!formData) return;

    try {
      const imageBlob = await fetch(formData.previewUrl).then((r) => r.blob());

      // Pastikan kecamatan terisi
      if (!formData.kecamatan) {
        throw new Error("Kecamatan belum dipilih. Kembali ke halaman upload dan pilih kecamatan.");
      }

      // Pastikan dimensi kerusakan terisi
      if (!formData.kerusakanPanjang || !formData.kerusakanLebar) {
        throw new Error(
          "Dimensi kerusakan (panjang × lebar) wajib diisi. Kembali ke halaman upload dan isi dimensi.",
        );
      }

      // Pastikan koordinat GPS tersedia — tidak boleh pakai default diam-diam
      if (formData.lat === undefined || formData.lng === undefined) {
        throw new Error(
          "Koordinat GPS tidak tersedia. Kembali ke halaman upload dan isi koordinat lokasi.",
        );
      }

      // Snap ke jalan terdekat via OSRM agar koordinat nempel di aspal
      const snapped = await snapToRoad(formData.lat, formData.lng);
      const snapLat = snapped.lat;
      const snapLng = snapped.lng;

      // Buat FormData untuk dikirim ke Laravel API
      const fd = new FormData();
      fd.append("reporter_name", user?.name ?? formData.namaJalan);
      fd.append("road_name", formData.namaJalan);
      fd.append("district", formData.kecamatan);
      fd.append("latitude", String(snapLat));
      fd.append("longitude", String(snapLng));
      if (formData.kerusakanPanjang) fd.append("kerusakan_panjang", formData.kerusakanPanjang);
      if (formData.kerusakanLebar) fd.append("kerusakan_lebar", formData.kerusakanLebar);
      if (formData.catatan) fd.append("catatan", formData.catatan);
      // Kirim file foto asli dengan nama file yang benar
      fd.append("image", imageBlob, formData.fileName);
      if (formData.duplicate_of_id) fd.append("duplicate_of_id", formData.duplicate_of_id);

      const token = getToken();
      if (!token) {
        throw new Error("Sesi telah habis, silakan login kembali.");
      }

      // Gunakan API_BASE_URL dari aiStore.ts agar dinamis
      const response = await fetch(`${API_BASE_URL}/reports`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: fd,
        // Jangan set Content-Type manual — browser akan otomatis set
        // multipart/form-data dengan boundary yang benar
      });

      const result = await response.json();

      if (!response.ok) {
        const errData = result;
        if (errData.error_code === "DUPLICATE_IMAGE") {
          const existing = errData.existing_report;
          setSubmitState("error");
          setErrorMsg(`Foto sudah pernah digunakan untuk laporan ${existing?.report_code ?? ""}.`);
          return;
        }
        const message =
          result.message ??
          (result.errors
            ? Object.values(result.errors as Record<string, string[]>)
                .flat()
                .join(", ")
            : "Terjadi kesalahan saat mengirim laporan.");
        throw new Error(message);
      }

      // Berhasil — simpan kode laporan untuk ditampilkan
      setSavedReportCode(result.data?.report_code ?? null);
      setSubmitState("success");

      // Bersihkan store setelah laporan berhasil disimpan
      clearAiStore();

      // Redirect ke halaman home setelah 2.5 detik
      setTimeout(() => {
        navigate({ to: "/home" });
      }, 2500);
    } catch (err) {
      console.error("Submit report error:", err);
      setSubmitState("error");
      if (err instanceof TypeError && err.message.includes("fetch")) {
        setErrorMsg(
          "Tidak dapat terhubung ke server. Pastikan server Laravel berjalan di localhost:8080.",
        );
      } else {
        setErrorMsg(
          err instanceof Error ? err.message : "Terjadi kesalahan saat mengirim laporan.",
        );
      }
    }
  }

  return (
    <PageLayout title="Buat Laporan Resmi" back="/ai-result">

        <main className="px-4 pt-md pb-[140px] w-full">
          <div
            style={{ maxWidth: "42rem", marginLeft: "auto", marginRight: "auto" }}
            className="flex flex-col gap-4"
          >
            {/* ── Error Banner ── */}
            {submitState === "error" && (
              <>
                {errorMsg.includes("sudah pernah digunakan") ? (
                  <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2.5">
                    <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                      <Icon name="content_copy" className="text-amber-700 !text-[14px]" />
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold text-amber-800">
                        Foto sudah pernah digunakan
                      </p>
                      <p className="text-[11px] text-amber-700 mt-0.5">{errorMsg}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 bg-[#FEE2E2] border border-[#FCA5A5] rounded-xl px-4 py-3">
                    <Icon name="error" className="text-[#991B1B] !text-[20px] shrink-0 mt-0.5" />
                    <p className="font-label-md text-[12px] text-[#991B1B] leading-relaxed">
                      {errorMsg}
                    </p>
                  </div>
                )}
              </>
            )}

            {/* ── Summary Hasil AI (readonly) ── */}
            <section className="bg-surface-container-lowest border border-border-subtle rounded-xl p-md flex flex-col gap-sm shadow-sm">
              <div className="flex items-center gap-2 mb-xs">
                <Icon name="auto_awesome" className="text-primary !text-[18px]" />
                <h3 className="font-headline-sm text-[14px] font-bold text-on-surface">
                  Hasil Deteksi AI
                </h3>
                <span className="ml-auto text-[10px] font-bold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded uppercase">
                  Readonly
                </span>
              </div>
              <div className="grid grid-cols-2 gap-sm">
                <div className="bg-surface-container rounded-lg p-sm">
                  <p className="font-label-sm text-[11px] text-on-surface-variant mb-1">
                    Total Kerusakan
                  </p>
                  <p className="font-label-md text-[13px] font-bold text-on-surface">
                    {aiResult.total} titik
                  </p>
                </div>
                <div className="bg-surface-container rounded-lg p-sm">
                  <p className="font-label-sm text-[11px] text-on-surface-variant mb-1">
                    Tingkat Keparahan
                  </p>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${overallCfg.bg} ${overallCfg.text} ${overallCfg.border}`}
                  >
                    {aiResult.overall_severity}
                  </span>
                </div>
                {aiResult.detections[0] && (
                  <>
                    <div className="bg-surface-container rounded-lg p-sm">
                      <p className="font-label-sm text-[11px] text-on-surface-variant mb-1">
                        Jenis Utama
                      </p>
                      <p className="font-label-md text-[13px] font-bold text-on-surface">
                        {aiResult.detections[0].class}
                      </p>
                    </div>
                    <div className="bg-surface-container rounded-lg p-sm">
                      <p className="font-label-sm text-[11px] text-on-surface-variant mb-1">
                        Confidence
                      </p>
                      <p className="font-label-md text-[13px] font-bold text-selesai">
                        {Math.round(aiResult.detections[0].confidence * 100)}%
                      </p>
                    </div>
                  </>
                )}
              </div>
            </section>

            {/* ── Form Laporan Resmi ── */}
            <form id="create-report-form" onSubmit={handleSubmit}>
              <section className="bg-surface-container-lowest border border-border-subtle rounded-xl p-md flex flex-col gap-[14px] shadow-sm">
                <h3 className="font-headline-sm text-[14px] font-bold text-[#0F172A]">
                  Form Laporan Resmi
                </h3>

                {/* Nama Jalan (readonly — dari halaman upload) */}
                <div className="flex flex-col gap-xs">
                  <label className="font-label-md text-label-md text-[#0F172A]">Nama Jalan</label>
                  <div className="relative">
                    <Icon
                      name="location_on"
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant !text-[20px]"
                    />
                    <input
                      readOnly
                      value={formData.namaJalan}
                      className="w-full pl-10 pr-4 py-3 border border-border-subtle rounded-xl font-body-md text-body-md bg-surface-container text-on-surface-variant cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Kecamatan (readonly) */}
                <div className="flex flex-col gap-xs">
                  <label className="font-label-md text-label-md text-[#0F172A]">Kecamatan</label>
                  <div className="relative">
                    <Icon
                      name="map"
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant !text-[20px]"
                    />
                    <input
                      readOnly
                      value={formData.kecamatan}
                      className="w-full pl-10 pr-4 py-3 border border-border-subtle rounded-xl font-body-md text-body-md bg-surface-container text-on-surface-variant cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Tanggal Kejadian (readonly) */}
                <div className="flex flex-col gap-xs">
                  <label className="font-label-md text-label-md text-[#0F172A]">
                    Tanggal Kejadian
                  </label>
                  <div className="relative">
                    <Icon
                      name="calendar_today"
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant !text-[20px]"
                    />
                    <input
                      readOnly
                      value={formData.tanggal}
                      className="w-full pl-10 pr-4 py-3 border border-border-subtle rounded-xl font-body-md text-body-md bg-surface-container text-on-surface-variant cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Koordinat GPS (readonly) */}
                <div className="flex flex-col gap-xs">
                  <label className="font-label-md text-label-md text-[#0F172A]">
                    Koordinat GPS
                  </label>
                  <div className="relative">
                    <Icon
                      name="my_location"
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-container !text-[20px]"
                    />
                    <input
                      readOnly
                      value={
                        formData.lat !== undefined && formData.lng !== undefined
                          ? `${formData.lat.toFixed(6)}, ${formData.lng.toFixed(6)}`
                          : "Koordinat tidak tersedia"
                      }
                      className="w-full pl-10 pr-4 py-3 border border-border-subtle rounded-xl font-id-code text-[13px] bg-surface-container text-on-surface-variant cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Foto yang diupload (thumbnail, readonly) */}
                <div className="flex flex-col gap-xs">
                  <label className="font-label-md text-label-md text-[#0F172A]">
                    Foto Kerusakan
                  </label>
                  <div className="flex items-center gap-3 p-3 border border-border-subtle rounded-xl bg-surface-container">
                    <div className="w-16 h-16 rounded-lg overflow-hidden border border-border-subtle shrink-0">
                      {formData.previewUrl ? (
                        <img
                          src={formData.previewUrl}
                          alt="Preview foto"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-surface-container-high">
                          <Icon name="image" className="text-on-surface-variant !text-[28px]" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-label-md text-[13px] font-semibold text-on-surface">
                        {formData.fileName}
                      </p>
                      <p className="font-label-sm text-[11px] text-on-surface-variant">JPG/PNG</p>
                      <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-selesai">
                        <Icon name="check_circle" className="!text-[12px]" filled />
                        Siap dikirim
                      </span>
                    </div>
                  </div>
                </div>

                {/* Dimensi Kerusakan (readonly — dari halaman upload) */}
                {(formData.kerusakanPanjang || formData.kerusakanLebar) && (
                  <div className="flex flex-col gap-xs">
                    <label className="font-label-md text-label-md text-[#0F172A]">
                      Dimensi Kerusakan
                    </label>
                    <div className="flex items-center gap-4 px-4 py-3 border border-border-subtle rounded-xl bg-surface-container text-on-surface-variant">
                      {formData.kerusakanPanjang && (
                        <span className="text-[13px]">
                          <span className="font-semibold">Panjang:</span>{" "}
                          {formData.kerusakanPanjang} m
                        </span>
                      )}
                      {formData.kerusakanLebar && (
                        <span className="text-[13px]">
                          <span className="font-semibold">Lebar:</span> {formData.kerusakanLebar} m
                        </span>
                      )}
                      {formData.kerusakanPanjang && formData.kerusakanLebar && (
                        <span className="text-[13px] text-on-surface-variant">
                          (
                          {(
                            parseFloat(formData.kerusakanPanjang) *
                            parseFloat(formData.kerusakanLebar)
                          ).toFixed(1)}{" "}
                          m²)
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Catatan Petugas (readonly — dari halaman upload) */}
                {formData.catatan && (
                  <div className="flex flex-col gap-xs">
                    <label className="font-label-md text-label-md text-[#0F172A]">
                      Catatan Petugas
                    </label>
                    <div className="w-full px-4 py-3 border border-border-subtle rounded-xl font-body-md text-body-md bg-surface-container text-on-surface-variant min-h-[80px]">
                      {formData.catatan}
                    </div>
                  </div>
                )}

                {/* Nama Petugas (pre-filled dari auth) */}
                <div className="flex flex-col gap-xs">
                  <label className="font-label-md text-label-md text-[#0F172A]">Nama Petugas</label>
                  <div className="relative">
                    <Icon
                      name="person"
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant !text-[20px]"
                    />
                    <input
                      readOnly
                      value={reporterName}
                      className="w-full pl-10 pr-4 py-3 border border-border-subtle rounded-xl font-body-md text-body-md bg-surface-container text-on-surface-variant cursor-not-allowed"
                    />
                  </div>
                </div>
              </section>
            </form>
          </div>
        </main>

        {/* ── Footer Actions ── */}
        <div className="bg-white border-t border-[#D0DAE8] w-full">
          <div
            style={{ maxWidth: "42rem", marginLeft: "auto", marginRight: "auto" }}
            className="p-4 flex flex-col gap-3"
          >
            <button
              type="submit"
              form="create-report-form"
              disabled={isLoading}
              className="w-full h-[52px] bg-primary-container text-white rounded-xl flex items-center justify-center gap-2 font-headline-sm-mobile text-[16px] font-bold active:scale-95 transition-transform shadow-md shadow-primary-container/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {isLoading ? (
                <>
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Mengirim Laporan...
                </>
              ) : (
                <>
                  <Icon name="send" className="!text-[20px]" />
                  Kirim Laporan Resmi
                </>
              )}
            </button>
            <button
              type="button"
              disabled={isLoading}
              className="w-full h-[48px] border-2 border-primary-container text-primary-container rounded-xl flex items-center justify-center gap-2 font-label-md text-[15px] font-bold disabled:opacity-40"
            >
              <Icon name="save" className="!text-[20px]" />
              Simpan Draf
            </button>
          </div>
        </div>

        {/* ── Toast Sukses ── */}
        {submitState === "success" && (
          <Portal>
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] bg-selesai text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 font-label-md text-[14px] font-bold">
              <Icon name="check_circle" className="!text-[20px]" filled />
              Laporan {savedReportCode ?? ""} berhasil dikirim!
            </div>
          </Portal>
        )}
    </PageLayout>
  );
}
