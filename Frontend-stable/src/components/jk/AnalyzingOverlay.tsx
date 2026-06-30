import { Icon } from "./Icon";

export type AnalyzeStage = "gps" | "analyzing" | "processing" | "complete";

interface AnalyzingOverlayProps {
  stage: AnalyzeStage;
  variant: "single" | "batch";
  batchCount?: number;
  batchProgress?: number;
}

const STAGE_CONFIG: Record<AnalyzeStage, { icon: string; label: string }> = {
  gps: {
    icon: "my_location",
    label: "Mendapatkan lokasi GPS...",
  },
  analyzing: {
    icon: "search",
    label: "AI menganalisis kerusakan jalan...",
  },
  processing: {
    icon: "description",
    label: "Memproses hasil deteksi...",
  },
  complete: {
    icon: "check_circle",
    label: "Mengalihkan ke halaman hasil...",
  },
};

const TITLE_MAP: Record<AnalyzeStage, string> = {
  gps: "Mencari Lokasi",
  analyzing: "Menganalisis Foto",
  processing: "Memproses Hasil",
  complete: "Analisis Selesai",
};

export function AnalyzingOverlay({
  stage,
  variant,
  batchCount,
  batchProgress,
}: AnalyzingOverlayProps) {
  const cfg = STAGE_CONFIG[stage];
  const batchLabel =
    variant === "batch" && batchCount != null && stage === "analyzing"
      ? `Menganalisis ${batchCount} foto...`
      : null;
  const progressLabel =
    variant === "batch" && batchProgress != null && batchCount != null
      ? `Foto ${Math.min(batchProgress + 1, batchCount)}/${batchCount}`
      : null;
  const isComplete = stage === "complete";
  const isLoading = stage === "gps" || stage === "analyzing";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-5">
        <div className="relative">
          {isLoading ? (
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-2 border-[#E2E8F0] border-t-[#1e40af] animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-[#EEF2FF] flex items-center justify-center">
                  <Icon name={cfg.icon} className="!text-2xl text-[#1e40af]" filled />
                </div>
              </div>
            </div>
          ) : (
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center ${
                isComplete ? "bg-green-50" : "bg-[#EEF2FF]"
              }`}
            >
              <Icon
                name={cfg.icon}
                className={`!text-3xl ${isComplete ? "text-green-500" : "text-[#1e40af]"}`}
                filled
              />
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-[15px] font-bold text-[#0F172A]">
            {variant === "batch" && stage === "analyzing" ? "Menganalisis Batch" : TITLE_MAP[stage]}
          </p>
          <p className="text-[13px] text-[#475569]">{cfg.label}</p>
          {batchLabel && <p className="text-[12px] text-[#64748B] mt-1">{batchLabel}</p>}
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
              <p className="text-[11px] text-[#64748B] mt-1.5">{progressLabel}</p>
            </div>
          )}
        </div>

        {!isComplete && (
          <p className="text-[11px] text-[#94A3B8] text-center">
            Mohon tunggu, jangan tutup halaman ini
          </p>
        )}
      </div>
    </div>
  );
}
