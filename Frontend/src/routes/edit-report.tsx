import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Icon } from "@/components/jk/Icon";
import { TopBar } from "@/components/jk/TopBar";
import { AppLayout } from "@/components/jk/AppLayout";
import { BottomNav } from "@/components/jk/BottomNav";
import { getCurrentUser, getToken } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/aiStore";
import type { Laporan } from "@/types/laporan";

export const Route = createFileRoute("/edit-report")({
  component: EditReportPage,
  validateSearch: (search: Record<string, unknown>) => {
    const reportId = search.reportId as string | undefined;
    return { ...(reportId ? { reportId } : {}) };
  },
  head: () => ({ meta: [{ title: "Edit Laporan — DeltaJalan" }] }),
});

type SubmitState = "idle" | "loading" | "success" | "error";

function EditReportPage() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const token = getToken();
  const { reportId } = useSearch({ from: "/edit-report" });

  const [report, setReport] = useState<Laporan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const [catatan, setCatatan] = useState("");
  const [kerusakanPanjang, setKerusakanPanjang] = useState("");
  const [kerusakanLebar, setKerusakanLebar] = useState("");
  const [roadName, setRoadName] = useState("");
  const [district, setDistrict] = useState("");

  useEffect(() => {
    if (!token || !reportId) {
      navigate({ to: "/my-reports" });
      return;
    }
    loadReport();
  }, []);

  async function loadReport() {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/reports/${reportId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Gagal memuat laporan.");
      const j = await res.json();
      const data = j.data as Laporan;
      if (data.status !== "Menunggu Review" && data.status !== "Diedit") {
        setErrorMsg("Laporan ini tidak dapat diedit karena sudah diproses.");
        setIsLoading(false);
        return;
      }
      setReport(data);
      setCatatan(data.catatan_petugas ?? "");
      setKerusakanPanjang(data.kerusakan_panjang ? String(data.kerusakan_panjang) : "");
      setKerusakanLebar(data.kerusakan_lebar ? String(data.kerusakan_lebar) : "");
      setRoadName(data.road_name ?? "");
      setDistrict(data.district ?? "");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleMulaiEdit() {
    try {
      const res = await fetch(`${API_BASE_URL}/reports/${reportId}/mulai-edit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message ?? "Gagal memulai edit.");
      }
    } catch (err) {
      throw err;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitState("loading");
    setErrorMsg("");

    if (!token) {
      setErrorMsg("Sesi habis.");
      setSubmitState("error");
      return;
    }
    if (!kerusakanPanjang || !kerusakanLebar) {
      setErrorMsg("Dimensi kerusakan wajib diisi.");
      setSubmitState("error");
      return;
    }

    try {
      await handleMulaiEdit();

      const body: Record<string, unknown> = {
        catatan: catatan || null,
        kerusakan_panjang: parseFloat(kerusakanPanjang),
        kerusakan_lebar: parseFloat(kerusakanLebar),
        road_name: roadName || report?.road_name,
        district: district || report?.district,
      };

      const res = await fetch(`${API_BASE_URL}/reports/${reportId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message ?? "Gagal menyimpan perubahan.");
      }

      setSubmitState("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Terjadi kesalahan.");
      setSubmitState("error");
    }
  }

  async function handleBatal() {
    try {
      await fetch(`${API_BASE_URL}/reports/${reportId}/batal-edit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}
    navigate({ to: "/my-reports" });
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <span className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (errorMsg && !report) {
    return (
      <AppLayout>
        <TopBar title="Edit Laporan" />
        <div className="p-4 text-center text-red-600 text-sm">{errorMsg}</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-screen w-full">
        <TopBar title="Edit Laporan" />

        {submitState === "success" ? (
          <div className="flex-1 overflow-y-auto min-h-0 flex flex-col items-center justify-center p-8 gap-4">
            <Icon name="check_circle" className="!text-[64px] text-green-500" filled />
            <p className="text-lg font-bold text-on-surface">Laporan berhasil diperbarui!</p>
            <button
              onClick={() => navigate({ to: "/my-reports" })}
              className="px-6 py-3 bg-primary text-white rounded-lg font-bold h-11"
            >
              Kembali ke Laporan Saya
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4 pb-28">
            {errorMsg && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
                {errorMsg}
              </div>
            )}

            {/* Report info */}
            {report && (
              <div className="bg-surface-container-lowest rounded-lg border border-[#D0DAE8] p-4">
                <p className="text-xs text-on-surface-variant mb-1">{report.report_code}</p>
                <p className="font-bold text-on-surface">{report.road_name}</p>
                <p className="text-xs text-on-surface-variant">Kec. {report.district}</p>
              </div>
            )}

            {/* Nama Jalan */}
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">Nama Jalan</label>
              <input
                type="text"
                value={roadName}
                onChange={(e) => setRoadName(e.target.value)}
                className="w-full px-4 py-3 border border-[#C0CEDF] rounded-lg text-sm bg-surface-container-low focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>

            {/* Kecamatan */}
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">Kecamatan</label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full px-4 py-3 border border-[#C0CEDF] rounded-lg text-sm bg-surface-container-low focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>

            {/* Dimensi Kerusakan */}
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">
                Dimensi Kerusakan <span className="text-on-surface-variant">(meter)</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={kerusakanPanjang}
                    onChange={(e) => setKerusakanPanjang(e.target.value.replace(",", "."))}
                    placeholder="Panjang"
                    className="w-full pl-3 pr-10 py-3 border border-[#C0CEDF] rounded-lg text-sm bg-surface-container-low focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant">
                    m
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={kerusakanLebar}
                    onChange={(e) => setKerusakanLebar(e.target.value.replace(",", "."))}
                    placeholder="Lebar"
                    className="w-full pl-3 pr-10 py-3 border border-[#C0CEDF] rounded-lg text-sm bg-surface-container-low focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant">
                    m
                  </span>
                </div>
              </div>
              {kerusakanPanjang && kerusakanLebar && (
                <p className="text-xs text-on-surface-variant mt-1">
                  Luas: {(parseFloat(kerusakanPanjang) * parseFloat(kerusakanLebar)).toFixed(2)} m²
                </p>
              )}
            </div>

            {/* Catatan */}
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">Catatan</label>
              <textarea
                rows={3}
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                className="w-full px-4 py-3 border border-[#C0CEDF] rounded-lg text-sm bg-surface-container-low resize-none focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                placeholder="Catatan tambahan..."
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleBatal}
                className="flex-1 py-3 border border-[#C0CEDF] rounded-lg text-sm font-bold text-on-surface-variant"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitState === "loading"}
                className="flex-[2] py-3 bg-primary text-white rounded-lg text-sm font-bold disabled:opacity-50 h-11"
              >
                {submitState === "loading" ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Menyimpan...
                  </span>
                ) : (
                  "Simpan Perubahan"
                )}
              </button>
            </div>
          </form>
        )}

        <BottomNav />
      </div>
    </AppLayout>
  );
}
