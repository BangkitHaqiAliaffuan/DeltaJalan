import { TrustLabel, TrustBreakdown } from "../../types/laporan";
import { Icon } from "@/components/jk/Icon";

interface TrustBadgeProps {
  score: number;
  label: TrustLabel;
  breakdown?: TrustBreakdown;
  showDetail?: boolean;
  compact?: boolean;
}

const CONFIG: Record<
  TrustLabel,
  {
    bg: string;
    text: string;
    border: string;
    desc: string;
    icon: string;
  }
> = {
  hijau: {
    bg: "bg-emerald-50",
    text: "text-[#059669]",
    border: "border-emerald-200",
    desc: "Kredibel",
    icon: "verified",
  },
  kuning: {
    bg: "bg-amber-50",
    text: "text-[#D97706]",
    border: "border-amber-200",
    desc: "Perlu review",
    icon: "running_with_errors",
  },
  merah: {
    bg: "bg-red-50",
    text: "text-[#DC2626]",
    border: "border-red-200",
    desc: "Diragukan",
    icon: "error",
  },
};

const BREAKDOWN_LABELS: Record<string, string> = {
  exif_gps: "GPS EXIF",
  nama_jalan: "Nama jalan",
  ai_deteksi: "Deteksi AI",
  konteks_visual: "Konteks foto",
  fake_gps: "Keaslian GPS",
};

export function TrustBadge({ score, label, breakdown, showDetail = false, compact = false }: TrustBadgeProps) {
  const c = CONFIG[label] ?? CONFIG.merah;

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${c.bg} ${c.text} ${c.border}`}
        title={`Trust Score: ${score}/100 — ${c.desc}`}
      >
        <Icon name={c.icon} className="!text-[14px]" />
        {c.desc} {score}
      </span>
    );
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg
                    text-xs font-medium border ${c.bg} ${c.text} ${c.border}`}
        title={`Trust Score: ${score}/100 — ${c.desc}`}
      >
        {score}/100 — {c.desc}
      </span>

      {showDetail && breakdown && (
        <div className="mt-1 space-y-0.5 min-w-[160px]">
          {Object.entries(breakdown).map(([key, val]) => (
            <div
              key={key}
              className="flex items-center justify-between text-xs text-on-surface-variant"
            >
              <span>{BREAKDOWN_LABELS[key] ?? key}</span>
              <span className={val.nilai > 0 ? "text-green-600 font-medium" : "text-red-400"}>
                {val.nilai > 0 ? `+${val.nilai}` : "\u2014"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
