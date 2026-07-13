import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Icon } from "@/components/jk/Icon";
import { API_BASE_URL } from "@/lib/aiStore";
import { resolveImageUrl } from "@/lib/imageUrl";
import { getStatusBadge } from "@/lib/format";
import { sanitizeUrls } from "@/lib/imageUrl";

interface LacakSearch {
  report_code?: string;
}

export const Route = createFileRoute("/lacak")({
  component: LacakPage,
  validateSearch: (search: Record<string, string | undefined>): LacakSearch => ({
    report_code: search.report_code ?? undefined,
  }),
  head: () => ({
    meta: [
      { title: "Lacak Laporan — DeltaJalan" },
      {
        name: "description",
        content: "Lacak laporan kerusakan jalan Anda menggunakan kode laporan.",
      },
    ],
  }),
});

interface ReportData {
  id: string;
  report_code: string;
  road_name: string;
  district: string;
  status: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  photos: { image_original_url: string; created_at: string }[];
}

interface TimelineItem {
  old_status: string | null;
  new_status: string;
  notes: string | null;
  created_at: string;
}

function LacakPage() {
  const search = useSearch({ from: "/lacak" });
  const [reportCode, setReportCode] = useState(search.report_code ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<{ report: ReportData; timeline: TimelineItem[] } | null>(null);

  useEffect(() => {
    if (search.report_code && !data) {
      handleTrack();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleTrack() {
    if (!reportCode.trim()) return;
    setLoading(true);
    setError("");
    setData(null);

    try {
      const res = await fetch(`${API_BASE_URL}/reports/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report_code: reportCode.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        setData(sanitizeUrls(json.data));
      } else {
        setError(json.message ?? "Laporan tidak ditemukan.");
      }
    } catch {
      setError("Gagal terhubung ke server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden">
      <div className="fixed inset-0 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/background.jpg')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#1e40af]/80 to-[#0f2b6d]/90" />
      </div>

      <div className="relative z-10 min-h-[100dvh] flex items-center justify-center p-4">
        <div className="w-full max-w-[400px] animate-fade-in">
          <div
            className="bg-white rounded-2xl overflow-hidden border-2 border-[#1e40af]"
            style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.3)" }}
          >
            <div className="flex flex-col items-center pt-6 pb-4 px-6">
              <div className="w-14 h-14 rounded-xl bg-white shadow-md flex items-center justify-center mb-3">
                <img src="/logo.png" alt="DeltaJalan" className="w-9 h-9" />
              </div>
              <h1 className="font-headline-md text-headline-md font-extrabold bg-gradient-to-r from-[#1e40af] to-[#2e68d8] bg-clip-text text-transparent tracking-tight">
                Lacak Laporan
              </h1>
              <p className="text-center mt-1 font-body-sm text-body-sm text-[#475569]">
                Masukkan kode laporan untuk mengetahui status terbaru
              </p>
            </div>

            <div className="px-6 pb-6">
              {error && (
                <div className="mb-4 flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <Icon name="error" className="text-[#E11D48] !text-[18px] shrink-0 mt-0.5" />
                  <p className="font-body-sm text-body-sm text-[#E11D48] leading-relaxed">
                    {error}
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <input
                  value={reportCode}
                  onChange={(e) => setReportCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleTrack()}
                  placeholder="Contoh: LP-2026-00001"
                  className="flex-1 h-11 px-4 border border-[#c4c5d5] rounded-lg font-body-md text-body-md text-[#0F172A] placeholder:text-[#757684] bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20 focus:border-[#1e40af]"
                />
                <button
                  type="button"
                  onClick={handleTrack}
                  disabled={loading}
                  className="h-11 px-5 bg-gradient-to-r from-[#1e40af] to-[#2e68d8] text-white rounded-lg font-label-md text-label-md font-semibold flex items-center justify-center gap-1.5 hover:shadow-lg hover:shadow-[#1e40af]/25 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Icon name="search" className="!text-[18px]" />
                      Cari
                    </>
                  )}
                </button>
              </div>
            </div>

            {data && (
              <div className="px-6 pb-6 border-t border-[#E2E8F0] pt-4">
                <div className="mb-4">
                  {data.report.photos?.[0]?.image_original_url && (
                    <div className="mb-3 rounded-lg overflow-hidden border border-[#D0DAE8]">
                      <img
                        src={resolveImageUrl(data.report.photos[0].image_original_url) ?? ""}
                        alt="Foto"
                        className="w-full object-cover max-h-48"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-sm font-bold text-[#0F172A]">
                      {data.report.report_code}
                    </span>
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${getStatusBadge(data.report.status).color}`}
                    >
                      {getStatusBadge(data.report.status).label}
                    </span>
                  </div>
                  <p className="font-label-md text-label-md font-semibold text-[#0F172A]">
                    {data.report.road_name}
                  </p>
                  <p className="text-xs text-[#476788] mt-0.5">{data.report.district}</p>
                  {data.report.description && (
                    <p className="text-sm text-[#475569] mt-2">{data.report.description}</p>
                  )}
                </div>

                {data.timeline.length > 0 && (
                  <div>
                    <h3 className="font-label-sm text-label-sm font-semibold text-[#0F172A] mb-3 flex items-center gap-1.5">
                      <Icon name="timeline" className="!text-[16px] text-[#1e40af]" />
                      Perkembangan
                    </h3>
                    <div className="relative">
                      {data.timeline.map((item, i) => {
                        const isLast = i === data.timeline.length - 1;
                        const statusLabel = getStatusBadge(item.new_status).label;
                        const dateStr = new Date(item.created_at).toLocaleDateString("id-ID", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        });

                        return (
                          <div key={i} className="flex gap-3 pb-3 relative">
                            <div className="flex flex-col items-center">
                              <div
                                className={`w-2.5 h-2.5 rounded-full ${isLast ? "bg-[#1e40af]" : "bg-[#c4c5d5]"} shrink-0 mt-1`}
                              />
                              {!isLast && <div className="w-px flex-1 bg-[#D0DAE8] mt-0.5" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[#0F172A]">
                                {item.notes ?? statusLabel}
                              </p>
                              {item.notes && statusLabel !== item.notes && (
                                <p className="text-xs text-[#476788]">{statusLabel}</p>
                              )}
                              <p className="text-xs text-[#476788] mt-0.5">{dateStr}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="px-6 py-3 bg-gray-50 border-t border-[#E2E8F0] flex items-center justify-center">
              <Link
                to="/masuk"
                className="font-label-sm text-label-sm text-[#475569] hover:text-[#1e40af] transition-colors flex items-center gap-1"
              >
                <Icon name="arrow_back" className="!text-[16px]" />
                Kembali ke halaman masuk
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
