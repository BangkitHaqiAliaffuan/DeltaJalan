import { Link } from "@tanstack/react-router";
import { Icon } from "@/components/jk/Icon";
import { SafeImage } from "@/components/jk/SafeImage";
import { LabeledBadge, BadgeChip } from "@/components/jk/LabeledBadge";
import { TrustBadge } from "@/components/jk/TrustBadge";
import {
  getSeverityLabel,
  severityBadgeStyle,
  severityDotStyle,
  statusBadgeStyle,
  statusDotStyle,
  formatDateRelative,
  formatDate,
  displayStatus,
} from "@/lib/format";
import type { Laporan, TrustLabel } from "@/types/laporan";

export type ReportCardVariant = "supervisor" | "petugas" | "home";

interface ReportCardActions {
  onMulai?: (id: string) => void;
  onDelete?: (id: string) => void;
  actionLoading?: boolean | string;
  mulaiTarget?: string | null;
}

interface ReportCardExtra {
  isClient?: boolean;
  uprList?: { id: string; name: string; wilayah?: string }[];
}

interface ReportCardProps {
  report: Laporan;
  variant?: ReportCardVariant;
  actions?: ReportCardActions;
  extra?: ReportCardExtra;
}

const SEVERITY_COLOR_MAP: Record<string, string> = {
  "Rusak Berat": "#E11D48",
  "Rusak Sedang": "#F97316",
  "Rusak Ringan": "#F59E0B",
  "Baik": "#10B981",
};

function priorityBadgeStyle(priority: string | undefined | null): string {
  const map: Record<string, string> = {
    Tinggi: "bg-red-50 text-[#E11D48] border border-red-200",
    Sedang: "bg-orange-50 text-[#F97316] border border-orange-200",
    Rendah: "bg-emerald-50 text-[#10B981] border border-emerald-200",
  };
  return map[priority ?? ""] ?? "bg-slate-50 text-[#64748B] border border-slate-200";
}

function priorityIcon(priority: string | undefined | null): string {
  const map: Record<string, string> = {
    Tinggi: "priority_high",
    Sedang: "remove",
    Rendah: "arrow_downward",
  };
  return map[priority ?? ""] ?? "remove";
}

export function ReportCardSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-[#E2E8F0] animate-pulse">
      <div className="flex gap-4 p-4">
        <div className="w-[100px] h-[100px] rounded-sm bg-slate-200 shrink-0" />
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

function PetugasReportCard({ report, actions, isClient }: {
  report: Laporan;
  actions?: ReportCardActions;
  isClient: boolean;
}) {
  const sc = getSeverityLabel(report.overall_severity ?? report.ai_severity);
  const severityColor = SEVERITY_COLOR_MAP[report.overall_severity ?? report.ai_severity ?? ""] ?? "#64748B";
  const trustLabel = (report.trust_label as TrustLabel) ?? "merah";
  const trustColor = trustLabel === "hijau" ? "#059669" : trustLabel === "kuning" ? "#D97706" : "#DC2626";

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ease-out overflow-hidden flex flex-col">
      {/* Image thumbnail */}
      <Link to="/detail-report" search={{ reportId: report.id }} className="block group">
        <div className="aspect-[4/3] overflow-hidden bg-[#E8F0FA]">
          {report.first_photo_url ? (
            <SafeImage
              src={report.first_photo_url}
              alt=""
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Icon name="photo" className="!text-5xl text-[#C4D4E6]" />
            </div>
          )}
        </div>
      </Link>

      {/* Content body */}
      <div className="flex-1 flex flex-col p-4 gap-2">

        {/* Title + sub-detail */}
        <Link to="/detail-report" search={{ reportId: report.id }} className="no-underline block">
          <h4 className="text-[15px] font-bold text-[#0F172A] leading-tight line-clamp-2">
            {report.road_name}
          </h4>
        </Link>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-[#1e40af] font-mono tracking-tight">
            {report.report_code}
          </span>
          <span className="text-[10px] text-[#CBD5E1]">•</span>
          <span className="text-[10px] text-[#94A3B8]">
            {report.created_at ? formatDateRelative(report.created_at, isClient) : "-"}
          </span>
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${statusDotStyle(report.status)}`} />
          <span className="text-[11px] font-semibold text-[#475569]">{displayStatus(report.status)}</span>
        </div>

        {/* Location */}
        <div className="flex items-center gap-1 text-[10px] text-[#64748B]">
          <Icon name="location_on" className="!text-[12px] text-[#94A3B8] shrink-0" />
          <span className="truncate">{report.district ?? "-"}</span>
        </div>

        {/* Divider */}
        <div className="h-px bg-[#F1F5F9] -mx-4" />

        {/* 2×2 Detail grid */}
        <div className="grid grid-cols-2 gap-y-2.5 gap-x-3 pt-1">
          {/* Tingkat */}
          <div>
            <p className="text-[9px] font-bold text-[#94A3B8] uppercase tracking-[0.1em] mb-0.5">Tingkat</p>
            <div className="flex items-center gap-1">
              <Icon name="warning" className="!text-[12px] shrink-0" style={{ color: severityColor }} />
              <span className="text-[11px] font-semibold text-[#0F172A] truncate">{sc.label}</span>
            </div>
          </div>
          {/* Dimensi */}
          <div>
            <p className="text-[9px] font-bold text-[#94A3B8] uppercase tracking-[0.1em] mb-0.5">Dimensi</p>
            <div className="flex items-center gap-1">
              <Icon name="straighten" className="!text-[12px] text-[#64748B] shrink-0" />
              <span className="text-[11px] font-semibold text-[#0F172A]">
                {report.kerusakan_panjang || report.kerusakan_lebar
                  ? `P: ${report.kerusakan_panjang ?? "-"}m • L: ${report.kerusakan_lebar ?? "-"}m`
                  : "-"}
              </span>
            </div>
          </div>
          {/* Kepercayaan */}
          <div>
            <p className="text-[9px] font-bold text-[#94A3B8] uppercase tracking-[0.1em] mb-0.5">Kepercayaan</p>
            <div className="flex items-center gap-1">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: trustColor }}
              />
              <span className="text-[11px] font-semibold" style={{ color: trustColor }}>
                {trustLabel === "hijau" ? "Kredibel" : trustLabel === "kuning" ? "Perlu Review" : "Diragukan"} {report.trust_score ?? 0}
              </span>
            </div>
          </div>
          {/* Pelapor */}
          <div>
            <p className="text-[9px] font-bold text-[#94A3B8] uppercase tracking-[0.1em] mb-0.5">Pelapor</p>
            <div className="flex items-center gap-1">
              <Icon name="person" className="!text-[12px] text-[#64748B] shrink-0" />
              <span className="text-[11px] font-semibold text-[#0F172A] truncate">
                {report.reporter_name ?? "Anonim"}
              </span>
            </div>
          </div>
        </div>

        {/* Spacer to push actions to bottom */}
        <div className="flex-1" />

        {/* Divider */}
        <div className="h-px bg-[#F1F5F9] -mx-4" />

        {/* Footer: deadline + actions */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {!["Selesai", "Ditolak"].includes(report.status) && (
              <span className="text-[10px] text-[#64748B] truncate">
                Deadline: {(() => {
                  const deadline = (report as any).deadline_resolusi ?? (report as any).deadline_review;
                  if (!deadline) return "-";
                  const diffMs = new Date(deadline).getTime() - Date.now();
                  if (diffMs < 0) return "Terlambat!";
                  const hours = Math.floor(diffMs / (1000 * 60 * 60));
                  if (hours < 1) return "Kurang dari 1 jam";
                  if (hours < 24) return `${hours} jam`;
                  const days = Math.floor(hours / 24);
                  return `${days} hari`;
                })()}
              </span>
            )}
            {(report as any).status_deadline === "terlambat" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-[#E11D48] border border-red-200 whitespace-nowrap shrink-0">
                <Icon name="timer_off" className="!text-[10px]" />
                Terlambat
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {report.status === "Disetujui" && (
              <button
                onClick={() => actions?.onMulai?.(report.id)}
                disabled={actions?.actionLoading === report.id}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-[#1e40af] text-white text-[10px] font-bold rounded-lg hover:bg-[#173bab] disabled:opacity-40 transition-colors"
              >
                <Icon name="play_arrow" className="!text-[12px]" />
                Mulai
              </button>
            )}
            {report.status === "Sedang Diperbaiki" && (
              <Link
                to="/complete-report"
                search={{ reportId: report.id }}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-[#1e40af] text-white text-[10px] font-bold rounded-lg hover:bg-[#173bab] transition-colors"
              >
                <Icon name="check_circle" className="!text-[12px]" />
                Selesai
              </Link>
            )}
            <Link
              to="/detail-report"
              search={{ reportId: report.id }}
              className="group relative overflow-hidden flex items-center gap-1.5 px-4 py-2 text-[13px] font-bold text-white bg-[#1e40af] rounded-lg shadow-sm hover:shadow transition-all"
              title="Lihat Detail"
            >
              <span className="absolute inset-y-0 left-0 w-full bg-white transition-transform duration-300 ease-out -translate-x-full group-hover:translate-x-0" />
              <span className="relative z-10 group-hover:text-[#1e40af] transition-colors duration-300">Lihat Detail</span>
              <Icon name="arrow_forward" className="!text-[16px] relative z-10 group-hover:text-[#1e40af] transition-colors duration-300" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ReportCard({ report, variant = "supervisor", actions, extra }: ReportCardProps) {
  const sc = getSeverityLabel(report.overall_severity ?? report.ai_severity);
  const severityColor = SEVERITY_COLOR_MAP[report.overall_severity ?? report.ai_severity ?? ""] ?? "#64748B";
  const isClient = extra?.isClient ?? true;

  if (variant === "petugas") {
    return <PetugasReportCard report={report} actions={actions} isClient={isClient} />;
  }

  return (
    <div
      className="bg-white border border-[#E2E8F0] outline-1 outline-[#CBD5E1] outline-offset-[1px] transition-all duration-200 ease-out hover:shadow-md hover:-translate-y-0.5"
      style={{ borderLeftWidth: "4px", borderLeftColor: severityColor }}
    >
      {/* ── Row 1: Thumbnail + header info ── */}
      <div className="flex items-start gap-3 p-4 pb-3">
        <Link to="/detail-report" search={{ reportId: report.id }} className="shrink-0 block group">
          <div className="w-[100px] h-[100px] rounded-sm overflow-hidden bg-[#E8F0FA] ring-1 ring-[#D0DAE8]">
            {report.first_photo_url ? (
              <SafeImage
                src={report.first_photo_url}
                alt=""
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Icon name="photo" className="!text-3xl text-[#C4D4E6]" />
              </div>
            )}
          </div>
        </Link>

        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-center justify-between gap-2 mb-1">
            <Link to="/detail-report" search={{ reportId: report.id }} className="no-underline">
              <span className="text-[11px] font-bold text-[#1e40af] font-mono tracking-tight bg-blue-50 px-1.5 py-0.5 rounded">
                {report.report_code}
              </span>
            </Link>
            <span className="text-[11px] text-[#94A3B8] whitespace-nowrap shrink-0">
              {report.created_at ? formatDateRelative(report.created_at, isClient) : "-"}
            </span>
          </div>
          <Link to="/detail-report" search={{ reportId: report.id }} className="no-underline block">
            <h4 className="text-[15px] font-bold text-[#0F172A] leading-tight line-clamp-2">
              {report.road_name}
            </h4>
          </Link>

          <div className="flex items-center gap-1 mt-1.5 text-[11px] text-[#64748B] flex-wrap">
            <Icon name="location_on" className="!text-[13px] text-[#94A3B8] shrink-0" />
            <span>{report.district ?? "-"}</span>
            {report.assigned_upr_name && (
              <>
                <span className="text-[#CBD5E1]">·</span>
                <Icon name="groups" className="!text-[13px] text-[#94A3B8] shrink-0" />
                <span className="truncate">{report.assigned_upr_name}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Separator ── */}
      <div className="h-px bg-[#F1F5F9]" />

      {/* ── Row 2: Labeled badge chips ── */}
      <div className="px-4 py-3">
        <div className="flex items-end gap-4 flex-wrap">

          {/* Status */}
          <LabeledBadge label="Status">
            <BadgeChip colorClass={statusBadgeStyle(report.status)}>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDotStyle(report.status)}`} />
              {displayStatus(report.status)}
            </BadgeChip>
          </LabeledBadge>

          {/* Severity */}
          <LabeledBadge label="Tingkat">
            <BadgeChip colorClass={sc.chip}>
              <Icon name="warning" className="!text-[11px]" />
              {sc.label}
            </BadgeChip>
          </LabeledBadge>

          {/* Trust score — supervisor only */}
          {variant === "supervisor" && (
            <LabeledBadge label="Kepercayaan">
              <TrustBadge
                score={report.trust_score ?? 0}
                label={(report.trust_label as TrustLabel) ?? "merah"}
                compact
              />
            </LabeledBadge>
          )}

          {/* Dimensions — pushed right */}
          {(report.kerusakan_panjang || report.kerusakan_lebar) && (
            <LabeledBadge label="Dimensi" className="ml-auto">
              <BadgeChip colorClass="bg-slate-50 text-[#475569] border border-slate-200">
                <Icon name="straighten" className="!text-[11px]" />
                P: {report.kerusakan_panjang ?? "-"}m · L: {report.kerusakan_lebar ?? "-"}m
              </BadgeChip>
            </LabeledBadge>
          )}

        </div>
      </div>

      {/* ── Separator ── */}
      <div className="h-px bg-[#F1F5F9]" />

      {/* ── Row 3: Footer — info + actions ── */}
      <div className="flex items-center justify-between px-4 py-2.5 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {/* Reporter name — supervisor only */}
          {variant === "supervisor" && (
            <>
              <Icon name="person" className="!text-[13px] text-[#94A3B8] shrink-0" />
              <span className="text-[12px] text-[#475569] truncate">
                {report.reporter_name ?? "Anonim"}
              </span>
            </>
          )}

          {(report as any).status_deadline === "terlambat" && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[11px] font-semibold leading-none bg-red-50 text-[#E11D48] border border-red-200 whitespace-nowrap shrink-0">
              <Icon name="timer_off" className="!text-[11px]" />
              Terlambat
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Mulai button — supervisor variant */}
          {variant === "supervisor" && report.status === "Disetujui" && (
            <button
              onClick={() => actions?.onMulai?.(report.id)}
              disabled={!!actions?.actionLoading}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-[#1e40af] text-white text-[11px] font-bold rounded-lg hover:bg-[#173bab] disabled:opacity-40 transition-colors"
            >
              <Icon name="play_arrow" className="!text-[13px]" />
              Mulai
            </button>
          )}

          {/* Delete — supervisor variant, only for Ditolak */}
          {variant === "supervisor" && report.status === "Ditolak" && (
            <button
              onClick={() => actions?.onDelete?.(report.id)}
              disabled={actions?.actionLoading === report.id}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg border border-red-200 text-[#E11D48] bg-red-50 hover:bg-red-100 disabled:opacity-40 transition-all"
            >
              <Icon name="delete" className="!text-[13px]" />
              Hapus
            </button>
          )}

          {/* Delete — home variant, only for Menunggu Review */}
          {variant === "home" && report.status === "Menunggu Review" && (
            <button
              onClick={() => actions?.onDelete?.(report.id)}
              disabled={actions?.actionLoading === report.id}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg border border-red-200 text-[#E11D48] bg-red-50 hover:bg-red-100 disabled:opacity-40 transition-all"
            >
              <Icon name="delete" className="!text-[13px]" />
              Hapus
            </button>
          )}

          {/* Edit — home variant */}
          {variant === "home" && (report.status === "Menunggu Review" || report.status === "Ditinjau" || report.status === "Diedit") && (
            <div
              className="px-2.5 py-1.5 bg-blue-50 text-[#1e40af] text-[11px] font-bold rounded-lg border border-blue-200 hover:bg-blue-100 transition-all cursor-pointer"
              onClick={() => { window.location.href = `/edit-report?reportId=${report.id}`; }}
            >
              Edit
            </div>
          )}

          <Link
            to="/detail-report"
            search={{ reportId: report.id }}
            className="group relative overflow-hidden flex items-center gap-1.5 px-4 py-2 text-[13px] font-bold text-white bg-[#1e40af] rounded-lg shadow-sm hover:shadow transition-all"
            title="Lihat Detail"
          >
            <span className="absolute inset-y-0 left-0 w-full bg-white transition-transform duration-300 ease-out -translate-x-full group-hover:translate-x-0" />
            <span className="relative z-10 group-hover:text-[#1e40af] transition-colors duration-300">Lihat Detail</span>
            <Icon name="arrow_forward" className="!text-[16px] relative z-10 group-hover:text-[#1e40af] transition-colors duration-300" />
          </Link>
        </div>
      </div>
    </div>
  );
}
