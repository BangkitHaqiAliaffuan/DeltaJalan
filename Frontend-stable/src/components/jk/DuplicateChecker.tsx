import { Icon } from "@/components/jk/Icon";
import type { ActiveReport, AddEvidenceState } from "@/hooks/useDuplicateCheck";

interface DuplicateCheckerProps {
  checking: boolean;
  activeReport: ActiveReport | null;
  nearestDistance?: number | null;
  addEvidenceState: AddEvidenceState;
  addEvidenceMessage: string;
  evidenceLimitReached: boolean;
  hasFile: boolean;
  reporterName: string;
  onSendEvidence?: (reportId: string) => void;
  onOverride?: () => void;
}

const EVIDENCE_ALLOWED_STATUSES = ["Menunggu Review"];

const FINAL_STATUSES = ["Disetujui", "Sedang Diperbaiki", "Selesai", "Ditolak"];

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return isoString;
  }
}

export function DuplicateChecker({
  checking,
  activeReport,
  nearestDistance,
  addEvidenceState,
  addEvidenceMessage,
  evidenceLimitReached,
  hasFile,
  reporterName,
  onSendEvidence,
  onOverride,
}: DuplicateCheckerProps) {
  if (checking) {
    return (
      <div className="flex items-center gap-2.5 bg-[#EFF6FF] border border-[#93C5FD] rounded-xl px-4 py-3">
        <span className="w-4 h-4 border-2 border-[#1E40AF]/30 border-t-[#1E40AF] rounded-full animate-spin shrink-0" />
        <p className="text-[12px] text-[#1E40AF] font-medium">Memeriksa laporan di lokasi ini...</p>
      </div>
    );
  }

  if (!activeReport) {
    return (
      <div className="flex items-center gap-2 bg-[#D1FAE5] border border-[#6EE7B7] rounded-xl px-4 py-3">
        <Icon name="check_circle" className="text-[#065F46] !text-[18px] shrink-0" filled />
        <p className="text-[12px] text-[#065F46]">
          Tidak ada laporan aktif di lokasi ini. Anda dapat melanjutkan.
        </p>
      </div>
    );
  }

  const isEvidenceAllowed = EVIDENCE_ALLOWED_STATUSES.includes(activeReport.status);
  const isFinalStatus = FINAL_STATUSES.includes(activeReport.status);

  const isSending = addEvidenceState === "loading";
  const isSuccess = addEvidenceState === "success";
  const isError = addEvidenceState === "error";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2.5 bg-[#FEF3C7] border border-[#FCD34D] rounded-xl px-4 py-3">
        <Icon name="warning" className="text-[#92400E] !text-[20px] shrink-0 mt-0.5" filled />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[#92400E]">Laporan aktif ditemukan</p>
          <p className="text-[12px] text-[#92400E] mt-0.5 leading-relaxed">
            <strong>{activeReport.report_code}</strong> — {activeReport.road_name}, Kec.{" "}
            {activeReport.district}
          </p>
          <p className="text-[11px] text-[#92400E] mt-0.5 opacity-75">
            Dilaporkan pada {formatDate(activeReport.created_at)} &middot; Status:{" "}
            {activeReport.status}
          </p>
          {nearestDistance !== null && nearestDistance !== undefined && (
            <p className="text-[11px] text-[#92400E] mt-0.5 opacity-75">
              Jarak: ~{nearestDistance.toFixed(1)} meter dari lokasi Anda
            </p>
          )}

          {isEvidenceAllowed && onSendEvidence && (
            <div className="mt-2">
              {evidenceLimitReached ? (
                <div className="flex items-start gap-2 bg-[#FEE2E2] border border-[#FCA5A5] rounded-lg px-3 py-2">
                  <Icon name="error" className="text-[#991B1B] !text-[16px] shrink-0 mt-0.5" />
                  <p className="text-[12px] text-[#991B1B] leading-snug">{addEvidenceMessage}</p>
                </div>
              ) : (
                <>
                  <p className="text-[11px] text-[#92400E] mb-2">
                    Laporan ini masih dalam review. Anda dapat melampirkan foto bukti tambahan.
                  </p>

                  {isSuccess && (
                    <div className="flex items-start gap-2 bg-[#D1FAE5] border border-[#6EE7B7] rounded-lg px-3 py-2 mb-2">
                      <Icon
                        name="check_circle"
                        className="text-[#065F46] !text-[16px] shrink-0 mt-0.5"
                        filled
                      />
                      <p className="text-[12px] text-[#065F46] leading-snug">{addEvidenceMessage}</p>
                    </div>
                  )}

                  {isError && (
                    <div className="flex items-start gap-2 bg-[#FEE2E2] border border-[#FCA5A5] rounded-lg px-3 py-2 mb-2">
                      <Icon name="error" className="text-[#991B1B] !text-[16px] shrink-0 mt-0.5" />
                      <p className="text-[12px] text-[#991B1B] leading-snug">{addEvidenceMessage}</p>
                    </div>
                  )}

                  {!isSuccess && (
                    <button
                      type="button"
                      onClick={() => onSendEvidence(activeReport.id)}
                      disabled={isSending || !hasFile}
                      className="flex items-center justify-center gap-2 bg-[#FEF3C7] hover:bg-[#FDE68A] border border-[#FCD34D] text-[#92400E] rounded-xl px-4 py-2 text-[13px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 w-full"
                      title={!hasFile ? "Pilih foto terlebih dahulu" : undefined}
                    >
                      {isSending ? (
                        <>
                          <span className="w-4 h-4 border-2 border-[#92400E]/30 border-t-[#92400E] rounded-full animate-spin" />
                          Mengirim bukti...
                        </>
                      ) : (
                        <>
                          <Icon name="add_a_photo" className="!text-[16px]" />
                          Lampirkan Foto Bukti
                        </>
                      )}
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {isFinalStatus && (
            <p className="text-[11px] text-[#92400E] mt-2 opacity-75">
              Laporan ini sudah diproses (status: {activeReport.status}). Tidak dapat menambahkan
              bukti foto.
            </p>
          )}

          {onOverride && (
            <div className="mt-2 pt-2 border-t border-[#FCD34D]">
              <p className="text-[11px] text-[#92400E] mb-2">
                Jika laporan ini berbeda, Anda dapat tetap melanjutkan upload sebagai laporan baru.
              </p>
              <button
                type="button"
                onClick={onOverride}
                className="flex items-center justify-center gap-2 bg-[#1A4F8A] hover:bg-[#153d6e] text-white rounded-xl px-4 py-2 text-[13px] font-semibold transition-colors active:scale-95 w-full"
              >
                Lanjutkan Upload
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
