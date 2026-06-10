import type { StatusDeadline } from "@/types/laporan";

interface DeadlineBadgeProps {
  status: StatusDeadline;
  remaining?: string;
  className?: string;
}

const config: Record<StatusDeadline, { bg: string; text: string; label: string }> = {
  tepat_waktu: { bg: "bg-emerald-50 text-[#10B981] border border-emerald-200", text: "text-[#10B981]", label: "Tepat Waktu" },
  mendekati: { bg: "bg-amber-50 text-[#F59E0B] border border-amber-200", text: "text-[#F59E0B]", label: "Mendekati Deadline" },
  terlambat: { bg: "bg-red-50 text-[#E11D48] border border-red-200", text: "text-[#E11D48]", label: "Terlewat" },
};

export function DeadlineBadge({ status, remaining, className = "" }: DeadlineBadgeProps) {
  const c = config[status];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${c.bg} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${status === "tepat_waktu" ? "bg-[#10B981]" : status === "mendekati" ? "bg-[#F59E0B]" : "bg-[#E11D48]"}`} />
      {remaining ?? c.label}
    </span>
  );
}
