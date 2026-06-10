import type { StatusDeadline, PriorityLevel } from "@/types/laporan";

const DEADLINE_THRESHOLDS: Record<PriorityLevel, { review_hours: number; resolution_hours: number }> = {
  Tinggi: { review_hours: 24, resolution_hours: 72 },
  Sedang: { review_hours: 72, resolution_hours: 168 },
  Rendah: { review_hours: 168, resolution_hours: 336 },
};

export function hitungStatusDeadline(report: {
  deadline_review?: string | null;
  deadline_resolusi?: string | null;
  terlambat_review?: boolean;
  terlambat_resolusi?: boolean;
  status?: string;
  priority?: PriorityLevel;
  created_at: string;
}, client: boolean): { status: StatusDeadline; remaining?: string } {
  if (!client) return { status: "tepat_waktu" };
  const now = new Date();

  if (report.terlambat_review || report.terlambat_resolusi) {
    return { status: "terlambat" };
  }

  // Cek deadline terdekat yang masih berlaku
  const deadlines: { label: string; time: Date | null }[] = [
    { label: "review", time: report.deadline_review ? new Date(report.deadline_review) : null },
    { label: "resolution", time: report.deadline_resolusi ? new Date(report.deadline_resolusi) : null },
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

export function hitungDeadline(
  priority: PriorityLevel,
  type: "review" | "resolution",
  fromDate: Date = new Date(),
): Date {
  const hours = type === "review"
    ? DEADLINE_THRESHOLDS[priority]?.review_hours ?? 72
    : DEADLINE_THRESHOLDS[priority]?.resolution_hours ?? 168;
  return new Date(fromDate.getTime() + hours * 60 * 60 * 1000);
}
