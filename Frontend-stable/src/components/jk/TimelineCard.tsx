import { Icon } from "@/components/jk/Icon";
import type { TimelineEvent } from "@/types/laporan";

interface TimelineCardProps {
  events: TimelineEvent[];
}

const EVENT_STYLE: Record<
  string,
  { icon: string; color: string; bg: string; border: string; line: string }
> = {
  laporan_dibuat: {
    icon: "description",
    color: "#1A4F8A",
    bg: "#EFF6FF",
    border: "#BFDBFE",
    line: "#93C5FD",
  },
  ditinjau: {
    icon: "visibility",
    color: "#2563EB",
    bg: "#EFF6FF",
    border: "#BFDBFE",
    line: "#93C5FD",
  },
  disetujui: {
    icon: "verified",
    color: "#16A34A",
    bg: "#F0FDF4",
    border: "#BBF7D0",
    line: "#86EFAC",
  },
  ditolak: { icon: "cancel", color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", line: "#FCA5A5" },
  disposisi: {
    icon: "assignment",
    color: "#D97706",
    bg: "#FFFBEB",
    border: "#FDE68A",
    line: "#FCD34D",
  },
  perbaikan_dimulai: {
    icon: "construction",
    color: "#D97706",
    bg: "#FFFBEB",
    border: "#FDE68A",
    line: "#FCD34D",
  },
  perbaikan_selesai: {
    icon: "check_circle",
    color: "#16A34A",
    bg: "#F0FDF4",
    border: "#BBF7D0",
    line: "#86EFAC",
  },
  dibuka_kembali: {
    icon: "replay",
    color: "#7C3AED",
    bg: "#F5F3FF",
    border: "#DDD6FE",
    line: "#C4B5FD",
  },
  menunggu_review: {
    icon: "hourglass_empty",
    color: "#6B7280",
    bg: "#F9FAFB",
    border: "#E5E7EB",
    line: "#D1D5DB",
  },
  ditugaskan: {
    icon: "person_add",
    color: "#2563EB",
    bg: "#EFF6FF",
    border: "#BFDBFE",
    line: "#93C5FD",
  },
  triage: {
    icon: "edit_note",
    color: "#6B7280",
    bg: "#F9FAFB",
    border: "#E5E7EB",
    line: "#D1D5DB",
  },
  diedit: { icon: "edit", color: "#6B7280", bg: "#F9FAFB", border: "#E5E7EB", line: "#D1D5DB" },
  status_changed: {
    icon: "swap_horiz",
    color: "#6B7280",
    bg: "#F9FAFB",
    border: "#E5E7EB",
    line: "#D1D5DB",
  },
};

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return (
      d.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }) +
      " " +
      d.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      })
    );
  } catch {
    return iso;
  }
}

export function TimelineCard({ events }: TimelineCardProps) {
  if (!events || events.length === 0) return null;

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
      <style>{`
        @keyframes timeline-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
        .timeline-end-icon { animation: timeline-pulse 2s ease-in-out infinite; }
      `}</style>
      <h3 className="font-label-md text-[13px] font-bold text-[#0F172A] mb-3">
        Timeline Perbaikan
      </h3>
      <div className="relative">
        {events.map((evt, idx) => {
          const style = EVENT_STYLE[evt.event] ?? EVENT_STYLE.status_changed;
          const isLast = idx === events.length - 1;

          return (
            <div key={idx} className="relative flex gap-3 pb-5 last:pb-0">
              {/* Vertical connecting line */}
              {!isLast && (
                <div
                  className="absolute left-[15px] top-8 w-0.5"
                  style={{ backgroundColor: style.line, height: "calc(100% + 4px)", zIndex: 0 }}
                />
              )}

              {/* Dot */}
              <div
                className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isLast ? "timeline-end-icon" : ""}`}
                style={{ backgroundColor: style.bg, borderColor: style.border, borderWidth: 1 }}
              >
                <Icon name={style.icon} className="!text-[16px]" style={{ color: style.color }} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-[12px] font-semibold text-[#0F172A]">{evt.label}</p>
                <p className="text-[11px] text-[#64748B] mt-0.5">
                  {formatDateTime(evt.timestamp)}
                  {evt.actor_name ? ` — ${evt.actor_name}` : ""}
                </p>
                {evt.notes && evt.notes !== "Laporan dibuat" && !evt.notes.startsWith("[") && (
                  <p className="text-[12px] text-[#475569] mt-1 leading-relaxed">{evt.notes}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
