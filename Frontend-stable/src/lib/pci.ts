const CONDITION_MAP: Record<string, { min: number; max: number; color: string }> = {
  Baik: { min: 86, max: 100, color: "#22c55e" },
  "Rusak Ringan": { min: 71, max: 85, color: "#86efac" },
  "Rusak Sedang": { min: 56, max: 70, color: "#eab308" },
  "Rusak Berat": { min: 41, max: 55, color: "#f97316" },
  Kritis: { min: 0, max: 40, color: "#ef4444" },
};

export function pciColor(score: number): string {
  const label = pciConditionLabel(score);
  return CONDITION_MAP[label]?.color ?? "#6b7280";
}

export function pciConditionLabel(score: number): string {
  for (const [label, range] of Object.entries(CONDITION_MAP)) {
    if (score >= range.min && score <= range.max) {
      return label;
    }
  }
  return "Kritis";
}

export function pciBgColor(score: number): string {
  const label = pciConditionLabel(score);
  const map: Record<string, string> = {
    Baik: "bg-green-100 text-green-800",
    "Rusak Ringan": "bg-green-50 text-green-700",
    "Rusak Sedang": "bg-yellow-50 text-yellow-800",
    "Rusak Berat": "bg-orange-50 text-orange-800",
    Kritis: "bg-red-50 text-red-800",
  };
  return map[label] ?? "bg-gray-100 text-gray-800";
}

export function pciDotColor(score: number): string {
  const label = pciConditionLabel(score);
  const map: Record<string, string> = {
    Baik: "bg-green-500",
    "Rusak Ringan": "bg-green-400",
    "Rusak Sedang": "bg-yellow-500",
    "Rusak Berat": "bg-orange-500",
    Kritis: "bg-red-500 animate-pulse",
  };
  return map[label] ?? "bg-gray-400";
}
