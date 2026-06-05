/**
 * StatusBadge — komponen badge reusable sesuai design.md §6.4
 *
 * Level kerusakan: "baik" | "ringan" | "sedang" | "berat"
 * Status laporan : "diproses" | "selesai" | "ditolak" | "menunggu"
 */

type DamageLevel = "baik" | "ringan" | "sedang" | "berat";
type ReportStatus = "diproses" | "selesai" | "ditolak" | "menunggu";
type BadgeVariant = DamageLevel | ReportStatus;

const LABELS: Record<BadgeVariant, string> = {
  baik: "Baik",
  ringan: "Rusak Ringan",
  sedang: "Rusak Sedang",
  berat: "Rusak Berat",
  diproses: "Diproses",
  selesai: "Selesai",
  ditolak: "Ditolak",
  menunggu: "Menunggu",
};

const CLASS_MAP: Record<BadgeVariant, string> = {
  baik: "badge-baik",
  ringan: "badge-ringan",
  sedang: "badge-sedang",
  berat: "badge-berat",
  diproses: "badge-diproses",
  selesai: "badge-selesai",
  // tolak & menunggu pakai warna diproses/berat sebagai fallback
  ditolak: "badge-berat",
  menunggu: "badge-ringan",
};

/**
 * Normalize string dari API (misalnya "Rusak Berat", "rusak_berat", "SEDANG")
 * ke BadgeVariant yang dikenali.
 */
export function normalizeVariant(raw: string): BadgeVariant {
  const s = raw.toLowerCase().replace(/[^a-z]/g, "");
  if (s.includes("berat")) return "berat";
  if (s.includes("sedang")) return "sedang";
  if (s.includes("ringan")) return "ringan";
  if (s.includes("baik")) return "baik";
  if (s.includes("selesai") || s.includes("done")) return "selesai";
  if (s.includes("proses") || s.includes("sedangdiperbaiki")) return "diproses";
  if (s.includes("tolak") || s.includes("reject")) return "ditolak";
  return "menunggu";
}

interface StatusBadgeProps {
  /** Jenis badge — bisa literal BadgeVariant atau string bebas dari API */
  variant: BadgeVariant | string;
  /** Override label default */
  label?: string;
  className?: string;
}

export function StatusBadge({ variant, label, className = "" }: StatusBadgeProps) {
  const normalized = normalizeVariant(variant);
  const badgeClass = CLASS_MAP[normalized];
  const displayLabel = label ?? LABELS[normalized];

  return <span className={`${badgeClass} ${className}`}>{displayLabel}</span>;
}
