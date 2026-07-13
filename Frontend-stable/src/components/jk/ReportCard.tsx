import { Link } from "@tanstack/react-router";
import { Icon } from "@/components/jk/Icon";
import { SafeImage } from "@/components/jk/SafeImage";
import { CardActions } from "@/components/jk/report-card/CardActions";
import {
  getSeverityLabel,
  severityDotStyle,
  statusDotStyle,
  formatDateRelative,
  displayStatus,
} from "@/lib/format";
import type { Laporan, TrustLabel } from "@/types/laporan";
import type { ActionButton, ReportCardOptions, CardLink } from "@/components/jk/report-card/types";

interface ReportCardProps {
  report: Laporan;
  actions?: ActionButton[];
  options?: ReportCardOptions;
  cardLink?: CardLink;
}

const SEVERITY_COLOR_MAP: Record<string, string> = {
  "Rusak Berat": "#E11D48",
  "Rusak Sedang": "#F97316",
  "Rusak Ringan": "#F59E0B",
  Baik: "#10B981",
};

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

export function ReportCard({ report, actions, options, cardLink }: ReportCardProps) {
  const sc = getSeverityLabel(report.overall_severity ?? report.ai_severity);
  const severityColor =
    SEVERITY_COLOR_MAP[report.overall_severity ?? report.ai_severity ?? ""] ?? "#64748B";
  // ── TRUST SCORE [NONAKTIF] — trustLabel, trustColor hanya dipakai di showTrust block
  const trustLabel = (report.trust_label as TrustLabel) ?? "merah";
  const trustColor =
    trustLabel === "hijau" ? "#059669" : trustLabel === "kuning" ? "#D97706" : "#DC2626";
  const isClient = options?.isClient ?? true;
  // ── TRUST SCORE [NONAKTIF] — default showTrust diubah ke false
  const showTrust = options?.showTrust ?? false;
  const showDeadline = options?.showDeadline ?? false;

  const deadlineText = (() => {
    if (!showDeadline) return null;
    if (["Selesai", "Ditolak"].includes(report.status)) return null;
    const deadline = report.deadline_resolusi ?? report.deadline_review;
    if (!deadline) return null;
    const diffMs = new Date(deadline).getTime() - Date.now();
    if (diffMs < 0) return "Terlambat!";
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    if (hours < 1) return "Kurang dari 1 jam";
    if (hours < 24) return `${hours} jam`;
    const days = Math.floor(hours / 24);
    return `${days} hari`;
  })();
  const deadlineColor = deadlineText === "Terlambat!" ? "#E11D48" : "#10B981";

  const isDuplicate = report.is_duplicate === true;
  const isTerlambat =
    showDeadline &&
    (report.status_deadline === "terlambat" ||
      report.terlambat_review === true ||
      report.terlambat_resolusi === true);

  const rootClassName = `bg-white rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ease-out overflow-hidden flex flex-col ${isTerlambat ? "border-2 border-[#E11D48]" : isDuplicate ? "border border-[#F59E0B]" : "border border-[#E2E8F0]"}`;

  const Wrapper = cardLink ? Link : "div";
  const wrapperProps = cardLink
    ? {
        to: cardLink.to,
        params: cardLink.params,
        search: cardLink.search,
        className: rootClassName,
      }
    : { className: rootClassName };

  const ImageLink = cardLink ? "div" : Link;
  const imageLinkProps = cardLink
    ? { className: "block group" }
    : { to: "/detail-report", search: { reportId: report.id }, className: "block group" };

  const HeaderLink = cardLink ? "div" : Link;
  const headerLinkProps = cardLink
    ? { className: "no-underline block" }
    : { to: "/detail-report", search: { reportId: report.id }, className: "no-underline block" };

  return (
    <Wrapper {...(wrapperProps as any)}>
      <ImageLink {...(imageLinkProps as any)}>
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
      </ImageLink>

      <div className="flex-1 flex flex-col p-4 gap-2">
        <HeaderLink {...(headerLinkProps as any)}>
          <div className="flex items-start gap-2">
            <h4 className="text-[15px] font-bold text-[#0F172A] leading-tight line-clamp-2 flex-1">
              {report.road_name}
            </h4>
            <div className="flex items-center gap-1.5 shrink-0">
              {isTerlambat && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-[#E11D48] border border-red-200 whitespace-nowrap">
                  <Icon name="timer_off" className="!text-[10px]" />
                  Terlambat
                </span>
              )}
              {isDuplicate && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-[#D97706] border border-amber-200">
                  Duplikat
                </span>
              )}
              {report.source === "warga" && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-50 text-[#7C3AED] border border-purple-200">
                  Warga
                </span>
              )}
            </div>
          </div>
        </HeaderLink>

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-[#1e40af] font-mono tracking-tight">
            {report.report_code}
          </span>
          <span className="text-[10px] text-[#CBD5E1]">•</span>
          <span className="text-[10px] text-[#94A3B8]">
            {report.created_at ? formatDateRelative(report.created_at, isClient) : "-"}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${statusDotStyle(report.status)}`} />
          <span className="text-[11px] font-semibold text-[#475569]">
            {displayStatus(report.status)}
          </span>
        </div>

        {report.status === "Ditolak" && (
          <div className="flex items-center gap-1 text-[10px] text-[#94A3B8] mt-0.5">
            <Icon name="info" className="!text-[10px] shrink-0" />
            <span>Dihapus otomatis 3 hari setelah ditolak</span>
          </div>
        )}

        <div className="flex items-center gap-1 text-[10px] text-[#64748B]">
          <Icon name="location_on" className="!text-[12px] text-[#94A3B8] shrink-0" />
          <span className="truncate">{report.district ?? "-"}</span>
        </div>

        {/* ── Mini Progress Bar ── */}
        {report.status === "Sedang Diperbaiki" &&
          report.estimasi_hari != null &&
          report.estimasi_hari > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold text-[#1A4F8A]">
                  Hari {Math.min((report.progress_updates_count ?? 0) + 1, report.estimasi_hari)}/
                  {report.estimasi_hari}
                </span>
              </div>
              <div className="w-full h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#1A4F8A] rounded-full"
                  style={{
                    width: `${Math.min(((report.progress_updates_count ?? 0) / report.estimasi_hari) * 100, 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

        <div className="h-px bg-[#F1F5F9] -mx-4" />

        <div className="grid grid-cols-2 gap-y-2.5 gap-x-3 pt-1">
          <div>
            <p className="text-[9px] font-bold text-[#94A3B8] uppercase tracking-[0.1em] mb-0.5">
              Tingkat
            </p>
            <div className="flex items-center gap-1">
              <Icon
                name="warning"
                className="!text-[12px] shrink-0"
                style={{ color: severityColor }}
              />
              <span className="text-[11px] font-semibold text-[#0F172A] truncate">{sc.label}</span>
            </div>
          </div>
          <div>
            <p className="text-[9px] font-bold text-[#94A3B8] uppercase tracking-[0.1em] mb-0.5">
              Dimensi
            </p>
            <div className="flex items-center gap-1">
              <Icon name="straighten" className="!text-[12px] text-[#64748B] shrink-0" />
              <span className="text-[11px] font-semibold text-[#0F172A]">
                {report.kerusakan_panjang || report.kerusakan_lebar
                  ? `P: ${report.kerusakan_panjang ?? "-"}m • L: ${report.kerusakan_lebar ?? "-"}m`
                  : "-"}
              </span>
            </div>
          </div>
          {(showTrust || (showDeadline && deadlineText)) && (
            <div>
              {showTrust ? (
                <>
                  <p className="text-[9px] font-bold text-[#94A3B8] uppercase tracking-[0.1em] mb-0.5">
                    Kepercayaan
                  </p>
                  <div className="flex items-center gap-1">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: trustColor }}
                    />
                    <span className="text-[11px] font-semibold" style={{ color: trustColor }}>
                      {trustLabel === "hijau"
                        ? "Kredibel"
                        : trustLabel === "kuning"
                          ? "Perlu Review"
                          : "Diragukan"}{" "}
                      {report.trust_score ?? 0}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[9px] font-bold text-[#94A3B8] uppercase tracking-[0.1em] mb-0.5">
                    Deadline
                  </p>
                  <div className="flex items-center gap-1">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: deadlineColor }}
                    />
                    <span className="text-[11px] font-semibold" style={{ color: deadlineColor }}>
                      {deadlineText}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
          <div>
            <p className="text-[9px] font-bold text-[#94A3B8] uppercase tracking-[0.1em] mb-0.5">
              Pelapor
            </p>
            <div className="flex items-center gap-1">
              <Icon name="person" className="!text-[12px] text-[#64748B] shrink-0" />
              <span className="text-[11px] font-semibold text-[#0F172A] truncate">
                {report.reporter_name ?? "Anonim"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1" />

        {actions && actions.length > 0 && (
          <>
            <div className="h-px bg-[#F1F5F9] -mx-4" />
            <div className="flex items-center justify-end gap-2 pt-1">
              <CardActions actions={actions} />
            </div>
          </>
        )}
      </div>
    </Wrapper>
  );
}
