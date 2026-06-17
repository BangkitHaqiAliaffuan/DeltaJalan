import React from "react";

/**
 * LabeledBadge
 * Wraps a badge chip with a small uppercase category label above it.
 * Use this wherever a badge needs context — keeps label+badge spacing consistent.
 */
interface LabeledBadgeProps {
  label: string;
  children: React.ReactNode;
  /** Extra classes for the outer wrapper (e.g. "ml-auto") */
  className?: string;
}

export function LabeledBadge({ label, children, className = "" }: LabeledBadgeProps) {
  return (
    <div className={`flex flex-col items-start gap-1.5 ${className}`}>
      <span className="block text-[9px] font-bold text-[#94A3B8] uppercase tracking-[0.12em] leading-none select-none">
        {label}
      </span>
      {children}
    </div>
  );
}

/**
 * BadgeChip
 * The canonical badge chip used across the supervisor cards.
 * - Sharp-ish corners (rounded-sm) — no pill shape, professional look
 * - Consistent padding & font size
 * - Pass Tailwind color classes via `colorClass` (bg + text + optional border)
 */
interface BadgeChipProps {
  /** Tailwind classes for background, text color, and border — from format.ts helpers */
  colorClass: string;
  children: React.ReactNode;
  className?: string;
}

export function BadgeChip({ colorClass, children, className = "" }: BadgeChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold leading-none rounded-sm ${colorClass} ${className}`}
    >
      {children}
    </span>
  );
}
