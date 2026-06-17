import type { TrustLabel } from "@/types/laporan";
import { Icon } from "./Icon";

export function BadgeStatCard({
  iconName,
  value,
  label,
  gradientFrom,
  gradientTo,
  borderColor,
  iconColor,
  textColor,
  suffix,
}: {
  iconName: string;
  value: string;
  label: string;
  gradientFrom: string;
  gradientTo: string;
  borderColor: string;
  iconColor: string;
  textColor: string;
  suffix?: string;
}) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 aspect-square group transition-all duration-200 ease-out hover:scale-[1.03] hover:shadow-md"
      style={{
        background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
        border: `1px solid ${borderColor}`,
      }}
    >
      <div className="flex items-center justify-center gap-1.5">
        <Icon
          name={iconName}
          className="!text-2xl group-hover:scale-110 group-hover:-translate-y-0.5 transition-transform duration-200 shrink-0"
          style={{ color: iconColor }}
        />
        <span className="text-2xl font-bold" style={{ color: iconColor }}>
          {value}
          {suffix && <span className="text-sm font-medium ml-0.5" style={{ color: iconColor, opacity: 0.7 }}>{suffix}</span>}
        </span>
      </div>
      <p className="text-sm font-medium text-center" style={{ color: textColor, opacity: 0.8 }}>{label}</p>
    </div>
  );
}

export const SEVERITY_BERAT  = { from: "#FEF2F2", border: "#FECACA", icon: "#DC2626", text: "#991B1B" };
export const SEVERITY_SEDANG = { from: "#FFF7ED", border: "#FED7AA", icon: "#EA580C", text: "#9A3412" };
export const SEVERITY_RINGAN = { from: "#FFFBEB", border: "#FDE68A", icon: "#D97706", text: "#92400E" };

export const STATUS_STYLES: Record<string, { from: string; border: string; icon: string; text: string }> = {
  "Menunggu Review": { from: "#FFFBEB", border: "#FDE68A", icon: "#D97706", text: "#92400E" },
  Ditinjau:          { from: "#FFFBEB", border: "#FDE68A", icon: "#D97706", text: "#92400E" },
  Disetujui:         { from: "#EFF6FF", border: "#BFDBFE", icon: "#2563EB", text: "#1E3A5F" },
  Ditolak:           { from: "#FEF2F2", border: "#FECACA", icon: "#DC2626", text: "#991B1B" },
  "Sedang Diperbaiki": { from: "#FFF7ED", border: "#FED7AA", icon: "#EA580C", text: "#9A3412" },
  Selesai:           { from: "#ECFDF5", border: "#A7F3D0", icon: "#059669", text: "#065F46" },
  Diedit:            { from: "#F8FAFC", border: "#E2E8F0", icon: "#64748B", text: "#475569" },
};

export const TRUST_STYLES: Record<string, { from: string; border: string; icon: string; text: string; label: string }> = {
  hijau:  { from: "#ECFDF5", border: "#A7F3D0", icon: "#059669", text: "#065F46", label: "Kredibel" },
  kuning: { from: "#FFFBEB", border: "#FDE68A", icon: "#D97706", text: "#92400E", label: "Perlu Review" },
  merah:  { from: "#FEF2F2", border: "#FECACA", icon: "#DC2626", text: "#991B1B", label: "Diragukan" },
};

export type SeverityKey = "Rusak Berat" | "Rusak Sedang" | "Rusak Ringan" | "Baik" | "berat" | "sedang" | "ringan" | "baik";

export function severityIcon(sev: string | undefined | null): string {
  const s = (sev ?? "").toLowerCase();
  if (s === "rusak berat" || s === "berat") return "gpp_maybe";
  if (s === "rusak sedang" || s === "sedang") return "priority_high";
  if (s === "rusak ringan" || s === "ringan") return "info";
  if (s === "baik") return "check_circle";
  return "road";
}

export function statusIcon(status: string): string {
  if (status === "Ditolak") return "cancel";
  if (status === "Selesai") return "check_circle";
  if (status === "Disetujui") return "verified";
  if (status === "Sedang Diperbaiki") return "construction";
  if (status === "Diedit") return "edit";
  return "rate_review";
}

export function trustIcon(l: TrustLabel): string {
  if (l === "hijau") return "verified";
  if (l === "kuning") return "running_with_errors";
  return "error";
}

export function statusCardStyle(s: string) {
  return STATUS_STYLES[s] ?? STATUS_STYLES["Menunggu Review"];
}

export function statusGradient(s: string) { return STATUS_STYLES[s]?.from ?? "#FFFBEB"; }
export function statusBorder(s: string) { return STATUS_STYLES[s]?.border ?? "#FDE68A"; }
export function statusIconColor(s: string) { return STATUS_STYLES[s]?.icon ?? "#D97706"; }
export function statusTextColor(s: string) { return STATUS_STYLES[s]?.text ?? "#92400E"; }
export function trustLabel(l: TrustLabel) { return TRUST_STYLES[l]?.label ?? "Diragukan"; }
export function trustGradient(l: TrustLabel) { return TRUST_STYLES[l]?.from ?? "#FEF2F2"; }
export function trustBorder(l: TrustLabel) { return TRUST_STYLES[l]?.border ?? "#FECACA"; }
export function trustIconColor(l: TrustLabel) { return TRUST_STYLES[l]?.icon ?? "#DC2626"; }
export function trustTextColor(l: TrustLabel) { return TRUST_STYLES[l]?.text ?? "#991B1B"; }

export function trustCardStyle(l: TrustLabel) {
  return TRUST_STYLES[l] ?? TRUST_STYLES.merah;
}
