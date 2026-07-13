import { getClassConfig, getSeverityConfig } from "@/lib/aiStore";
import { Icon } from "@/components/jk/Icon";

export interface DetectionCardProps {
  label: string;
  severity: string;
  confidence: number;
}

export function DetectionCard({ label, severity, confidence }: DetectionCardProps) {
  if (!label) return null;

  const classCfg = getClassConfig(label);
  const sevCfg = getSeverityConfig(severity);
  const pct = confidence != null ? Math.round(confidence * 100) : 0;

  return (
    <div className="flex items-stretch gap-3 py-2.5">
      <div className={`w-[3px] shrink-0 rounded-full ${sevCfg.bg}`} />
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{
          backgroundColor: `${classCfg.color}1A`,
          border: `1.5px solid ${classCfg.color}30`,
        }}
      >
        <Icon name={classCfg.icon} className="!text-[19px]" style={{ color: classCfg.color }} />
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <p className="text-[13px] font-semibold text-[#0F172A] leading-tight">{label}</p>
        <span className="text-[11px] mt-0.5">{sevCfg.label}</span>
      </div>
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
        style={{
          border: `2px solid ${sevCfg.color}`,
          backgroundColor: `${sevCfg.color}14`,
        }}
      >
        <span className="text-[11px] font-bold leading-none" style={{ color: sevCfg.color }}>
          {pct}%
        </span>
      </div>
    </div>
  );
}
