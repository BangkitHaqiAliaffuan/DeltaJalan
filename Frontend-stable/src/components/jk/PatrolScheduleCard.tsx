import { useState, useEffect, useRef } from "react";
import { Icon } from "@/components/jk/Icon";
import type { PatrolSchedule, Hari } from "@/types/survey";
import { KECAMATAN_BBOX } from "@/lib/kecamatanBbox";

// ── Constants ──

const ALL_HARI: Hari[] = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

const HARI_LABEL: Record<string, string> = {
  Senin: "Sen",
  Selasa: "Sel",
  Rabu: "Rab",
  Kamis: "Kam",
  Jumat: "Jum",
  Sabtu: "Sab",
  Minggu: "Min",
};

const HARI_NAMA: Record<string, string> = {
  Senin: "Senin",
  Selasa: "Selasa",
  Rabu: "Rabu",
  Kamis: "Kamis",
  Jumat: "Jumat",
  Sabtu: "Sabtu",
  Minggu: "Minggu",
};

// ── Helpers ──

function getKecamatanCenter(kec: string): { lat: number; lng: number } | null {
  const bbox = KECAMATAN_BBOX[kec];
  if (!bbox) return null;
  const [s, w, n, e] = bbox.split(",").map(Number);
  return { lat: (s + n) / 2, lng: (w + e) / 2 };
}

function isPatrolDay(date: Date, schedule: PatrolSchedule): boolean {
  const dayNames = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  const dayName = dayNames[date.getDay()];
  if (!schedule.hari.includes(dayName as Hari)) return false;

  switch (schedule.frekuensi) {
    case "dua_mingguan": {
      const startWeekStart = new Date(schedule.start_date);
      startWeekStart.setDate(startWeekStart.getDate() - startWeekStart.getDay());
      startWeekStart.setHours(0, 0, 0, 0);
      const dateWeekStart = new Date(date);
      dateWeekStart.setDate(dateWeekStart.getDate() - dateWeekStart.getDay());
      dateWeekStart.setHours(0, 0, 0, 0);
      const weeks = Math.floor(
        (dateWeekStart.getTime() - startWeekStart.getTime()) / (7 * 86400000)
      );
      return weeks % 2 === 0;
    }
    case "bulanan": {
      const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const targetDay = date.getDay();
      let firstOccurrence = new Date(firstOfMonth);
      while (firstOccurrence.getDay() !== targetDay) {
        firstOccurrence.setDate(firstOccurrence.getDate() + 1);
      }
      return (
        firstOccurrence.getFullYear() === date.getFullYear() &&
        firstOccurrence.getMonth() === date.getMonth() &&
        firstOccurrence.getDate() === date.getDate()
      );
    }
    default:
      return true;
  }
}

function formatDateId(dateStr: string): string {
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
  const [y, m, d] = dateStr.split("-");
  return `${parseInt(d)} ${months[parseInt(m, 10) - 1]} ${y}`;
}

function todayHariName(): string {
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  return days[new Date().getDay()];
}

const HARI_ORDER = Object.fromEntries(ALL_HARI.map((h, i) => [h, i]));

function sortHariWithKec(hariList: Hari[], kecList: string[]): [Hari[], string[]] {
  const pairs = hariList.map((h, i) => ({ h, k: kecList[i % kecList.length] || "—" }));
  pairs.sort((a, b) => (HARI_ORDER[a.h] ?? 99) - (HARI_ORDER[b.h] ?? 99));
  return [pairs.map((p) => p.h), pairs.map((p) => p.k)];
}

// ── Component ──

interface PatrolScheduleCardProps {
  schedules: PatrolSchedule[];
  isFetching?: boolean;
  compact?: boolean;
}

export function PatrolScheduleCard({
  schedules,
  isFetching = false,
  compact = false,
}: PatrolScheduleCardProps) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (isFetching) {
    return (
      <div className="bg-white border border-[#D0DAE8] rounded-xl p-5 animate-pulse">
        <div className="w-32 h-5 bg-[#D0DAE8] rounded mx-auto mb-3" />
        <div className="w-28 h-4 bg-[#D0DAE8] rounded mx-auto mb-6" />
        <div className="flex flex-wrap justify-center gap-3 mb-6">
          {Array.from({ length: 3 }).map((_, j) => (
            <div key={j} className="w-[130px] h-16 bg-[#D0DAE8] rounded-lg" />
          ))}
        </div>
        <div className="w-full h-9 bg-[#D0DAE8] rounded-lg" />
      </div>
    );
  }

  if (schedules.length === 0) return null;

  const todayHari = todayHariName();

  return (
    <div ref={dropdownRef} className="space-y-3">
      {schedules.map((s) => {
        const rawKec = s.kecamatan_list ?? [];
        const rawHari = s.hari ?? [];
        const [hariList, kecList] = sortHariWithKec(rawHari, rawKec);
        const todayActive = isPatrolDay(new Date(), s) && hariList.includes(todayHari as Hari);
        const todayIdx = hariList.indexOf(todayHari as Hari);
        const todayKec = todayActive ? kecList[todayIdx] : null;

        return (
          <div
            key={s.id}
            className={`bg-white border border-[#E2E8F0] rounded-xl ${compact ? "p-4" : "p-5"}`}
          >
            {/* Header */}
            <div className={`text-center ${compact ? "mb-3" : "mb-4"}`}>
              <h4 className={`font-bold text-[#0F172A] ${compact ? "text-[13px]" : "text-[14px]"}`}>
                {s.team?.name ?? "Tim Satgas"}
              </h4>
              <span className="text-[11px] text-[#64748B]">
                {formatDateId(s.start_date)}
                {s.end_date ? ` — ${formatDateId(s.end_date)}` : " — ∞"}
              </span>
            </div>

            {/* Today highlight (compact) */}
            {compact && todayActive && todayKec && (
              <div className="flex items-center justify-center gap-1.5 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                <span className="text-[12px] font-semibold text-[#10B981]">
                  Hari ini patroli di {todayKec}
                </span>
              </div>
            )}

            {/* Active day cards */}
            <div
              className={`flex flex-wrap justify-center ${
                compact ? "gap-2 mb-3" : "gap-3 mb-4"
              }`}
            >
              {hariList.map((h, i) => {
                const k = kecList[i];
                const isToday = h === todayHari;
                return (
                  <div
                    key={h}
                    className={`flex flex-col items-center rounded-lg border text-center transition-all min-w-0 max-w-full ${
                      compact
                        ? "px-2 py-2 w-[100px]"
                        : "px-3 py-3 w-[130px]"
                    } ${
                      isToday
                        ? "border-[#10B981]/40 bg-[#F0FDF4] ring-2 ring-[#10B981]/20"
                        : "border-[#E2E8F0] bg-white hover:border-[#94A3B8]"
                    }`}
                  >
                    {isToday && !compact && (
                      <span className="text-[9px] font-semibold text-[#10B981] mb-1 uppercase tracking-wide">
                        Hari ini
                      </span>
                    )}
                    <span
                      className={`font-bold text-[#0F172A] ${compact ? "text-[11px]" : "text-[12px]"}`}
                    >
                      {HARI_NAMA[h]}
                    </span>
                    <span
                      className={`text-[#475569] flex items-center gap-0.5 mt-0.5 max-w-full ${
                        compact ? "text-[10px]" : "text-[11px]"
                      }`}
                    >
                      <Icon name="location_on" className="!text-[12px] text-[#94A3B8] shrink-0" />
                      <span className="truncate">{k}</span>
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Full week reference (full mode only) */}
            {!compact && (
              <div className="flex flex-wrap justify-center gap-1.5 mb-4 pt-3 border-t border-[#E2E8F0]">
                <span className="w-full text-[9px] font-semibold text-[#94A3B8] uppercase tracking-wide text-center mb-1">
                  Pekan
                </span>
                {ALL_HARI.map((h) => {
                  const aktif = hariList.includes(h);
                  const isToday = h === todayHari && aktif;
                  return (
                    <span
                      key={h}
                      className={`text-[10px] font-bold transition-colors ${
                        isToday
                          ? "bg-[#1e40af] text-white px-2 py-0.5 rounded-md"
                          : aktif
                            ? "bg-[#EEF3FA] text-[#1e40af] px-2 py-0.5 rounded-md"
                            : "text-[#CBD5E1]"
                      }`}
                    >
                      {HARI_LABEL[h]}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Lihat Wilayah */}
            <div className="relative">
              <button
                onClick={() => setOpenDropdown(openDropdown === s.id ? null : s.id)}
                className={`w-full flex items-center justify-center gap-1.5 ${
                  compact ? "h-8 text-[11px]" : "h-9 text-[12px]"
                } bg-[#EEF3FA] hover:bg-[#E0E9F5] rounded-lg font-semibold text-[#1e40af] transition-colors`}
              >
                <Icon name="map" className={compact ? "!text-[14px]" : "!text-[16px]"} />
                Lihat Wilayah
              </button>

              {openDropdown === s.id && (
                <div className="absolute bottom-full mb-1 left-0 right-0 bg-white border border-[#E2E8F0] rounded-lg shadow-lg z-20 overflow-hidden">
                  {rawKec.map((k) => {
                    const pt = getKecamatanCenter(k);
                    if (!pt) return null;
                    return (
                      <a
                        key={k}
                        href={`https://www.google.com/maps?q=${pt.lat},${pt.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2.5 text-[13px] text-[#0F172A] hover:bg-[#F1F5F9] transition-colors border-b border-[#E2E8F0] last:border-b-0"
                      >
                        <Icon name="location_on" className="!text-[16px] text-[#64748B]" />
                        {k}
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
