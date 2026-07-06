import type { Laporan } from "@/types/laporan";

export type ActionVariant = "primary" | "secondary" | "destructive";

export interface ActionButton {
  label: string;
  icon?: string;
  variant: ActionVariant;
  onClick?: () => void;
  to?: string;
  search?: Record<string, string>;
  disabled?: boolean;
}

export interface CardLink {
  to: string;
  params?: Record<string, string>;
  search?: Record<string, string>;
}

export interface ReportCardOptions {
  showTrust?: boolean;
  showDeadline?: boolean;
  isClient?: boolean;
}

export interface ReportCardProps {
  report: Laporan;
  actions?: ActionButton[];
  options?: ReportCardOptions;
  cardLink?: CardLink;
}
