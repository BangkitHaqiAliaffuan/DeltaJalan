export const REJECT_REASONS = [
  { value: "Foto tidak jelas / buram", label: "Foto tidak jelas / buram" },
  { value: "Lokasi tidak sesuai dengan foto", label: "Lokasi tidak sesuai dengan foto" },
  { value: "Kerusakan tidak signifikan", label: "Kerusakan tidak signifikan" },
  { value: "Duplikat laporan", label: "Duplikat laporan" },
  { value: "Bukan kerusakan jalan", label: "Bukan kerusakan jalan" },
  { value: "Data tidak lengkap", label: "Data tidak lengkap" },
  { value: "Koordinat tidak akurat", label: "Koordinat tidak akurat" },
  { value: "__other__", label: "Lainnya" },
] as const;

export const REJECT_OTHER_VALUE = "__other__";

const REJECT_REASON_REGEX = /\(alasan:\s*(.*?),\s*catatan:/;
const REJECT_CATATAN_REGEX = /catatan:\s*(.*?)\)/;

export function extractRejectReason(systemNotes: string): string | null {
  const match = systemNotes.match(REJECT_REASON_REGEX);
  if (match) return match[1].trim();
  if (systemNotes.includes("alasan:")) {
    const after = systemNotes.split("alasan:")[1];
    if (after) return after.split(",")[0]?.trim() ?? null;
  }
  return null;
}

export function extractRejectCatatan(systemNotes: string): string | null {
  const match = systemNotes.match(REJECT_CATATAN_REGEX);
  if (match) {
    const val = match[1].trim();
    return val === "-" ? null : val;
  }
  return null;
}
