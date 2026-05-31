import { TrustLabel, TrustBreakdown } from "../../types/laporan";

interface TrustBadgeProps {
  score: number;
  label: TrustLabel;
  breakdown?: TrustBreakdown;
  showDetail?: boolean;
}

const CONFIG: Record<
  TrustLabel,
  {
    bg: string;
    text: string;
    border: string;
    desc: string;
  }
> = {
  hijau: {
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
    desc: "Kredibel",
  },
  kuning: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    desc: "Perlu review",
  },
  merah: {
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    desc: "Diragukan",
  },
};

const BREAKDOWN_LABELS: Record<string, string> = {
  exif_gps: "GPS EXIF",
  nama_jalan: "Nama jalan",
  ai_deteksi: "Deteksi AI",
  konteks_visual: "Konteks foto",
  fake_gps: "Keaslian GPS",
};

export function TrustBadge({ score, label, breakdown, showDetail = false }: TrustBadgeProps) {
  const c = CONFIG[label] ?? CONFIG.merah;

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
