import { Icon } from "./Icon";
import { ModalBase } from "./ModalBase";
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
    badgeText: string;
  }
> = {
  no_exif_date: {
    icon: "info",
    badgeText: "TANPA METADATA",
  },
  too_old: {
    icon: "event_busy",
    badgeText: "FOTO KADALUARSA",
  },
  future_date: {
    icon: "running_with_errors",
    badgeText: "TANGGAL TIDAK VALID",
  },
  exif_read_error: {
    icon: "info",
    badgeText: "METADATA TIDAK TERBACA",
  },
  no_gps: {
    icon: "location_off",
    badgeText: "TANPA GPS",
  },
  valid: {
    icon: "check_circle",
    badgeText: "VALID",
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
  if (!isOpen || status === "valid") return null;

  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.no_exif_date;

  const tipText = isWarningOnly
    ? 'Foto tetap dapat diupload. Isi koordinat lokasi secara manual pada form di bawah, atau gunakan tombol "Gunakan GPS Saya" untuk mengambil koordinat dari perangkat Anda.'
    : "Gunakan tombol Kamera untuk mengambil foto langsung, atau pilih foto JPG asli dari kamera perangkat Anda (bukan screenshot atau foto yang diunduh).";

  return (
    <ModalBase
      onClose={onClose}
      icon={cfg.icon}
      badge={cfg.badgeText}
      title={title}
      footer={
        isWarningOnly ? (
          <button
            type="button"
            onClick={onClose}
            className="w-full h-11 bg-[#1A4F8A] text-white rounded-lg text-[14px] font-semibold flex items-center justify-center gap-2 hover:bg-[#153d6e] active:scale-95 transition-all"
          >
            <Icon name="check" className="!text-[18px]" />
            Mengerti, Lanjutkan
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="w-full h-11 bg-[#1A4F8A] text-white rounded-lg text-[14px] font-semibold flex items-center justify-center gap-2 hover:bg-[#153d6e] active:scale-95 transition-all"
          >
            <Icon name="arrow_back" className="!text-[18px]" />
            Pilih Foto Lain
          </button>
        )
      }
    >
      <p className="text-[13px] text-[#0F172A] leading-relaxed">{message}</p>
      <div className="mt-3 bg-[#F5F7FA] border border-[#D0DAE8] rounded-lg p-3 flex items-start gap-2">
        <Icon name="lightbulb" className="text-[#F59E0B] !text-[18px] shrink-0 mt-0.5" filled />
        <p className="text-[11px] text-[#475569] leading-relaxed">{tipText}</p>
      </div>
    </ModalBase>
  );
}
