/**
 * EmptyState — ilustrasi + CTA sesuai design.md §10
 * Digunakan jika data kosong (tabel laporan, daftar tugas, dll.)
 */
import { Icon } from "./Icon";

interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
}

interface EmptyStateProps {
  /** Nama icon Material Symbols */
  icon?: string;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  className?: string;
}

export function EmptyState({
  icon = "inbox",
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}
      role="status"
      aria-label={title}
    >
      {/* Icon ilustrasi */}
      <div className="w-16 h-16 rounded-2xl bg-[#E8F0FA] flex items-center justify-center mb-4">
        <Icon name={icon} className="!text-[32px] text-[#1A4F8A]" />
      </div>

      {/* Teks */}
      <h3
        className="font-headline-sm text-headline-sm font-bold text-on-surface mb-2"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        {title}
      </h3>
      {description && (
        <p className="font-body-md text-body-md text-on-surface-variant max-w-xs">{description}</p>
      )}

      {/* CTA */}
      {action && (
        <div className="mt-6">
          {action.href ? (
            <a href={action.href} className="btn-primary">
              {action.label}
            </a>
          ) : (
            <button type="button" onClick={action.onClick} className="btn-primary">
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
