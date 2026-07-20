import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { Share as CapacitorShare } from "@capacitor/share";
import { Icon } from "@/components/jk/Icon";
import { getToken } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/aiStore";
import { formatDateRelative, getStatusBadge, getSeverityLabel } from "@/lib/format";
import { sanitizeUrls, resolveImageUrl } from "@/lib/imageUrl";

const SHARE_BASE_URL = "https://delta-jalan.vercel.app";

export const Route = createFileRoute("/warga/laporan/$id")({
  component: WargaLaporanDetailPage,
  head: () => ({ meta: [{ title: "Detail Laporan — DeltaJalan" }] }),
});

interface TimelineItem {
  old_status: string | null;
  new_status: string;
  notes: string | null;
  created_at: string;
  user_id: number | null;
}

function WargaLaporanDetailPage() {
  const { id } = useParams({ from: "/warga/laporan/$id" });
  const token = getToken() ?? "";
  const [report, setReport] = useState<any>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [showAiResult, setShowAiResult] = useState(false);
  const [selectedRating, setSelectedRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  useEffect(() => {
    loadDetail();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleShare() {
    const url = `${SHARE_BASE_URL}/laporan/${report?.report_code}`;
    const title = `Laporan ${report?.report_code} — DeltaJalan`;
    const text = `Laporan kerusakan jalan: ${report?.road_name} (${report?.district})`;

    // Tier 1: Native Capacitor (Android/iOS)
    if (window.Capacitor?.isNativePlatform()) {
      try {
        await CapacitorShare.share({ title, text, url, dialogTitle: "Bagikan via" });
        return;
      } catch {
        return; // user cancelled
      }
    }

    // Tier 2: Web Share API (browser modern via HTTPS)
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        return; // user cancelled
      }
    }

    // Tier 3: Clipboard fallback
    try {
      await navigator.clipboard.writeText(url);
      alert("Link laporan disalin!");
    } catch {
      // clipboard not available
    }
  }

  async function handleSubmitRating() {
    if (selectedRating === 0) return;
    setRatingSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/warga/reports/${id}/rating`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          rating: selectedRating,
          comment: ratingComment.trim() || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setRatingSubmitted(true);
        setReport((prev: any) => ({
          ...prev,
          rating: selectedRating,
          rating_comment: ratingComment.trim() || null,
          rated_at: new Date().toISOString(),
        }));
      } else {
        alert(json.message ?? "Gagal mengirim rating.");
      }
    } catch {
      alert("Gagal terhubung ke server.");
    } finally {
      setRatingSubmitting(false);
    }
  }

  const allPhotos = report?.photos ?? [];
  const currentPhoto = allPhotos[photoIdx];
  const totalPhotos = allPhotos.length;

  const goToPhoto = useCallback(
    (i: number) => {
      if (totalPhotos === 0) return;
      setPhotoIdx(((i % totalPhotos) + totalPhotos) % totalPhotos);
    },
    [totalPhotos],
  );

  const prevPhoto = useCallback(() => goToPhoto(photoIdx - 1), [goToPhoto, photoIdx]);
  const nextPhoto = useCallback(() => goToPhoto(photoIdx + 1), [goToPhoto, photoIdx]);

  useEffect(() => {
    setPhotoIdx(0);
  }, [report?.id]);

  // Preload semua foto sekaligus untuk navigasi carousel instan
  useEffect(() => {
    const photos = report?.photos;
    if (!photos) return;
    photos.forEach((p) => {
      const url = resolveImageUrl(p?.image_original_url);
      if (url) new Image().src = url;
    });
  }, [report?.photos]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prevPhoto();
      if (e.key === "ArrowRight") nextPhoto();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prevPhoto, nextPhoto]);

  async function loadDetail() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/warga/reports/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        setReport(sanitizeUrls(json.data.report));
        setTimeline(json.data.timeline ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="pb-4">
        <section className="bg-gradient-to-br from-[#1e40af] to-[#2e68d8] p-6 text-white">
          <h1 className="text-xl font-bold tracking-tight">Detail Laporan</h1>
        </section>
        <div className="max-w-xl mx-auto px-4 mt-6 animate-pulse space-y-4">
          <div className="h-6 w-48 bg-[#D0DAE8] rounded" />
          <div className="h-4 w-32 bg-[#E8F0FA] rounded" />
          <div className="h-40 bg-[#E8F0FA] rounded-lg" />
          <div className="h-20 w-full bg-[#E8F0FA] rounded" />
        </div>
      </main>
    );
  }

  if (!report) {
    return (
      <main className="pb-4 text-center py-12 text-[#476788]">
        <Icon name="error" className="!text-5xl mb-3 opacity-30" />
        <p>Laporan tidak ditemukan.</p>
        <Link
          to="/warga/laporan"
          className="text-[#1e40af] font-semibold text-sm mt-2 inline-block"
        >
          Kembali ke daftar
        </Link>
      </main>
    );
  }

  const statusInfo = getStatusBadge(report.status);

  return (
    <main className="pb-4">
      <section className="bg-gradient-to-br from-[#1e40af] to-[#2e68d8] p-6 text-white">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Detail Laporan</h1>
          <p className="font-mono text-sm text-blue-200 mt-1">{report.report_code}</p>
        </div>
      </section>

      <div className="max-w-xl mx-auto px-4 mt-6">
        {currentPhoto?.image_original_url && (
          <div className="relative mb-4 rounded-lg overflow-hidden border border-[#D0DAE8] bg-[#0F172A]">
            {currentPhoto.image_result_url && (
              <div className="absolute top-2 left-2 z-10 flex gap-1">
                <button
                  type="button"
                  onClick={() => setShowAiResult(false)}
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full transition-colors ${
                    !showAiResult
                      ? "bg-white text-[#0F172A]"
                      : "bg-black/40 text-white/70 hover:bg-black/60"
                  }`}
                >
                  Asli
                </button>
                <button
                  type="button"
                  onClick={() => setShowAiResult(true)}
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full transition-colors ${
                    showAiResult
                      ? "bg-[#1e40af] text-white"
                      : "bg-black/40 text-white/70 hover:bg-black/60"
                  }`}
                >
                  Hasil AI
                </button>
              </div>
            )}
            <img
              src={resolveImageUrl(showAiResult && currentPhoto.image_result_url ? currentPhoto.image_result_url : currentPhoto.image_original_url) ?? ""}
              alt={`Foto ${photoIdx + 1}`}
              className="w-full object-contain max-h-64"
            />
            {showAiResult && currentPhoto.image_result_url && (
              <div className="absolute bottom-2 left-2 bg-[#1e40af]/80 text-white text-[10px] px-2 py-0.5 rounded font-medium">
                Hasil Deteksi AI
              </div>
            )}
            {totalPhotos > 1 && (
              <>
                <button
                  type="button"
                  onClick={prevPhoto}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center transition-colors"
                >
                  <Icon name="chevron_left" className="!text-[18px] text-white" />
                </button>
                <button
                  type="button"
                  onClick={nextPhoto}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center transition-colors"
                >
                  <Icon name="chevron_right" className="!text-[18px] text-white" />
                </button>
                <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[11px] px-2 py-0.5 rounded-full font-medium">
                  {photoIdx + 1}/{totalPhotos}
                </div>
              </>
            )}
          </div>
        )}

        <div className="bg-white border border-[#D0DAE8] rounded-lg p-4 mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#476788] font-medium">Status</p>
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${statusInfo.color}`}>
              <Icon name={statusInfo.icon} className="!text-sm" />
              {statusInfo.label}
            </span>
          </div>
          <div>
            <p className="text-xs text-[#476788] font-medium">Nama Jalan</p>
            <p className="font-label-md text-label-md font-semibold text-[#0F172A]">
              {report.road_name}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#476788] font-medium">Kecamatan</p>
            <p className="font-body-md text-body-md text-[#0F172A]">{report.district}</p>
          </div>
          {report.overall_severity && (() => {
            const sevInfo = getSeverityLabel(report.overall_severity);
            return (
              <div className="flex items-center justify-between">
                <p className="text-xs text-[#476788] font-medium">Tingkat Kerusakan</p>
                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${sevInfo.chip}`}>
                  <Icon name={sevInfo.icon} className="!text-sm" />
                  {sevInfo.label}
                </span>
              </div>
            );
          })()}
          {report.description && (
            <div>
              <p className="text-xs text-[#476788] font-medium">Deskripsi</p>
              <p className="font-body-sm text-body-sm text-[#0F172A]">{report.description}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-[#476788] font-medium">Tanggal Laporan</p>
            <p className="font-body-sm text-body-sm text-[#0F172A]">
              {new Date(report.created_at).toLocaleDateString("id-ID", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>

        {report.assigned_team_name && (
          <div className="bg-white border border-[#D0DAE8] rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <Icon name="groups" className="!text-[18px] text-[#1e40af]" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-[#476788] font-medium">Tim Penugasan</p>
                <p className="font-label-md text-label-md font-semibold text-[#0F172A]">
                  {report.assigned_team_name}
                </p>
                {report.assigned_at && (
                  <p className="text-xs text-[#476788] mt-0.5">
                    Ditugaskan {new Date(report.assigned_at).toLocaleDateString("id-ID", {
                      year: "numeric", month: "long", day: "numeric"
                    })}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleShare}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#1e40af] text-white rounded-lg font-label-sm text-label-sm font-semibold hover:bg-[#2e68d8] transition-colors active:scale-[0.98]"
        >
          <Icon name="share" className="!text-[18px]" />
          Bagikan
        </button>

        <div className="bg-white border border-[#D0DAE8] rounded-lg p-4">
          <h3 className="font-label-md text-label-md font-semibold text-[#0F172A] mb-4 flex items-center gap-2">
            <Icon name="timeline" className="!text-lg text-[#1e40af]" />
            Riwayat Status
          </h3>

          {timeline.length === 0 ? (
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-[#1e40af] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-[#0F172A]">{statusInfo.label}</p>
                <p className="text-xs text-[#476788]">
                  {formatDateRelative(report.created_at, true)}
                </p>
              </div>
            </div>
          ) : (
            <div className="relative">
              {timeline.map((item, i) => {
                const isLast = i === timeline.length - 1;
                const statusLabel = getStatusBadge(item.new_status).label;
                const dateStr = new Date(item.created_at).toLocaleDateString("id-ID", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div key={i} className="flex gap-3 pb-4 relative">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-3 h-3 rounded-full ${isLast ? "bg-[#1e40af]" : "bg-[#c4c5d5]"} shrink-0 mt-1`}
                      />
                      {!isLast && <div className="w-px flex-1 bg-[#D0DAE8] mt-1" />}
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
          )}
        </div>

        {/* ── Foto Setelah Perbaikan ─────────────────────────────────────── */}
        {report.after_photos && report.after_photos.length > 0 && (
          <div className="bg-white border border-[#D0DAE8] rounded-lg p-4 mt-4">
            <h3 className="font-label-md text-label-md font-semibold text-[#0F172A] mb-3 flex items-center gap-2">
              <Icon name="photo_library" className="!text-lg text-[#1e40af]" />
              Foto Setelah Perbaikan
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {report.after_photos.map((ap: { id: number; url: string; sort_order: number }) => (
                <div key={ap.id} className="rounded-lg overflow-hidden border border-[#D0DAE8] bg-[#0F172A]">
                  <img
                    src={resolveImageUrl(ap.url) ?? ""}
                    alt={`Setelah perbaikan ${ap.sort_order + 1}`}
                    className="w-full object-cover h-36"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Progress Pengerjaan ─────────────────────────────────────────── */}
        {report.progress_updates && report.progress_updates.length > 0 && (
          <div className="bg-white border border-[#D0DAE8] rounded-lg p-4 mt-4">
            <h3 className="font-label-md text-label-md font-semibold text-[#0F172A] mb-3 flex items-center gap-2">
              <Icon name="construction" className="!text-lg text-[#1e40af]" />
              Progress Pengerjaan
            </h3>
            <div className="space-y-3">
              {report.progress_updates.map((pu: any) => (
                <div key={pu.id} className="flex gap-3">
                  {pu.foto_url && (
                    <div className="w-20 h-20 rounded-lg overflow-hidden border border-[#D0DAE8] bg-[#0F172A] shrink-0">
                      <img
                        src={resolveImageUrl(pu.foto_url) ?? ""}
                        alt={`Progress hari ke-${pu.day_number}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-[#476788] font-medium">
                      Hari ke-{pu.day_number}
                    </p>
                    {pu.catatan && (
                      <p className="text-sm text-[#0F172A] mt-0.5">{pu.catatan}</p>
                    )}
                    <p className="text-xs text-[#757684] mt-1">
                      {pu.user_name && `${pu.user_name} • `}
                      {pu.created_at && new Date(pu.created_at).toLocaleDateString("id-ID", {
                        year: "numeric", month: "short", day: "numeric"
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Rating Kepuasan ──────────────────────────────────────────────── */}
        {report.status === "Selesai" && (
          <div className="bg-white border border-[#D0DAE8] rounded-lg p-4 mt-4">
            <h3 className="font-label-md text-label-md font-semibold text-[#0F172A] mb-3 flex items-center gap-2">
              <Icon name="rate_review" className="!text-lg text-[#1e40af]" />
              Penilaian
            </h3>

            {report.rated_at || ratingSubmitted ? (
              <div>
                <div className="flex items-center gap-0.5 mb-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Icon
                      key={star}
                      name={star <= (report.rating ?? selectedRating) ? "star" : "star_border"}
                      className={`!text-[22px] ${star <= (report.rating ?? selectedRating) ? "text-[#F59E0B]" : "text-[#D0DAE8]"}`}
                      fill={star <= (report.rating ?? selectedRating) ? "currentColor" : undefined}
                    />
                  ))}
                </div>
                {report.rating_comment && (
                  <p className="text-sm text-[#475569] mt-1 italic">"{report.rating_comment}"</p>
                )}
                <p className="text-xs text-green-700 mt-2 flex items-center gap-1">
                  <Icon name="check_circle" className="!text-[14px]" />
                  Terima kasih! Penilaian Anda telah disimpan.
                </p>
              </div>
            ) : (
              <div>
                <p className="text-xs text-[#476788] mb-2">
                  Beri penilaian untuk laporan yang sudah selesai:
                </p>
                <div className="flex items-center gap-0.5 mb-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setSelectedRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-0.5 transition-transform hover:scale-110 active:scale-95"
                    >
                      <Icon
                        name={star <= (hoverRating || selectedRating) ? "star" : "star_border"}
                        className={`!text-[26px] ${star <= (hoverRating || selectedRating) ? "text-[#F59E0B]" : "text-[#D0DAE8]"} transition-colors`}
                        fill={star <= (hoverRating || selectedRating) ? "currentColor" : undefined}
                      />
                    </button>
                  ))}
                </div>
                <textarea
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                  placeholder="Komentar (opsional)..."
                  rows={2}
                  maxLength={500}
                  className="w-full px-3 py-2 border border-[#c4c5d5] rounded-lg font-body-sm text-body-sm text-[#0F172A] placeholder:text-[#757684] bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20 focus:border-[#1e40af] resize-none mb-3"
                />
                <button
                  type="button"
                  onClick={handleSubmitRating}
                  disabled={selectedRating === 0 || ratingSubmitting}
                  className="w-full py-2.5 bg-gradient-to-r from-[#1e40af] to-[#2e68d8] text-white rounded-lg font-label-sm text-label-sm font-semibold flex items-center justify-center gap-1.5 hover:shadow-lg hover:shadow-[#1e40af]/25 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {ratingSubmitting ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    "Kirim Penilaian"
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
