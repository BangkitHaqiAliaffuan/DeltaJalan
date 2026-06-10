import type { RingkasanDeadlineResponse } from "@/types/laporan";

interface DeadlineStatsCardsProps {
  data?: RingkasanDeadlineResponse;
  isLoading: boolean;
}

export function DeadlineStatsCards({ data, isLoading }: DeadlineStatsCardsProps) {
  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const { total } = data;
  const breachPct = total.total > 0 ? Math.round((total.terlambat / total.total) * 100) : 0;

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
        <p className="text-[11px] font-medium text-green-700">Tepat Waktu</p>
        <p className="text-2xl font-bold text-green-900 mt-0.5">{total.tepat_waktu}</p>
        <p className="text-[10px] text-green-600 mt-0.5">
          {total.total > 0 ? Math.round((total.tepat_waktu / total.total) * 100) : 0}% dari total
        </p>
      </div>
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
        <p className="text-[11px] font-medium text-yellow-700">Mendekati Deadline</p>
        <p className="text-2xl font-bold text-yellow-900 mt-0.5">{total.mendekati}</p>
        <p className="text-[10px] text-yellow-600 mt-0.5">Segera ditindaklanjuti</p>
      </div>
      <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
        <p className="text-[11px] font-medium text-red-700">Terlewat Deadline</p>
        <p className="text-2xl font-bold text-red-900 mt-0.5">{total.terlambat}</p>
        <p className="text-[10px] text-red-600 mt-0.5">{breachPct}% dari total laporan</p>
      </div>
    </div>
  );
}
