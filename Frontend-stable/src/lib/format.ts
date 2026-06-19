export function formatDate(
  dateStr: string | null | undefined,
  options?: { withTime?: boolean; short?: boolean; fallback?: string },
): string {
  if (!dateStr) return options?.fallback ?? "-";
  try {
    const d = new Date(dateStr);
    const opts: Intl.DateTimeFormatOptions = {
      day: "numeric",
      month: options?.short ? "short" : "long",
      year: "numeric",
    };
    if (options?.withTime) {
      opts.hour = "2-digit";
      opts.minute = "2-digit";
    }
    return d.toLocaleDateString("id-ID", opts);
  } catch {
    return dateStr;
  }
}

export function formatDateTime(iso: string): string {
  return formatDate(iso, { withTime: true, short: true });
}

export function formatDateRelative(dateStr: string, client: boolean): string {
  if (!client) return "";
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) {
      const h = d.getHours().toString().padStart(2, "0");
      const m = d.getMinutes().toString().padStart(2, "0");
      return `Hari ini, ${h}:${m}`;
    }
    if (days === 1) return "Kemarin";
    const months = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

export function severityLabel(severity?: string | null): string {
  const s = (severity ?? "").toLowerCase();
  if (s.includes("berat")) return "Rusak Berat";
  if (s.includes("sedang")) return "Rusak Sedang";
  if (s.includes("ringan")) return "Rusak Ringan";
  return severity ?? "";
}

export function severityBadgeStyle(
  severity?: string | null,
): string {
  const s = (severity ?? "").toLowerCase();
  if (s.includes("berat")) return "bg-[#E11D48] text-white";
  if (s.includes("sedang")) return "bg-orange-50 text-[#F97316] border border-orange-200";
  if (s.includes("ringan")) return "bg-amber-50 text-[#F59E0B] border border-amber-200";
  return "bg-emerald-50 text-[#10B981] border border-emerald-200";
}

export function severityDotStyle(severity?: string | null): string {
  const s = (severity ?? "").toLowerCase();
  if (s.includes("berat")) return "bg-[#E11D48] animate-pulse";
  if (s.includes("sedang")) return "bg-[#F97316]";
  if (s.includes("ringan")) return "bg-[#F59E0B]";
  return "bg-[#10B981]";
}

export function severityBorder(severity?: string | null): string {
  const s = (severity ?? "").toLowerCase();
  if (s.includes("berat")) return "border-l-red-500";
  if (s.includes("sedang")) return "border-l-orange-400";
  if (s.includes("ringan")) return "border-l-amber-400";
  return "border-l-slate-300";
}

export function statusBadgeStyle(status: string): string {
  const map: Record<string, string> = {
    "Menunggu Review": "bg-amber-50 text-[#F59E0B] border border-amber-200",
    Ditinjau: "bg-amber-50 text-[#F59E0B] border border-amber-200",
    Disetujui: "bg-blue-50 text-[#2563EB] border border-blue-200",
    Ditolak: "bg-[#E11D48] text-white border border-[#E11D48]",
    "Sedang Diperbaiki": "bg-orange-50 text-[#F97316] border border-orange-200",
    Selesai: "bg-[#10B981] text-white border border-[#10B981]",
    Diedit: "bg-slate-50 text-[#64748B] border border-slate-200",
  };
  return map[status] ?? "bg-slate-50 text-[#64748B] border border-slate-200";
}

export function statusDotStyle(status: string): string {
  const map: Record<string, string> = {
    "Menunggu Review": "bg-[#F59E0B]",
    Ditinjau: "bg-[#F59E0B]",
    Disetujui: "bg-[#2563EB]",
    Ditolak: "bg-[#E11D48] animate-pulse",
    "Sedang Diperbaiki": "bg-[#F97316]",
    Selesai: "bg-[#10B981]",
    Diedit: "bg-[#64748B]",
  };
  return map[status] ?? "bg-[#64748B]";
}

export function displayStatus(status: string): string {
  if (status === "Ditinjau") return "Menunggu Review";
  return status;
}

export function getSeverityLabel(severity?: string | null): { chip: string; label: string } {
  const s = (severity ?? "").toLowerCase();
  if (s.includes("berat"))
    return { chip: "bg-[#E11D48] text-white", label: "Rusak Berat" };
  if (s.includes("sedang"))
    return { chip: "bg-orange-50 text-[#F97316] border border-orange-200", label: "Rusak Sedang" };
  if (s.includes("ringan"))
    return { chip: "bg-amber-50 text-[#F59E0B] border border-amber-200", label: "Rusak Ringan" };
  return { chip: "bg-slate-50 text-[#64748B] border border-slate-200", label: severity ?? "Baik" };
}

export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(meters: number): string {
  if (meters < 1) return "< 1 m";
  if (meters < 1000) return `~${Math.round(meters)} m`;
  return `~${(meters / 1000).toFixed(1)} km`;
}
