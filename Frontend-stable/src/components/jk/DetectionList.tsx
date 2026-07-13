import type { AIDetection } from "@/types/laporan";
import { DetectionCard } from "@/components/jk/DetectionCard";
import { Icon } from "@/components/jk/Icon";

export interface DetectionListProps {
  detections: AIDetection[];
  totalDetections?: number | null;
  overallConfidence?: number | null;
  kerusakanPanjang?: number | null;
  kerusakanLebar?: number | null;
}

export function DetectionList({
  detections,
  totalDetections,
  overallConfidence,
  kerusakanPanjang,
  kerusakanLebar,
}: DetectionListProps) {
  const items = (detections ?? []).filter((d) => {
    const label = d.type || d.class || "";
    return label !== "";
  });

  const hasAnyDetectionData =
    items.length > 0 || totalDetections != null || overallConfidence != null;

  const showFooter =
    kerusakanPanjang != null || kerusakanLebar != null || overallConfidence != null;

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#F1F5F9] flex items-center justify-center">
            <Icon name="insights" className="!text-[16px] text-[#1A4F8A]" />
          </div>
          <span className="text-[13px] font-semibold text-[#0F172A]">Hasil Deteksi AI</span>
        </div>
        {totalDetections != null && (
          <span className="text-[11px] text-[#64748B]">{totalDetections} area</span>
        )}
      </div>

      <hr className="border-[#E2E8F0]" />

      {items.length > 0 ? (
        <div className="divide-y divide-[#E2E8F0]">
          {items.map((det, i) => (
            <DetectionCard
              key={i}
              label={det.type || det.class || ""}
              severity={det.severity ?? "baik"}
              confidence={det.confidence ?? 0}
            />
          ))}
        </div>
      ) : hasAnyDetectionData ? (
        <div className="text-center py-6">
          <div className="w-10 h-10 rounded-full bg-[#F1F5F9] flex items-center justify-center mx-auto mb-2">
            <Icon name="visibility_off" className="!text-[16px] text-[#94A3B8]" />
          </div>
          <p className="text-[12px] text-[#94A3B8]">Tidak ada kerusakan terdeteksi pada foto ini</p>
        </div>
      ) : (
        <div className="text-center py-6">
          <div className="w-10 h-10 rounded-full bg-[#F1F5F9] flex items-center justify-center mx-auto mb-2">
            <Icon name="hourglass_empty" className="!text-[16px] text-[#94A3B8]" />
          </div>
          <p className="text-[12px] text-[#94A3B8]">Belum dianalisis</p>
        </div>
      )}

      {showFooter && (
        <div className="flex items-center gap-3 pt-2 border-t border-[#E2E8F0]">
          {kerusakanPanjang != null && kerusakanLebar != null && (
            <span className="text-[11px] text-[#64748B] flex items-center gap-1">
              <Icon name="straighten" className="!text-[13px]" />
              {kerusakanPanjang}m &times; {kerusakanLebar}m
            </span>
          )}
          {overallConfidence != null && (
            <span className="text-[11px] text-[#64748B] flex items-center gap-1">
              <Icon name="auto_awesome" className="!text-[13px]" />
              {(overallConfidence * 100).toFixed(0)}% yakin
            </span>
          )}
        </div>
      )}
    </div>
  );
}
