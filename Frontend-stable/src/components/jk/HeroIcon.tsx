/**
 * HeroIcon — wrapper untuk @heroicons/react/24/outline
 * Sesuai design.md §9 yang mereferensikan Heroicons Outline.
 *
 * Daftar icon yang dipakai di DeltaJalan (sesuai §9):
 *   home, cloud-arrow-up, map, document-text,
 *   clipboard-document-list, chart-bar, cog-6-tooth,
 *   bell, funnel, exclamation-triangle, check-circle,
 *   map-pin, arrow-down-tray, arrow-left, chevron-right,
 *   x-mark, plus, magnifying-glass, arrow-path
 */
import {
  HomeIcon,
  CloudArrowUpIcon,
  MapIcon,
  DocumentTextIcon,
  ClipboardDocumentListIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  BellIcon,
  FunnelIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  MapPinIcon,
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  InboxIcon,
  StarIcon,
  UserIcon,
  ArrowRightOnRectangleIcon,
  EyeIcon,
  PencilSquareIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import type { ComponentType, SVGProps } from "react";

const ICON_MAP: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  home: HomeIcon,
  "cloud-arrow-up": CloudArrowUpIcon,
  map: MapIcon,
  "document-text": DocumentTextIcon,
  "clipboard-document-list": ClipboardDocumentListIcon,
  "chart-bar": ChartBarIcon,
  "cog-6-tooth": Cog6ToothIcon,
  bell: BellIcon,
  funnel: FunnelIcon,
  "exclamation-triangle": ExclamationTriangleIcon,
  "check-circle": CheckCircleIcon,
  "map-pin": MapPinIcon,
  "arrow-down-tray": ArrowDownTrayIcon,
  "arrow-left": ArrowLeftIcon,
  "chevron-right": ChevronRightIcon,
  "x-mark": XMarkIcon,
  plus: PlusIcon,
  "magnifying-glass": MagnifyingGlassIcon,
  "arrow-path": ArrowPathIcon,
  inbox: InboxIcon,
  star: StarIcon,
  user: UserIcon,
  logout: ArrowRightOnRectangleIcon,
  eye: EyeIcon,
  "pencil-square": PencilSquareIcon,
  trash: TrashIcon,
};

interface HeroIconProps {
  /** Nama icon sesuai design.md §9 (contoh: "bell", "chart-bar") */
  name: string;
  /** Ukuran dalam px (default 24) */
  size?: number;
  className?: string;
  "aria-label"?: string;
  "aria-hidden"?: boolean | "true" | "false";
}

export function HeroIcon({
  name,
  size = 24,
  className = "",
  "aria-label": ariaLabel,
  "aria-hidden": ariaHidden,
}: HeroIconProps) {
  const Component = ICON_MAP[name];

  if (!Component) {
    // Fallback: tampilkan kotak placeholder agar tidak crash di development
    return (
      <span
        style={{ width: size, height: size, display: "inline-block" }}
        className={`bg-slate-200 rounded ${className}`}
        title={`Missing icon: ${name}`}
      />
    );
  }

  return (
    <Component
      style={{ width: size, height: size }}
      className={className}
      aria-label={ariaLabel}
      aria-hidden={ariaHidden ?? (ariaLabel ? undefined : true)}
      strokeWidth={1.5}
    />
  );
}
