/**
 * FraudWarningModal
 *
 * Modal peringatan anti-fraud untuk foto yang tidak lolos validasi tanggal EXIF.
 *
 * Dua mode:
 * - isWarningOnly=false (default): foto DITOLAK, tombol "Pilih Foto Lain"
 * - isWarningOnly=true: foto DIIZINKAN tapi perlu GPS manual, tombol "Mengerti, Lanjutkan"
 *
 * Menggunakan Portal untuk render ke document.body — ini WAJIB untuk semua modal
 * agar fixed inset-0 benar-benar cover seluruh viewport termasuk sidebar.
 */

import { useEffect } from "react";
import { Icon } from "./Icon";
import { Portal } from "./Portal";
import type { PhotoDateValidationStatus } from "@/lib/validatePhotoDate";

interface FraudWarningModalProps {
  isOpen: boolean;
  status: PhotoDateValidationStatus;
  title: string;
  message: string;
  onClose: () => void;
  /**
   * true  = hanya peringatan, upload tetap lanjut (no_exif_date / exif_read_error)
   * false = foto ditolak, user harus pilih foto lain (too_old / future_date)
   */
  isWarningOnly?: boolean;
}

const STATUS_CONFIG: Record<
  PhotoDateValidationStatus,
  {
    icon: string;
    iconColor: string;
    headerBg: string;
    headerBorder: string;
    badgeText: string;
    badgeBg: string;
    badgeTextColor: string;
  }
> = {
  no_exif_date: {
    icon: "info",
    iconColor: "text-[#92400E]",
    headerBg: "bg-[#FEF3C7]",
    headerBorder: "border-[#FCD34D]",
    badgeText: "TANPA METADATA",
    badgeBg: "bg-[#FEF3C7]",
    badgeTextColor: "text-[#92400E]",
  },
  too_old: {
    icon: "event_busy",
    iconColor: "text-[#92400E]",
    headerBg: "bg-[#FEF3C7]",
    headerBorder: "border-[#FCD34D]",
    badgeText: "FOTO KADALUARSA",
    badgeBg: "bg-[#FEF3C7]",
    badgeTextColor: "text-[#92400E]",
  },
  future_date: {
    icon: "running_with_errors",
    iconColor: "text-[#991B1B]",
    headerBg: "bg-[#FEE2E2]",
    headerBorder: "border-[#FCA5A5]",
    badgeText: "TANGGAL TIDAK VALID",
    badgeBg: "bg-[#FEE2E2]",
    badgeTextColor: "text-[#991B1B]",
  },
  exif_read_error: {
    icon: "info",
    iconColor: "text-[#92400E]",
    headerBg: "bg-[#FEF3C7]",
    headerBorder: "border-[#FCD34D]",
    badgeText: "METADATA TIDAK TERBACA",
    badgeBg: "bg-[#FEF3C7]",
    badgeTextColor: "text-[#92400E]",
  },
  valid: {
    icon: "check_circle",
    iconColor: "text-[#065F46]",
    headerBg: "bg-[#D1FAE5]",
    headerBorder: "border-[#6EE7B7]",
    badgeText: "VALID",
    badgeBg: "bg-[#D1FAE5]",
    badgeTextColor: "text-[#065F46]",
  },
};

export function FraudWarningModal({
  isOpen,
  status,
  title,
  message,
  onClose,
  isWarningOnly = false,
}: FraudWarningModalProps) {
  // Lock body scroll saat modal terbuka
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Tutup dengan Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen || status === "valid") return null;

  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.no_exif_date;

  // Teks tips berbeda tergantung mode
  const tipText = isWarningOnly
    ? 'Foto tetap dapat diupload. Isi koordinat lokasi secara manual pada form di bawah, atau gunakan tombol "Gunakan GPS Saya" untuk mengambil koordinat dari perangkat Anda.'
    : "Gunakan tombol Kamera untuk mengambil foto langsung, atau pilih foto JPG asli dari kamera perangkat Anda (bukan screenshot atau foto yang diunduh).";

  return (
    <Portal>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.55)" }}
        onClick={onClose}
        aria-hidden="true"
      >
        <div
          className="w-full max-w-sm bg-white rounded-xl border border-[#D0DAE8] shadow-lg"
          style={{ maxHeight: "90vh", overflowY: "auto" }}
          onClick={(e) => e.stopPropagation()}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="fraud-modal-title"
          aria-describedby="fraud-modal-desc"
        >
          <div
            className={`${cfg.headerBg} border-b ${cfg.headerBorder} px-5 py-4 flex items-start gap-3`}
          >
            <div className="w-10 h-10 rounded-lg bg-white/60 flex items-center justify-center shrink-0">
              <Icon name={cfg.icon} className={`${cfg.iconColor} !text-[24px]`} />
            </div>
            <div className="flex-1 min-w-0">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider ${cfg.badgeBg} ${cfg.badgeTextColor} border border-black/10 mb-1.5`}
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {cfg.badgeText}
              </span>
              <h2
                id="fraud-modal-title"
                className="text-[16px] font-bold text-on-surface leading-tight"
              >
                {title}
              </h2>
            </div>
          </div>

          <div className="px-5 py-4">
            <p
              id="fraud-modal-desc"
              className="text-[13px] text-on-surface-variant leading-relaxed"
            >
              {message}
            </p>

            <div className="mt-4 bg-[#F5F7FA] border border-[#D0DAE8] rounded-lg p-3 flex items-start gap-2">
              <Icon
                name="lightbulb"
                className="text-[#F59E0B] !text-[18px] shrink-0 mt-0.5"
                filled
              />
              <p className="text-[11px] text-on-surface-variant leading-relaxed">{tipText}</p>
            </div>
          </div>

          <div className="px-5 pb-5 flex flex-col gap-2">
            {isWarningOnly ? (
              <button
                type="button"
                onClick={onClose}
                className="w-full h-11 bg-primary text-white rounded-lg text-[14px] font-semibold flex items-center justify-center gap-2 hover:bg-[#163F6E] active:scale-95 transition-all"
              >
                <Icon name="check" className="!text-[18px]" />
                Mengerti, Lanjutkan
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="w-full h-11 bg-primary text-white rounded-lg text-[14px] font-semibold flex items-center justify-center gap-2 hover:bg-[#163F6E] active:scale-95 transition-all"
              >
                <Icon name="arrow_back" className="!text-[18px]" />
                Pilih Foto Lain
              </button>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
