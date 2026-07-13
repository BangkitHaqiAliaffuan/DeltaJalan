import type { StatusDeadline, PriorityLevel } from "@/types/laporan";

const DEADLINE_THRESHOLDS: Record<
  PriorityLevel,
  { review_hours: number; resolution_hours: number }
> = {
  Tinggi: { review_hours: 24, resolution_hours: 72 },
  Sedang: { review_hours: 72, resolution_hours: 168 },
  Rendah: { review_hours: 168, resolution_hours: 336 },
};

export function hitungStatusDeadline(
  report: {
    deadline_review?: string | null;
    deadline_resolusi?: string | null;
    terlambat_review?: boolean;
    terlambat_resolusi?: boolean;
    status?: string;
    priority?: PriorityLevel;
    created_at: string;
  },
  client: boolean,
): { status: StatusDeadline; remaining?: string } {
  if (!client) return { status: "tepat_waktu" };
  const now = new Date();

  if (report.terlambat_review || report.terlambat_resolusi) {
    return { status: "terlambat" };
  }

  // Cek deadline terdekat yang masih berlaku
  const deadlines: { label: string; time: Date | null }[] = [
    { label: "review", time: report.deadline_review ? new Date(report.deadline_review) : null },
    {
      label: "resolution",
      time: report.deadline_resolusi ? new Date(report.deadline_resolusi) : null,
    },
  ];

  for (const d of deadlines) {
    if (!d.time) continue;
    const diffMs = d.time.getTime() - now.getTime();
    if (diffMs < 0 && !["Selesai", "Ditolak"].includes(report.status ?? "")) {
      return { status: "terlambat" };
    }
    // Warning: dalam 25% waktu terakhir sebelum deadline, atau 8 jam sebelum deadline
    const priority = report.priority ?? "Sedang";
    const threshold = DEADLINE_THRESHOLDS[priority]?.review_hours ?? 72;
    const warningWindow = Math.max(8, threshold * 0.25) * 60 * 60 * 1000;
    if (diffMs > 0 && diffMs < warningWindow) {
      const hoursLeft = Math.ceil(diffMs / (60 * 60 * 1000));
      return { status: "mendekati", remaining: `Sisa ${hoursLeft} jam` };
    }
  }

  return { status: "tepat_waktu" };
}

export function formatCountdown(ms: number): string {
  const abs = Math.abs(ms);
  const days = Math.floor(abs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((abs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((abs % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((abs % (1000 * 60)) / 1000);

  if (ms < 0) {
    let s = "Terlambat";
    if (days > 0) s += ` ${days} hari`;
    if (hours > 0 && days < 30) s += ` ${hours} jam`;
    if (days === 0 && mins > 0) s += ` ${mins} mnt`;
    return s;
  }

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} hari`);
  if (hours > 0) parts.push(`${hours} jam`);
  if (days === 0 && mins > 0) parts.push(`${mins} mnt`);
  if (days === 0 && hours === 0) parts.push(`${secs} dtk`);
  return parts.join(" ") || "0 detik";
}

export function hitungProgress(deadline: string, start: string, now: number): { persen: number } {
  const deadlineMs = new Date(deadline).getTime();
  const startMs = new Date(start).getTime();
  const totalMs = deadlineMs - startMs || 1;
  const elapsedMs = now - startMs;
  const persen = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));
  return { persen };
}

export function hitungDeadline(
  priority: PriorityLevel,
  type: "review" | "resolution",
  fromDate: Date = new Date(),
): Date {
  const hours =
    type === "review"
      ? (DEADLINE_THRESHOLDS[priority]?.review_hours ?? 72)
      : (DEADLINE_THRESHOLDS[priority]?.resolution_hours ?? 168);
  return new Date(fromDate.getTime() + hours * 60 * 60 * 1000);
}
