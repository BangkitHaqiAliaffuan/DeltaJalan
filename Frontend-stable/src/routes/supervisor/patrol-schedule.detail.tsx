import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Icon } from "@/components/jk/Icon";
import { getToken } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/aiStore";
import { apiFetch } from "@/lib/api";
import type { PatrolSchedule, SurveyTask, Hari } from "@/types/survey";

export const Route = createFileRoute("/supervisor/patrol-schedule/detail")({
  component: DetailPage,
  validateSearch: (search: Record<string, unknown>) => ({
    id: search.id as string,
  }),
  ssr: false,
});

const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const DAY_ABBR = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function formatDateId(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${parseInt(d)} ${MONTHS[parseInt(m, 10) - 1]} ${y}`;
}

interface ScheduleTask extends SurveyTask {
  reports_count?: number;
}

interface ScheduleDetail extends PatrolSchedule {
  team?: {
    id: string;
    name: string;
    description?: string | null;
    surveyTasks?: ScheduleTask[];
  };
}

function DetailPage() {
  const { id } = Route.useSearch();
  const token = getToken() ?? "";

  const { data, isLoading, error } = useQuery({
    queryKey: ["patrol-schedule", id],
    queryFn: async () => {
      const res = await apiFetch(`${API_BASE_URL}/patrol-schedules/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      return json.data as ScheduleDetail;
    },
  });

  const todayStr = new Date().toISOString().split("T")[0];

  const schedule = data;

  const tasksByDate = useMemo(() => {
    const map = new Map<string, ScheduleTask>();
    for (const task of schedule?.team?.surveyTasks ?? []) {
      if (task.tanggal_patroli) {
        map.set(task.tanggal_patroli, task);
      }
    }
    return map;
  }, [schedule]);

  function isPatrolDay(date: Date): boolean {
    if (!schedule) return false;
    const dayName = DAY_NAMES[date.getDay()] as Hari;
    if (!schedule.hari.includes(dayName)) return false;

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

  const patrolDayMap = useMemo(() => {
    const map = new Map<string, { dayName: string; kecamatan: string }>();
    if (!schedule) return map;

    const start = new Date(schedule.start_date);
    const end = schedule.end_date
      ? new Date(schedule.end_date)
      : new Date(new Date().getFullYear() + 1, 11, 31);
    const kecList = schedule.kecamatan_list ?? [];
    const kecCount = kecList.length;

    if (kecCount === 0) return map;

    let kecIndex = 0;
    const cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    while (cursor <= end) {
      if (isPatrolDay(cursor)) {
        const dateStr = cursor.toISOString().split("T")[0];
        map.set(dateStr, {
          dayName: DAY_NAMES[cursor.getDay()],
          kecamatan: kecList[kecIndex % kecCount],
        });
        kecIndex++;
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return map;
  }, [schedule]);

  const freqLabel: Record<string, string> = {
    setiap_minggu: "Setiap Minggu",
    dua_mingguan: "2 Mingguan",
    bulanan: "Bulanan",
  };

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const calendarWeeks = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const cells: (number | null)[] = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);

    const weeks: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }
    return weeks;
  }, [year, month]);

  function toDateStr(d: number): string {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  function getDateInfo(d: number) {
    const dateStr = toDateStr(d);
    const patrolInfo = patrolDayMap.get(dateStr);
    const task = tasksByDate.get(dateStr);
    const isToday = dateStr === todayStr;
    return { dateStr, patrolInfo, task, isToday };
  }

  const taskCount = schedule?.team?.surveyTasks?.length ?? 0;
  const withReports = (schedule?.team?.surveyTasks ?? []).filter(
    (t) => (t.reports_count ?? 0) > 0
  ).length;

  const prevMonth = () => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

  if (isLoading) {
    return (
      <main className="pb-4">
        <section className="bg-gradient-to-br from-[#1e40af] to-[#2e68d8] p-6 text-white">
          <h1 className="text-xl font-bold tracking-tight">Memuat...</h1>
        </section>
      </main>
    );
  }

  if (error || !schedule) {
    return (
      <main className="pb-4">
        <section className="bg-gradient-to-br from-[#1e40af] to-[#2e68d8] p-6 text-white">
          <h1 className="text-xl font-bold tracking-tight">Jadwal tidak ditemukan</h1>
        </section>
      </main>
    );
  }

  return (
    <main className="pb-4">
      <section className="bg-gradient-to-br from-[#1e40af] to-[#2e68d8] p-5 text-white">
        <h1 className="text-lg font-bold tracking-tight">Detail Jadwal Patroli</h1>
        <p className="text-sm text-blue-200 mt-1">{schedule.team?.name ?? "—"}</p>
      </section>

      <div className="max-w-5xl mx-auto px-4">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 mt-4">
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-[13px]">
            <div>
              <span className="text-[#64748B]">Frekuensi</span>
              <p className="font-semibold text-[#0F172A]">{freqLabel[schedule.frekuensi] ?? schedule.frekuensi}</p>
            </div>
            <div>
              <span className="text-[#64748B]">Status</span>
              <p className={`font-semibold ${schedule.status === "aktif" ? "text-[#10B981]" : "text-[#94A3B8]"}`}>
                {schedule.status === "aktif" ? "Aktif" : "Nonaktif"}
              </p>
            </div>
            <div>
              <span className="text-[#64748B]">Periode</span>
              <p className="font-semibold text-[#0F172A]">
                {formatDateId(schedule.start_date)}
                {schedule.end_date ? ` — ${formatDateId(schedule.end_date)}` : " — ∞"}
              </p>
            </div>
            <div>
              <span className="text-[#64748B]">Jam Patroli</span>
              <p className="font-semibold text-[#0F172A]">
                {schedule.jam_mulai ?? "07:00"} – {schedule.jam_selesai ?? "16:00"} WIB
              </p>
            </div>
            <div>
              <span className="text-[#64748B]">Jenis Tugas</span>
              <p className="font-semibold text-[#0F172A] capitalize">
                {(schedule.alasan_tugas ?? "rutin").replace("_", " ")}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1 mt-4">
            {schedule.hari.map((h) => (
              <span
                key={h}
                className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#1e40af] text-white"
              >
                {h.slice(0, 3)}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap gap-1 mt-3">
            {schedule.kecamatan_list.map((k) => (
              <span
                key={k}
                className="px-2 py-0.5 bg-[#EEF3FA] rounded text-[10px] text-[#476788] font-medium"
              >
                {k}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-bold text-[#0F172A] flex items-center gap-2">
              <Icon name="calendar_month" className="!text-lg text-[#1e40af]" />
              Kalender Patroli
            </h2>
            <div className="flex gap-1 text-[13px] text-[#64748B]">
              <span className="mr-3">{patrolDayMap.size} hari patroli</span>
              <span className="text-[#10B981]">{withReports} dengan laporan</span>
            </div>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0]">
              <button
                onClick={prevMonth}
                className="p-1.5 rounded-lg hover:bg-[#E2E8F0] transition-colors"
              >
                <Icon name="chevron_left" className="!text-xl text-[#475569]" />
              </button>
              <span className="text-[15px] font-bold text-[#0F172A]">
                {MONTHS[month]} {year}
              </span>
              <button
                onClick={nextMonth}
                className="p-1.5 rounded-lg hover:bg-[#E2E8F0] transition-colors"
              >
                <Icon name="chevron_right" className="!text-xl text-[#475569]" />
              </button>
            </div>

            <div className="p-3">
              <div className="grid grid-cols-7 gap-px">
                {DAY_ABBR.map((d) => (
                  <div
                    key={d}
                    className="text-center text-[11px] font-semibold text-[#64748B] uppercase tracking-wider py-2"
                  >
                    {d}
                  </div>
                ))}
                {calendarWeeks.flat().map((day, idx) => {
                  if (day === null) {
                    return <div key={`empty-${idx}`} className="min-h-[80px]" />;
                  }

                  const { dateStr, patrolInfo, task, isToday } = getDateInfo(day);

                  return (
                    <div
                      key={dateStr}
                      className={`min-h-[80px] p-1.5 rounded-lg border transition-colors ${
                        patrolInfo
                          ? task
                            ? "border-[#A7F3D0] bg-[#ECFDF5]"
                            : "border-[#BFDBFE] bg-[#EFF6FF]"
                          : "border-transparent"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-[12px] font-medium leading-tight ${
                            isToday
                              ? "bg-[#1e40af] text-white w-[22px] h-[22px] flex items-center justify-center rounded-full"
                              : patrolInfo
                                ? "text-[#1e40af]"
                                : "text-[#64748B]"
                          }`}
                        >
                          {day}
                        </span>
                        {task && (
                          <Icon
                            name="check_circle"
                            className="!text-[12px] text-[#10B981]"
                          />
                        )}
                      </div>
                      {patrolInfo && (
                        <div className="mt-1">
                          <span
                            className={`block text-[9px] font-semibold leading-tight truncate ${
                              task ? "text-[#047857]" : "text-[#1e40af]"
                            }`}
                          >
                            {patrolInfo.kecamatan}
                          </span>
                          {task && task.reports_count !== undefined && task.reports_count > 0 && (
                            <span className="text-[9px] text-[#64748B] font-medium">
                              {task.reports_count} laporan
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-3 text-[11px] text-[#64748B]">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded border border-[#BFDBFE] bg-[#EFF6FF]" />
              Jadwal patroli
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded border border-[#A7F3D0] bg-[#ECFDF5]" />
              Task sudah digenerate
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-[14px] h-[14px] rounded-full bg-[#1e40af]" />
              Hari ini
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
