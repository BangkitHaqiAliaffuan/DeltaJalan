import { Icon } from "@/components/jk/Icon";
import { SafeImage } from "@/components/jk/SafeImage";
import { resolveImageUrl } from "@/lib/imageUrl";
import type { ProgressUpdate } from "@/types/laporan";

interface ProgressTimelineProps {
  updates: ProgressUpdate[];
  estimasiHari?: number | null;
}

function formatDayHeader(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const months = [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
    ];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return iso;
  }
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function ProgressTimeline({ updates, estimasiHari }: ProgressTimelineProps) {
  if (!updates || updates.length === 0) return null;

  const grouped: Record<number, ProgressUpdate[]> = {};
  for (const u of updates) {
    const day = u.day_number ?? 1;
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(u);
  }

  const sortedDays = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
      <h3 className="font-label-md text-[13px] font-bold text-[#0F172A] mb-3 flex items-center gap-1.5">
        <Icon name="image" className="!text-lg text-[#1A4F8A]" />
        Progress Perbaikan
      </h3>
      <div className="relative">
        {sortedDays.map((day, dayIdx) => {
          const dayUpdates = grouped[day];
          const isLastDay = dayIdx === sortedDays.length - 1;
          return (
            <div key={day} className="relative pb-5 last:pb-0">
              {!isLastDay && (
                <div
                  className="absolute left-[15px] top-8 w-0.5 bg-[#D0DAE8]"
                  style={{ height: "calc(100% + 4px)" }}
                />
              )}
              <div className="relative z-10 mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-[#EFF6FF] border border-[#BFDBFE]">
                    <span className="text-[11px] font-bold text-[#2563EB]">{day}</span>
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-[#0F172A]">
                      Hari {day}
                      {estimasiHari ? ` dari ${estimasiHari}` : ""}
                    </p>
                    <p className="text-[11px] text-[#64748B]">
                      {formatDayHeader(dayUpdates[0]?.created_at)} &middot; {dayUpdates.length} foto
                    </p>
                  </div>
                </div>
              </div>
              <div className="ml-12 space-y-3">
                {dayUpdates.map((u) => (
                  <div key={u.id} className="flex gap-3">
                    <div className="w-20 h-16 shrink-0 rounded-lg overflow-hidden border border-[#E2E8F0]">
                      <SafeImage
                        src={u.foto_url ? resolveImageUrl(u.foto_url) ?? "" : ""}
                        alt="Progress"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold text-[#0F172A]">
                          {u.user_name ?? "Petugas"}
                        </p>
                        <span className="text-[10px] text-[#94A3B8] shrink-0">
                          {formatTime(u.created_at)}
                        </span>
                      </div>
                      {u.catatan && (
                        <p className="text-[11px] text-[#475569] leading-relaxed line-clamp-2">
                          {u.catatan}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
