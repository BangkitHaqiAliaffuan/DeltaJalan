import { useState, useEffect } from "react";
import { Icon } from "@/components/jk/Icon";
import { resolveImageUrl } from "@/lib/imageUrl";
import { severityBadgeStyle, severityDotStyle, formatDateRelative } from "@/lib/format";
import { pciColor, pciConditionLabel, pciBgColor } from "@/lib/pci";
import { ReportMap, type ReportMapPoint } from "@/components/jk/ReportMap";
import { DetectionList } from "@/components/jk/DetectionList";
import type { Laporan } from "@/types/laporan";

interface ReviewDrawerProps {
  report: Laporan | null;
  loading: boolean;
  currentIndex: number;
  totalCount: number;
  onApprove: () => void;
  onReject: (alasan: string, catatan?: string) => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  onDetail: () => void;
  approveLoading: boolean;
  rejectLoading: boolean;
}

export function ReviewDrawer({
  report,
  loading,
  currentIndex,
  totalCount,
  onApprove,
  onReject,
  onNext,
  onPrev,
  onClose,
  onDetail,
  approveLoading,
  rejectLoading,
}: ReviewDrawerProps) {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectAlasan, setRejectAlasan] = useState("");
  const [rejectCatatan, setRejectCatatan] = useState("");

  const [imgAspect, setImgAspect] = useState<number | null>(null);
  const [imgError, setImgError] = useState(false);
  const [imgLoading, setImgLoading] = useState(true);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [showAiPhoto, setShowAiPhoto] = useState(false);

  // Reset photo state when report changes
  useEffect(() => {
    setPhotoIdx(0);
    setShowAiPhoto(false);
    setImgAspect(null);
    setImgLoading(true);
    setImgError(false);
  }, [report?.id]);

  // Reset img states when switching photos
  useEffect(() => {
    setShowAiPhoto(false);
    setImgAspect(null);
    setImgLoading(true);
    setImgError(false);
  }, [photoIdx]);

  // Reset img states when toggling AI/original on same photo
  useEffect(() => {
    setImgAspect(null);
    setImgLoading(true);
    setImgError(false);
  }, [showAiPhoto]);

  const mapPoints: ReportMapPoint[] =
    report?.latitude && report?.longitude
      ? [
          {
            id: report.id,
            lat: Number(report.latitude),
            lng: Number(report.longitude),
            label: report.road_name,
          },
        ]
      : [];

  const currentPhotos =
    report?.photos && report.photos.length > 0
      ? report.photos
      : report?.image_original_url
        ? [
            {
              image_original_url: report.image_original_url,
              image_result_url: report.image_result_url,
            },
          ]
        : null;

  const currentPhoto = currentPhotos?.[photoIdx];
  const currentPhotoUrl = currentPhoto?.image_original_url
    ? resolveImageUrl(currentPhoto.image_original_url)
    : resolveImageUrl(report?.first_photo_url);
  const currentAiUrl = currentPhoto?.image_result_url
    ? resolveImageUrl(currentPhoto.image_result_url)
    : resolveImageUrl(report?.image_result_url);

  const displayPhotoUrl =
    showAiPhoto && currentAiUrl && currentAiUrl !== currentPhotoUrl
      ? currentAiUrl
      : currentPhotoUrl;

  function handleRejectSubmit() {
    if (!rejectAlasan.trim()) return;
    onReject(rejectAlasan.trim(), rejectCatatan.trim() || undefined);
    setShowRejectForm(false);
    setRejectAlasan("");
    setRejectCatatan("");
  }

  // Loading state
  if (loading || !report) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#D0DAE8] shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="md:hidden p-1 -ml-1">
              <Icon name="close" className="!text-xl text-[#476788]" />
            </button>
            <div className="w-32 h-4 bg-[#D0DAE8] rounded animate-pulse" />
          </div>
          <div className="flex items-center gap-1">
            <div className="w-16 h-7 bg-[#D0DAE8] rounded animate-pulse" />
            <div className="w-16 h-7 bg-[#D0DAE8] rounded animate-pulse" />
          </div>
        </div>
        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          <div className="aspect-[4/3] bg-[#D0DAE8] rounded-lg animate-pulse" />
          <div className="space-y-3">
            <div className="h-6 w-3/4 bg-[#D0DAE8] rounded animate-pulse" />
            <div className="h-4 w-1/2 bg-[#D0DAE8] rounded animate-pulse" />
            <div className="h-4 w-2/3 bg-[#D0DAE8] rounded animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-1/4 bg-[#D0DAE8] rounded animate-pulse" />
            <div className="h-8 w-full bg-[#D0DAE8] rounded animate-pulse" />
            <div className="h-8 w-full bg-[#D0DAE8] rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  const aiJenisKerusakan = currentPhoto?.ai_jenis_kerusakan;
  const aiConfidence = currentPhoto?.ai_confidence;
  const mobileclipScore = currentPhoto?.mobileclip_score;
  const qualityStatus = currentPhoto?.quality_scores?.status;

  const isOverdue = report.terlambat_review || report.status_deadline === "terlambat";

  const deadlineText = (() => {
    if (!report.deadline_review) return null;
    const diffMs = new Date(report.deadline_review).getTime() - Date.now();
    if (diffMs < 0) return "Terlewat!";
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    if (hours < 1) return "Kurang dari 1 jam";
    if (hours < 24) return `${hours} jam lagi`;
    const days = Math.floor(hours / 24);
    return `${days} hari lagi`;
  })();

  const sourceLabel =
    report.source === "warga" ? "Warga" : report.source === "telegram" ? "Telegram" : "Petugas";
  const sourceBadge =
    report.source === "warga"
      ? "bg-purple-50 text-[#7C3AED] border border-purple-200"
      : report.source === "telegram"
        ? "bg-sky-50 text-[#0284C7] border border-sky-200"
        : "bg-blue-50 text-[#2563EB] border border-blue-200";

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#D0DAE8] shrink-0 bg-white">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={onClose} className="md:hidden p-1 -ml-1" title="Tutup">
            <Icon name="arrow_back" className="!text-xl text-[#476788]" />
          </button>
          <span className="text-sm font-semibold text-[#476788] truncate">{report.road_name}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onPrev}
            disabled={currentIndex <= 0}
            className="p-1.5 rounded-lg hover:bg-[#EEF2FF] disabled:opacity-30 transition-colors"
            title="Sebelumnya"
          >
            <Icon name="chevron_left" className="!text-lg text-[#1e40af]" />
          </button>
          <span className="text-xs font-semibold text-[#476788] whitespace-nowrap tabular-nums">
            {currentIndex + 1} / {totalCount}
          </span>
          <button
            onClick={onNext}
            disabled={currentIndex >= totalCount - 1}
            className="p-1.5 rounded-lg hover:bg-[#EEF2FF] disabled:opacity-30 transition-colors"
            title="Selanjutnya"
          >
            <Icon name="chevron_right" className="!text-lg text-[#1e40af]" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Photo Area */}
        <div
          className="relative w-full bg-[#0F172A] overflow-hidden"
          style={
            imgAspect
              ? { aspectRatio: `${imgAspect}`, maxHeight: "50vh" }
              : { minHeight: 200, maxHeight: "50vh" }
          }
        >
          {imgLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0F172A] z-10">
              <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          )}
          {displayPhotoUrl ? (
            <img
              src={displayPhotoUrl}
              alt={report.road_name}
              className={`w-full h-full object-contain transition-opacity duration-300 ${imgLoading ? "opacity-0" : "opacity-100"}`}
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalWidth && img.naturalHeight && !imgAspect) {
                  setImgAspect(img.naturalWidth / img.naturalHeight);
                }
                setImgLoading(false);
                setImgError(false);
              }}
              onError={() => {
                setImgLoading(false);
                setImgError(true);
              }}
            />
          ) : (
            <div className="w-full h-full min-h-[280px] flex items-center justify-center">
              <Icon name="photo_camera" className="!text-5xl text-[#94A3B8]" />
            </div>
          )}
          {imgError && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0F172A]/80">
              <div className="text-center">
                <Icon name="broken_image" className="!text-4xl text-[#64748B] mb-1" />
                <p className="text-[10px] text-[#94A3B8]">Gagal memuat foto</p>
              </div>
            </div>
          )}

          {/* Photo navigation */}
          {currentPhotos && currentPhotos.length > 1 && (
            <>
              <button
                onClick={() =>
                  setPhotoIdx((i) => (i - 1 + currentPhotos.length) % currentPhotos.length)
                }
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center transition-colors"
                title="Foto sebelumnya"
              >
                <Icon name="chevron_left" className="!text-[18px] text-white" />
              </button>
              <button
                onClick={() => setPhotoIdx((i) => (i + 1) % currentPhotos.length)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center transition-colors"
                title="Foto berikutnya"
              >
                <Icon name="chevron_right" className="!text-[18px] text-white" />
              </button>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                {currentPhotos.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPhotoIdx(i)}
                    className={`h-1.5 rounded-full transition-all ${
                      i === photoIdx ? "w-4 bg-white" : "w-1.5 bg-white/50 hover:bg-white/70"
                    }`}
                    title={`Foto ${i + 1}`}
                  />
                ))}
              </div>
            </>
          )}

          {/* AI toggle — switch between original and AI result */}
          {currentAiUrl && currentAiUrl !== currentPhotoUrl && (
            <div className="absolute top-3 left-3 flex gap-1.5 z-10">
              <button
                onClick={() => setShowAiPhoto(false)}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-colors ${
                  !showAiPhoto
                    ? "bg-[#1e40af] text-white"
                    : "bg-black/50 text-white/60 hover:text-white"
                }`}
              >
                Asli
              </button>
              <button
                onClick={() => setShowAiPhoto(true)}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-colors ${
                  showAiPhoto
                    ? "bg-[#1e40af] text-white"
                    : "bg-black/50 text-white/60 hover:text-white"
                }`}
              >
                Deteksi AI
              </button>
            </div>
          )}
        </div>

        {/* Report Info */}
        <div className="px-4 py-3 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h2 className="text-[15px] font-bold text-[#0F172A] leading-tight">
                {report.road_name}
              </h2>
              <p className="text-[11px] font-mono text-[#476788] mt-0.5">{report.report_code}</p>
            </div>
            {isOverdue && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-[#E11D48] border border-red-200 shrink-0">
                <Icon name="timer_off" className="!text-[10px]" />
                Terlambat
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-[#476788]">
            <span className="flex items-center gap-1.5">
              <Icon name="location_on" className="!text-[15px] text-[#64748B]" />
              Kec. {report.district}
            </span>
            <span className="flex items-center gap-1.5">
              <Icon name="person" className="!text-[15px] text-[#64748B]" />
              {report.reporter_name}
            </span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${sourceBadge}`}>
              {sourceLabel}
            </span>
            {report.created_at && (
              <span className="text-[11px] text-[#94A3B8]">
                {formatDateRelative(report.created_at, true)}
              </span>
            )}
          </div>

          {deadlineText && (
            <div
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-bold ${
                isOverdue
                  ? "bg-red-50 text-[#E11D48] border border-red-200"
                  : deadlineText.includes("jam") && !deadlineText.includes("hari")
                    ? "bg-amber-50 text-[#D97706] border border-amber-200"
                    : "bg-emerald-50 text-[#10B981] border border-emerald-200"
              }`}
            >
              <Icon name={isOverdue ? "warning" : "schedule"} className="!text-[14px]" />
              {isOverdue ? "Terlambat " : ""}Deadline: {deadlineText}
            </div>
          )}

          {/* Full Address */}
          {report.full_address && (
            <div className="flex items-start gap-2 text-[12px] text-[#476788]">
              <Icon name="map" className="!text-[15px] text-[#64748B] mt-0.5 shrink-0" />
              <span>{report.full_address}</span>
            </div>
          )}

          {/* Duplicate Warning */}
          {report.is_duplicate && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
              <Icon name="content_copy" className="!text-[16px] text-[#D97706] mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] font-bold text-[#D97706]">Laporan Duplikat</p>
                <p className="text-[11px] text-[#92400E]">
                  Laporan ini terdeteksi sebagai duplikat dari laporan yang sudah ada
                </p>
              </div>
            </div>
          )}

          {/* System Notes */}
          {report.system_notes && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
              <Icon name="info" className="!text-[16px] text-[#2563EB] mt-0.5 shrink-0" />
              <p className="text-[11px] text-[#475569]">{report.system_notes}</p>
            </div>
          )}

          {/* Map Preview */}
          {report.latitude && report.longitude && (
            <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
              <div className="h-36">
                <ReportMap
                  points={mapPoints}
                  center={[Number(report.latitude), Number(report.longitude)]}
                  zoom={15}
                />
              </div>
              <a
                href={`https://www.google.com/maps?q=${report.latitude},${report.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-semibold text-[#1e40af] bg-white border-t border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors"
              >
                <Icon name="open_in_new" className="!text-[14px]" />
                Buka di Google Maps
              </a>
            </div>
          )}

          {/* Severity & AI Analysis */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${severityDotStyle(report.overall_severity)}`}
              />
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-bold ${severityBadgeStyle(report.overall_severity)}`}
              >
                {report.overall_severity ?? "Belum Dianalisis"}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {qualityStatus && qualityStatus !== "good" && (
                <span className="flex items-center gap-1 text-[11px] text-[#F59E0B]">
                  <Icon name="warning_amber" className="!text-[14px]" />
                  Kualitas: {qualityStatus}
                </span>
              )}
              {report.pci_score != null && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{
                    color: pciColor(report.pci_score),
                    backgroundColor: pciBgColor(report.pci_score),
                  }}
                >
                  <Icon name="road" className="!text-[12px]" />
                  PCI: {report.pci_score} ({pciConditionLabel(report.pci_score)})
                </span>
              )}
              {mobileclipScore != null && (
                <span className="flex items-center gap-1 text-[11px] text-[#476788]">
                  <Icon name="fact_check" className="!text-[14px]" />
                  Relevansi: {(mobileclipScore * 100).toFixed(0)}%
                </span>
              )}
              {(report.kerusakan_panjang || report.kerusakan_lebar) && (
                <span className="flex items-center gap-1 text-[11px] text-[#476788]">
                  <Icon name="straighten" className="!text-[14px]" />
                  {report.kerusakan_panjang ? `${report.kerusakan_panjang} m` : "—"} ×{" "}
                  {report.kerusakan_lebar ? `${report.kerusakan_lebar} m` : "—"}
                </span>
              )}
              {report.assigned_team_name && (
                <span className="flex items-center gap-1 text-[11px] text-[#476788]">
                  <Icon name="groups" className="!text-[14px]" />
                  Tim: {report.assigned_team_name}
                </span>
              )}
            </div>
          </div>

          {/* Detection List per active photo */}
          {currentPhoto && (
            <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
              <DetectionList
                detections={(() => {
                  if (!currentPhoto.ai_raw_output) return [];
                  return Array.isArray(currentPhoto.ai_raw_output)
                    ? currentPhoto.ai_raw_output
                    : (currentPhoto.ai_raw_output as { detections: import("@/types/laporan").AIDetection[] })?.detections ?? [];
                })()}
                totalDetections={currentPhoto.total_detections}
                overallConfidence={currentPhoto.ai_confidence}
                kerusakanPanjang={currentPhoto.kerusakan_panjang}
                kerusakanLebar={currentPhoto.kerusakan_lebar}
              />
            </div>
          )}

          {/* Catatan Petugas */}
          {report.catatan_petugas && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[#FFFBEB] border border-[#FDE68A]">
              <Icon name="edit_note" className="!text-[16px] text-[#D97706] mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] font-semibold text-[#92400E]">Catatan Petugas</p>
                <p className="text-[12px] text-[#475569]">{report.catatan_petugas}</p>
              </div>
            </div>
          )}

          {/* Description */}
          {report.description && (
            <div>
              <p className="text-[11px] font-semibold text-[#476788] mb-1">Deskripsi Pelapor</p>
              <p className="text-[13px] text-[#0F172A] bg-white rounded-xl p-3 border border-[#E2E8F0]">
                {report.description}
              </p>
            </div>
          )}
        </div>
        {/* Reject Form */}
        {showRejectForm && (
          <div className="bg-white">
            <div className="border-t border-[#D0DAE8]" />
            <div className="px-4 py-3 space-y-2">
              <textarea
                value={rejectAlasan}
                onChange={(e) => setRejectAlasan(e.target.value)}
                placeholder="Alasan tolak (wajib)"
                rows={2}
                className="w-full px-3 py-2 border border-[#D0DAE8] rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/25 resize-none"
              />
              <textarea
                value={rejectCatatan}
                onChange={(e) => setRejectCatatan(e.target.value)}
                placeholder="Catatan tambahan (opsional)"
                rows={1}
                className="w-full px-3 py-2 border border-[#D0DAE8] rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/25 resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleRejectSubmit}
                  disabled={!rejectAlasan.trim() || rejectLoading}
                  className="flex-1 px-3 py-2 bg-[#E11D48] text-white text-sm font-bold rounded-lg hover:bg-[#BE123C] disabled:opacity-40 transition-colors"
                >
                  {rejectLoading ? "Menyimpan..." : "Konfirmasi Tolak"}
                </button>
                <button
                  onClick={() => setShowRejectForm(false)}
                  className="px-3 py-2 border border-[#D0DAE8] text-[#476788] text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="border-t border-[#D0DAE8] bg-white px-4 py-3 space-y-2">
          <button
            onClick={onApprove}
            disabled={approveLoading}
            className="w-full py-2.5 md:py-3 min-h-[40px] bg-[#1A4F8A] text-white rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 hover:bg-[#153d6e] active:scale-[0.98] transition-all disabled:opacity-50 shadow-sm"
          >
            <Icon name="check" className="!text-[20px]" />
            {approveLoading ? "Menyetujui..." : "Setujui & Assign Tim"}
          </button>
          <div className="flex gap-3">
            <button
              onClick={() => setShowRejectForm(true)}
              disabled={rejectLoading}
              className="flex-1 py-2 md:py-2.5 min-h-[36px] bg-[#FFF5F5] border border-[#FECACA] text-[#DC2626] rounded-xl text-[12px] font-semibold flex items-center justify-center gap-1.5 hover:bg-[#FEF2F2] hover:border-[#F87171] active:scale-95 transition-all disabled:opacity-50"
            >
              <Icon name="close" className="!text-[16px]" />
              {showRejectForm ? "Tutup Form" : "Tolak"}
            </button>
            <button
              onClick={onDetail}
              className="flex-1 flex py-2 md:py-2.5 min-h-[36px] rounded-xl text-[12px] font-semibold items-center justify-center gap-1.5 bg-[#F8FAFC] border border-[#CBD5E1] text-[#475569] hover:bg-[#F1F5F9] hover:border-[#94A3B8] active:scale-95 transition-all"
            >
              <Icon name="open_in_new" className="!text-[16px]" />
              Detail
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
