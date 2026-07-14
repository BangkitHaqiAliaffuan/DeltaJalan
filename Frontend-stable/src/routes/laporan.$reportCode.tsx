import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { Icon } from "@/components/jk/Icon";
import { API_BASE_URL } from "@/lib/aiStore";
import { resolveImageUrl } from "@/lib/imageUrl";
import { getStatusBadge } from "@/lib/format";
import { sanitizeUrls } from "@/lib/imageUrl";

export const Route = createFileRoute("/laporan/$reportCode")({
  component: LaporanPublicPage,
  head: ({ params }) => ({
    meta: [
      { title: `Laporan ${params.reportCode} — DeltaJalan` },
      {
        name: "description",
        content: `Lacak status laporan ${params.reportCode} — DeltaJalan`,
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
  rating: number | null;
  rating_comment: string | null;
  photos: { image_original_url: string; created_at: string }[];
}

interface TimelineItem {
  old_status: string | null;
  new_status: string;
  notes: string | null;
  created_at: string;
}

function LaporanPublicPage() {
  const { reportCode } = useParams({ from: "/laporan/$reportCode" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<{ report: ReportData; timeline: TimelineItem[] } | null>(null);

  useEffect(() => {
    loadReport();
  }, [reportCode]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadReport() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `${API_BASE_URL}/v1/public/reports/${encodeURIComponent(reportCode)}`,
        {
          headers: { Accept: "application/json" },
        },
      );
      const json = await res.json();
      if (json.success) {
        setData(sanitizeUrls(json.data));
        const imageUrl = json.data.report?.photos?.[0]?.image_original_url;
        if (imageUrl) {
          const resolved = resolveImageUrl(imageUrl);
          if (resolved) {
            let ogImage = document.querySelector('meta[property="og:image"]');
            if (!ogImage) {
              ogImage = document.createElement("meta");
              ogImage.setAttribute("property", "og:image");
              document.head.appendChild(ogImage);
            }
            ogImage.setAttribute("content", resolved);
          }
        }
      } else {
        setError(json.message ?? "Laporan tidak ditemukan.");
      }
    } catch {
      setError("Gagal terhubung ke server.");
    } finally {
      setLoading(false);
    }
  }

  const allPhotos = data?.report?.photos ?? [];
  const [photoIdx, setPhotoIdx] = useState(0);

  const goToPhoto = useCallback(
    (i: number) => {
      const total = allPhotos.length;
      if (total === 0) return;
      setPhotoIdx(((i % total) + total) % total);
    },
    [allPhotos.length],
  );

  const currentPhoto = allPhotos[photoIdx];

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
                Detail Laporan
              </h1>
              <p className="text-center mt-1 font-body-sm text-body-sm text-[#475569]">
                Status terbaru laporan kerusakan jalan
              </p>
            </div>

            <div className="px-6 pb-6">
              {error && (
                <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
                  <Icon name="error" className="text-[#E11D48] !text-[18px] shrink-0 mt-0.5" />
                  <p className="font-body-sm text-body-sm text-[#E11D48] leading-relaxed">
                    {error}
                  </p>
                </div>
              )}

              {loading && (
                <div className="flex items-center justify-center py-12">
                  <span className="w-8 h-8 border-4 border-[#D0DAE8] border-t-[#1e40af] rounded-full animate-spin" />
                </div>
              )}

              {data && !loading && (
                <>
                  {allPhotos.length > 0 && currentPhoto?.image_original_url && (
                    <div className="relative mb-4 rounded-lg overflow-hidden border border-[#D0DAE8] bg-[#0F172A]">
                      <img
                        src={resolveImageUrl(currentPhoto.image_original_url) ?? ""}
                        alt={`Foto ${photoIdx + 1}`}
                        className="w-full object-contain max-h-48"
                      />
                      {allPhotos.length > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={() => goToPhoto(photoIdx - 1)}
                            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center transition-colors"
                          >
                            <Icon name="chevron_left" className="!text-[18px] text-white" />
                          </button>
                          <button
                            type="button"
                            onClick={() => goToPhoto(photoIdx + 1)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center transition-colors"
                          >
                            <Icon name="chevron_right" className="!text-[18px] text-white" />
                          </button>
                          <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[11px] px-2 py-0.5 rounded-full font-medium">
                            {photoIdx + 1}/{allPhotos.length}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  <div className="mb-4">
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
                    <div className="mb-4">
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

                  {data.report.rating && (
                    <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4">
                      <p className="text-xs font-semibold text-green-700 mb-1">Penilaian Warga</p>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Icon
                            key={star}
                            name={star <= (data.report.rating ?? 0) ? "star" : "star_border"}
                            className={`!text-[18px] ${star <= (data.report.rating ?? 0) ? "text-[#F59E0B]" : "text-[#D0DAE8]"}`}
                          />
                        ))}
                      </div>
                      {data.report.rating_comment && (
                        <p className="text-sm text-green-800 mt-1.5">
                          "{data.report.rating_comment}"
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="px-6 py-3 bg-gray-50 border-t border-[#E2E8F0] flex items-center justify-center gap-4">
              <Link
                to="/lapor"
                className="font-label-sm text-label-sm text-[#1e40af] hover:text-[#2e68d8] transition-colors flex items-center gap-1"
              >
                <Icon name="add" className="!text-[16px]" />
                Laporkan Jalan Rusak
              </Link>
              <Link
                to="/masuk"
                className="font-label-sm text-label-sm text-[#475569] hover:text-[#1e40af] transition-colors flex items-center gap-1"
              >
                <Icon name="login" className="!text-[16px]" />
                Masuk
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
