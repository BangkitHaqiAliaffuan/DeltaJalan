import { Icon } from "./Icon";

export type AnalyzeStage = "gps" | "analyzing";

interface AnalyzingOverlayProps {
  stage: AnalyzeStage;
  variant: "single" | "batch";
  batchCount?: number;
  batchProgress?: number;
}

const STAGE_CONFIG: Record<
  AnalyzeStage,
  { icon: string; label: string }
> = {
  gps: {
    icon: "my_location",
    label: "Mendapatkan lokasi GPS...",
  },
  analyzing: {
    icon: "search",
    label: "Menganalisis kerusakan jalan...",
  },
};

export function AnalyzingOverlay({
  stage,
  variant,
  batchCount,
  batchProgress,
}: AnalyzingOverlayProps) {
  const cfg = STAGE_CONFIG[stage];
  const batchLabel =
    variant === "batch" && batchCount != null
      ? `Menganalisis ${batchCount} foto...`
      : null;
  const progressLabel =
    variant === "batch" && batchProgress != null && batchCount != null
      ? `Memproses foto ${Math.min(batchProgress + 1, batchCount)}/${batchCount}`
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-5">
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-[#EEF2FF] flex items-center justify-center">
            <Icon name={cfg.icon} className="!text-3xl text-[#1e40af]" filled />
          </div>
          <span className="absolute -bottom-1 -right-1 w-6 h-6 border-2 border-white border-t-[#1e40af] rounded-full animate-spin" />
        </div>

        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-[15px] font-bold text-[#0F172A]">
            {stage === "gps"
              ? "Mencari lokasi"
              : variant === "batch"
                ? "Menganalisis Batch"
                : "Menganalisis Foto"}
          </p>
          <p className="text-[13px] text-[#475569]">{cfg.label}</p>
          {batchLabel && (
            <p className="text-[12px] text-[#64748B] mt-1">{batchLabel}</p>
          )}
          {progressLabel && (
            <div className="w-full mt-2">
              <div className="h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#1e40af] rounded-full transition-all duration-300"
                  style={{
                    width: `${((batchProgress ?? 0) / (batchCount ?? 1)) * 100}%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-[#64748B] mt-1.5">
                {progressLabel}
              </p>
            </div>
          )}
        </div>

        <p className="text-[11px] text-[#94A3B8] text-center">
          Mohon tunggu, jangan tutup halaman ini
        </p>
      </div>
    </div>
  );
}
