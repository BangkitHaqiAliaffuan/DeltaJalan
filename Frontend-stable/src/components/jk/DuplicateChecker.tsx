import { Icon } from "@/components/jk/Icon";
import type {
  ActiveReport,
  AddEvidenceState,
  DuplicateSummary,
  PhotoResult,
} from "@/hooks/useDuplicateCheck";

interface DuplicateCheckerProps {
  checking: boolean;
  activeReport: ActiveReport | null;
  nearestDistance?: number | null;
  photoResults: PhotoResult[];
  summary: DuplicateSummary;
  addEvidenceState: AddEvidenceState;
  addEvidenceMessage: string;
  evidenceLimitReached: boolean;
  hasFile: boolean;
  reporterName: string;
  hasCoordinate?: boolean;
  evidenceCount?: number;
  onSendEvidence?: () => void;
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

function isEvidenceAllowed(report: ActiveReport | null): boolean {
  return report !== null && EVIDENCE_ALLOWED_STATUSES.includes(String(report.status));
}

function PhotoBadgeList({ results }: { results: PhotoResult[] }) {
  return (
    <ul className="mt-2 flex flex-col gap-1">
      {results.map((r) => {
        const valid = r.class === "valid";
        const label =
          r.class === "spatial_dup"
            ? `duplikat lokasi — ${r.report?.report_code ?? "laporan aktif"}${r.distance != null ? ` (~${r.distance.toFixed(1)}m)` : ""}`
            : r.class === "hash_dup"
              ? `foto sudah dipakai — ${r.report?.report_code ?? "laporan aktif"}`
              : "berbeda — dapat dikirim";
        return (
          <li
            key={r.index}
            className={`flex items-start gap-1.5 text-[11px] ${valid ? "text-[#065F46]" : "text-[#92400E]"}`}
          >
            <Icon
              name={valid ? "check_circle" : "warning"}
              className={`!text-[14px] shrink-0 mt-0.5 ${valid ? "text-[#065F46]" : "text-[#92400E]"}`}
            />
            <span>
              Foto {r.index + 1}: {label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function DuplicateChecker({
  checking,
  activeReport,
  nearestDistance,
  photoResults,
  summary,
  addEvidenceState,
  addEvidenceMessage,
  evidenceLimitReached,
  hasFile,
  reporterName,
  hasCoordinate,
  evidenceCount,
  onSendEvidence,
  onOverride,
}: DuplicateCheckerProps) {
  if (import.meta.env.VITE_DEDUP_ENABLED === "false") return null;
  if (checking) {
    return (
      <div className="flex items-center gap-2.5 bg-[#EFF6FF] border border-[#93C5FD] rounded-xl px-4 py-3">
        <span className="w-4 h-4 border-2 border-[#1E40AF]/30 border-t-[#1E40AF] rounded-full animate-spin shrink-0" />
        <p className="text-[12px] text-[#1E40AF] font-medium">Memeriksa laporan di lokasi ini...</p>
      </div>
    );
  }

  const isSending = addEvidenceState === "loading";
  const isSuccess = addEvidenceState === "success";
  const isError = addEvidenceState === "error";

  // ── Mode per-foto (foto sudah dipilih) ──────────────────────────────
  if (photoResults.length > 0) {
    const dups = photoResults.filter((r) => r.class !== "valid");
    const eligibleEvidence = photoResults.filter(
      (r) => r.class === "spatial_dup" && isEvidenceAllowed(r.report),
    );
    const canEvidence = eligibleEvidence.length > 0 && !!onSendEvidence && !evidenceLimitReached;
    const hasValid = summary.valid_count > 0;

    if (dups.length === 0) {
      return (
        <div className="flex flex-col gap-2 bg-[#D1FAE5] border border-[#6EE7B7] rounded-xl px-4 py-3">
          <div className="flex items-center gap-2">
            <Icon name="check_circle" className="text-[#065F46] !text-[18px] shrink-0" />
            <p className="text-[12px] text-[#065F46]">
              Tidak ada laporan aktif untuk foto-foto ini. Anda dapat melanjutkan.
            </p>
          </div>
          <PhotoBadgeList results={photoResults} />
        </div>
      );
    }

    if (dups.length === 1 && hasValid) {
      const dup = dups[0];
      return (
        <div className="flex flex-col gap-2 bg-[#FEF3C7] border border-[#FCD34D] rounded-xl px-4 py-3">
          <div className="flex items-start gap-2.5">
            <Icon name="info" className="text-[#92400E] !text-[18px] shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] text-[#92400E] leading-relaxed">
                1 foto dilewati karena sudah tercatat pada laporan{" "}
                <strong>{dup.report?.report_code ?? "laporan aktif"}</strong>. Foto lainnya tetap dapat dikirim.
              </p>
            </div>
          </div>
          <PhotoBadgeList results={photoResults} />
        </div>
      );
    }

    const anyClosed = dups.some(
      (r) => r.report !== null && FINAL_STATUSES.includes(String(r.report.status)),
    );

    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-2.5 bg-[#FEF3C7] border border-[#FCD34D] rounded-xl px-4 py-3">
          <Icon name="warning" className="text-[#92400E] !text-[20px] shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-[#92400E]">Laporan aktif ditemukan</p>
            <p className="text-[12px] text-[#92400E] mt-0.5 leading-relaxed">
              {summary.duplicate_count} foto Anda sudah tercatat pada laporan yang ada.{" "}
              {hasValid
                ? "Foto baru tidak dibuatkan laporan terpisah."
                : "Tidak ada foto baru yang dapat dikirim."}
            </p>
            <PhotoBadgeList results={photoResults} />

            {canEvidence ? (
              <div className="mt-2">
                {evidenceLimitReached ? (
                  <div className="flex items-start gap-2 bg-[#FEE2E2] border border-[#FCA5A5] rounded-lg px-3 py-2">
                    <Icon name="error" className="text-[#991B1B] !text-[16px] shrink-0 mt-0.5" />
                    <p className="text-[12px] text-[#991B1B] leading-snug">{addEvidenceMessage}</p>
                  </div>
                ) : (
                  <>
                    <p className="text-[11px] text-[#92400E] mb-2 leading-snug">
                      Laporan {eligibleEvidence[0].report?.report_code} masih dalam review. Anda
                      dapat melampirkan foto bukti tambahan — tidak membuat laporan baru.
                    </p>

                    {isSuccess && (
                      <div className="flex items-start gap-2 bg-[#D1FAE5] border border-[#6EE7B7] rounded-lg px-3 py-2 mb-2">
                        <Icon
                          name="check_circle"
                          className="text-[#065F46] !text-[16px] shrink-0"
                        />
                        <p className="text-[12px] text-[#065F46] leading-snug">
                          {addEvidenceMessage}
                        </p>
                      </div>
                    )}

                    {isError && (
                      <div className="flex items-start gap-2 bg-[#FEE2E2] border border-[#FCA5A5] rounded-lg px-3 py-2 mb-2">
                        <Icon name="error" className="text-[#991B1B] !text-[16px] shrink-0 mt-0.5" />
                        <p className="text-[12px] text-[#991B1B] leading-snug">
                          {addEvidenceMessage}
                        </p>
                      </div>
                    )}

                    {!isSuccess && (
                      <button
                        type="button"
                        onClick={() => onSendEvidence?.()}
                        disabled={isSending || !hasFile || evidenceCount === 0}
                        className="flex items-center justify-center gap-2 bg-[#FEF3C7] hover:bg-[#FDE68A] border border-[#FCD34D] text-[#92400E] rounded-xl px-4 py-2 text-[13px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 w-full"
                        title={
                          !hasFile || evidenceCount === 0
                            ? "Pilih foto terlebih dahulu"
                            : undefined
                        }
                      >
                        {isSending ? (
                          <>
                            <span className="w-4 h-4 border-2 border-[#92400E]/30 border-t-[#92400E] rounded-full animate-spin" />
                            Mengirim bukti...
                          </>
                        ) : (
                          <>
                            <Icon name="add_a_photo" className="!text-[16px]" />
                            Lampirkan {evidenceCount ?? eligibleEvidence.length} Foto Bukti
                          </>
                        )}
                      </button>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="mt-2 flex flex-col gap-2">
                {anyClosed && (
                  <p className="text-[11px] text-[#991B1B] font-medium leading-snug">
                    Lokasi ini sudah memiliki laporan yang ditindaklanjuti. Tidak dapat menambahkan
                    bukti atau membuat laporan baru di lokasi yang sama.
                  </p>
                )}
                {hasValid ? (
                  <p className="text-[11px] text-[#92400E] opacity-75 leading-snug">
                    Foto yang duplikat akan dilewati. Foto berbeda tetap dapat dikirim sebagai
                    laporan baru.
                  </p>
                ) : (
                  <p className="text-[11px] text-[#92400E] opacity-75 leading-snug">
                    Tidak ada foto baru yang dapat dikirim.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Mode lama (foto belum dipilih, cek berbasis koordinat form) ─────
  if (!activeReport) {
    if (!hasCoordinate) return null;
    return (
      <div className="flex items-center gap-2 bg-[#D1FAE5] border border-[#6EE7B7] rounded-xl px-4 py-3">
        <Icon name="check_circle" className="text-[#065F46] !text-[18px] shrink-0" filled />
        <p className="text-[12px] text-[#065F46]">
          Tidak ada laporan aktif di lokasi ini. Anda dapat melanjutkan.
        </p>
      </div>
    );
  }

  const isFinalStatus = FINAL_STATUSES.includes(activeReport.status);

  const isNearby =
    nearestDistance !== null && nearestDistance !== undefined && nearestDistance <= 6;

  const isRejected = activeReport.status === "Ditolak";
  const isClosed = isFinalStatus && !isRejected;
  const shouldBlockOverride = (isNearby || isEvidenceAllowed(activeReport)) && !isRejected;

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

          {isEvidenceAllowed(activeReport) && !evidenceLimitReached && (
            <p className="text-[11px] font-semibold text-[#92400E] mt-2 bg-[#FDE68A] border border-[#FCD34D] rounded-lg px-2.5 py-1.5">
              Catatan penting: Foto yang Anda kirim akan menjadi <strong>bukti foto tambahan</strong>{" "}
              pada laporan yang sudah ada.
            </p>
          )}

          {isEvidenceAllowed(activeReport) && onSendEvidence && (
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
                      <p className="text-[12px] text-[#065F46] leading-snug">
                        {addEvidenceMessage}
                      </p>
                    </div>
                  )}

                  {isError && (
                    <div className="flex items-start gap-2 bg-[#FEE2E2] border border-[#FCA5A5] rounded-lg px-3 py-2 mb-2">
                      <Icon name="error" className="text-[#991B1B] !text-[16px] shrink-0 mt-0.5" />
                      <p className="text-[12px] text-[#991B1B] leading-snug">
                        {addEvidenceMessage}
                      </p>
                    </div>
                  )}

                  {!isSuccess && (
                    <button
                      type="button"
                      onClick={() => onSendEvidence?.()}
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

          {isNearby && isClosed && (
            <p className="text-[11px] text-[#991B1B] mt-2 font-medium">
              Lokasi ini sudah memiliki laporan dengan status &ldquo;{activeReport.status}&rdquo;.
              Tidak dapat membuat laporan baru di lokasi yang sudah ditindaklanjuti.
            </p>
          )}

          {isFinalStatus && !(isNearby && isClosed) && (
            <p className="text-[11px] text-[#92400E] mt-2 opacity-75">
              {isNearby && isRejected
                ? "Laporan sebelumnya ditolak. Anda dapat mengirim ulang dengan bukti yang lebih baik."
                : `Laporan ini sudah diproses (status: ${activeReport.status}). Tidak dapat menambahkan bukti foto.`}
            </p>
          )}

          {onOverride && !shouldBlockOverride && (
            <div className="mt-2 pt-2 border-t border-[#FCD34D]">
              <p className="text-[11px] text-[#92400E] mb-2">
                {isNearby && isRejected
                  ? "Laporan sebelumnya ditolak. Anda dapat mengirim ulang dengan bukti yang lebih baik."
                  : "Jika laporan ini berbeda, Anda dapat tetap melanjutkan upload sebagai laporan baru."}
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
