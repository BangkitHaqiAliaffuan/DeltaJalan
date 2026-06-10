import { Link } from "@tanstack/react-router";
import { Icon } from "@/components/jk/Icon";
import {
  severityBorder,
  severityBadgeStyle,
  severityDotStyle,
  severityLabel,
  statusBadgeStyle as baseStatusBadgeStyle,
  statusDotStyle,
  formatDate,
} from "@/lib/format";
import type { Laporan } from "@/types/laporan";

const TRUST_LABEL_MAP: Record<string, { dot: string; label: string }> = {
  hijau: { dot: "bg-emerald-500", label: "Tinggi" },
  kuning: { dot: "bg-amber-400", label: "Sedang" },
  merah: { dot: "bg-red-500", label: "Rendah" },
};

const statusBadgeStyle = (s: string) => baseStatusBadgeStyle(s) + " shadow-sm";
const severityBadgeStyleShadow = (s?: string | null) => severityBadgeStyle(s) + " shadow-sm";

function displayStatus(status: string): string {
  return status === "Ditinjau" ? "Menunggu Review" : status;
}

export function ReportCardSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-[#E2E8F0] p-4 animate-pulse">
      <div className="flex gap-4">
        <div className="w-28 h-28 rounded-lg bg-slate-200 shrink-0" />
        <div className="flex-1 space-y-3">
          <div className="flex justify-between">
            <div className="h-4 w-28 bg-slate-200 rounded" />
            <div className="h-4 w-20 bg-slate-200 rounded" />
          </div>
          <div className="h-5 w-44 bg-slate-200 rounded" />
          <div className="h-3 w-32 bg-slate-200 rounded" />
          <div className="flex gap-2">
            <div className="h-6 w-20 bg-slate-200 rounded" />
            <div className="h-6 w-24 bg-slate-200 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

interface ReportCardProps {
  report: Laporan;
}

export function ReportCard({ report }: ReportCardProps) {
  const sevLabel = severityLabel(report.overall_severity ?? report.ai_severity);
  const trust = TRUST_LABEL_MAP[report.trust_label] ?? null;
  const canEdit =
    report.status === "Menunggu Review" ||
    report.status === "Ditinjau" ||
    report.status === "Diedit";
  const isBatch = (report.photos_count ?? 0) > 1;

  return (
    <Link
      to="/detail-report"
      search={{ reportId: report.id }}
      className={`block bg-white rounded-lg border border-[#E2E8F0] hover:border-primary hover:shadow-sm transition-all border-l-4 ${severityBorder(report.overall_severity ?? report.ai_severity)}`}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest(".edit-btn")) {
          e.preventDefault();
        }
      }}
    >
      <div className="p-4">
          {/* Top row: code + status */}
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-2">
              <span className="font-id-code text-id-code text-primary font-bold">
                {report.report_code}
              </span>
              {isBatch && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold">                   <Icon name="photo_library" className="!text-[12px]" />
                  {report.photos_count} foto
                </span>
              )}
            </div>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${statusBadgeStyle(report.status)}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusDotStyle(report.status)}`} />
              {displayStatus(report.status)}
            </span>
          </div>

          {/* Body: thumbnail + info */}
          <div className="flex gap-4">
            <div className="w-28 h-28 rounded-lg bg-surface-container overflow-hidden shrink-0">
              {report.first_photo_url ? (
                <img
                  className="w-full h-full object-cover"
                  src={report.first_photo_url}
                  alt={report.road_name}
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Icon name="photo" className="text-on-surface-variant" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 flex flex-col justify-between">
              <div>
                <h3 className="font-body-md text-body-md font-semibold text-on-surface leading-tight truncate">
                  {report.road_name}
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                  Kec. {report.district}
                </p>

                {/* Metadata row: dimensions + priority + trust */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                  {(report.kerusakan_panjang ?? report.kerusakan_lebar) && (
                    <span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-[#475569]">
                      <Icon name="straighten" className="!text-[14px]" />
                      P: {report.kerusakan_panjang ?? 0}m
                      {report.kerusakan_lebar ? ` | L: ${report.kerusakan_lebar}m` : ""}
                    </span>
                  )}

                  {report.trust_score != null && (
                    <span className="inline-flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface">
                      <span className={`w-2 h-2 rounded-full ${trust?.dot ?? "bg-slate-400"}`} />
                      Kepercayaan: {report.trust_score}
                    </span>
                  )}
                </div>
              </div>

              {/* Bottom: severity badge + date + edit */}
              <div className="flex items-center gap-2 mt-3">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${severityBadgeStyleShadow(sevLabel)}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${severityDotStyle(sevLabel)}`} />
                  {sevLabel}
                </span>
                <span className="flex-1" />
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  {report.created_at ? formatDate(report.created_at) : ""}
                </span>
                {canEdit && (
                  <div
                    className="edit-btn px-3 py-1 bg-blue-50 text-blue-700 text-[11px] font-bold rounded-lg border border-blue-200 hover:bg-blue-100 transition-all cursor-pointer"
                    onClick={() => {
                      window.location.href = `/edit-report?reportId=${report.id}`;
                    }}
                  >
                    Edit
                  </div>
                )}
              </div>
            </div>
          </div>
      </div>
    </Link>
  );
}
