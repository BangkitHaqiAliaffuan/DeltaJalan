import { pciColor, pciConditionLabel, pciBgColor } from "@/lib/pci";
import { Icon } from "./Icon";

interface PciCardProps {
  score: number;
  compact?: boolean;
}

export function PciCard({ score, compact }: PciCardProps) {
  const color = pciColor(score);
  const label = pciConditionLabel(score);
  const bgClass = pciBgColor(score);

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${bgClass}`}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
        PCI {Number(score).toFixed(1)} — {label}
      </div>
    );
  }

  const pct = Math.min(Math.max(score, 0), 100);

  return (
    <div className="bg-white border border-[#D0DAE8] rounded-lg p-4 mb-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs text-[#476788] font-medium">Indeks Kondisi Jalan (PCI)</p>
          <p className="text-[28px] font-bold leading-tight mt-0.5" style={{ color }}>
            {Number(score).toFixed(1)}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${bgClass}`}>
          <Icon name="road" className="!text-sm" />
          {label}
        </span>
      </div>

      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-[#476788] mt-0.5">
        <span>0 (Kritis)</span>
        <span>100 (Baik)</span>
      </div>
    </div>
  );
}
