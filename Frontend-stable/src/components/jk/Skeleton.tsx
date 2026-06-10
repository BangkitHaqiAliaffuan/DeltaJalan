/**
 * Skeleton — loading placeholder sesuai design.md §10
 * Digunakan saat data sedang di-fetch dari server.
 */

interface SkeletonProps {
  /** Lebar elemen (Tailwind class atau CSS value) */
  className?: string;
  /** Tinggi eksplisit */
  height?: string | number;
  /** Bentuk circle (untuk avatar) */
  circle?: boolean;
  /** Jumlah baris yang di-render (shorthand untuk list) */
  rows?: number;
}

function SkeletonItem({ className = "", height, circle }: Omit<SkeletonProps, "rows">) {
  const shape = circle ? "rounded-full" : "rounded-lg";
  const style = height ? { height: typeof height === "number" ? `${height}px` : height } : {};

  return (
    <div
      className={`animate-pulse bg-slate-200 ${shape} ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

export function Skeleton({ rows = 1, ...props }: SkeletonProps) {
  if (rows === 1) return <SkeletonItem {...props} />;

  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonItem
          key={i}
          {...props}
          // Baris terakhir lebih pendek — desain loading alami
          className={`${props.className ?? ""} ${i === rows - 1 ? "w-3/4" : "w-full"}`}
        />
      ))}
    </div>
  );
}

/** Skeleton preset untuk metric card §6.3 */
export function SkeletonCard() {
  return (
    <div className="jk-card flex flex-col gap-3" aria-hidden="true">
      <div className="flex items-center justify-between">
        <Skeleton className="w-8 h-8" circle />
        <Skeleton className="w-16 h-4" />
      </div>
      <Skeleton className="w-20 h-8" height={32} />
      <Skeleton className="w-32 h-3" height={12} />
    </div>
  );
}

/** Skeleton preset untuk baris tabel §6.7 */
export function SkeletonTableRow({ cols = 6 }: { cols?: number }) {
  return (
    <tr aria-hidden="true">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4" height={16} />
        </td>
      ))}
    </tr>
  );
}

/** Skeleton preset untuk report card horizontal (foto + bar severity + metadata) */
export function SkeletonReportCard() {
  return (
    <div className="bg-white rounded-lg border border-[#D0DAE8] overflow-hidden animate-pulse">
      <div className="flex">
        <div className="w-36 shrink-0 bg-[#E8F0FA]" />
        <div className="w-1.5 bg-[#D0DAE8]" />
        <div className="p-4 flex-1 space-y-3">
          <div className="flex justify-between">
            <div className="w-28 h-5 bg-[#D0DAE8] rounded" />
            <div className="w-20 h-5 bg-[#E8F0FA] rounded" />
          </div>
          <div className="w-3/4 h-6 bg-[#D0DAE8] rounded" />
          <div className="flex gap-4">
            <div className="w-28 h-4 bg-[#E8F0FA] rounded" />
            <div className="w-24 h-4 bg-[#E8F0FA] rounded" />
            <div className="w-20 h-4 bg-[#E8F0FA] rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Skeleton preset untuk notification item */
export function SkeletonNotificationItem() {
  return (
    <div className="flex items-start gap-3 px-4 py-3 animate-pulse">
      <div className="mt-1 w-2 h-2 rounded-full bg-[#D0DAE8] shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="w-full h-3 bg-[#D0DAE8] rounded" />
        <div className="w-3/4 h-3 bg-[#E8F0FA] rounded" />
        <div className="flex gap-2">
          <div className="w-16 h-2.5 bg-[#E8F0FA] rounded" />
          <span className="text-[10px] text-on-surface-variant">·</span>
          <div className="w-12 h-2.5 bg-[#E8F0FA] rounded" />
        </div>
      </div>
    </div>
  );
}

/** Skeleton preset untuk map area */
export function SkeletonMapArea() {
  return (
    <div className="flex-1 flex items-center justify-center bg-[#F5F7FA]" aria-label="Memuat peta">
      <div className="flex flex-col items-center gap-3 animate-pulse">
        <div className="w-64 h-40 bg-[#D0DAE8] rounded-xl" />
        <div className="w-32 h-3 bg-[#E8F0FA] rounded" />
      </div>
    </div>
  );
}

/** Skeleton preset untuk detail laporan (full page) */
export function SkeletonDetailReport() {
  return (
    <div className="flex flex-col" aria-label="Memuat detail laporan">
      {/* Photo area */}
      <div className="w-full h-56 bg-[#E8F0FA] animate-pulse" />
      {/* Info cards */}
      <div className="px-4 -mt-6 space-y-3 relative z-10">
        <div className="bg-white rounded-xl border border-[#D0DAE8] p-4 animate-pulse">
          <div className="flex justify-between mb-3">
            <div className="w-24 h-4 bg-[#D0DAE8] rounded" />
            <div className="w-20 h-5 bg-[#E8F0FA] rounded-full" />
          </div>
          <div className="w-3/4 h-6 bg-[#D0DAE8] rounded mb-2" />
          <div className="space-y-1.5">
            <div className="w-full h-3 bg-[#E8F0FA] rounded" />
            <div className="w-2/3 h-3 bg-[#E8F0FA] rounded" />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[#D0DAE8] p-4 animate-pulse space-y-3">
          <div className="w-32 h-4 bg-[#D0DAE8] rounded" />
          <div className="flex gap-2">
            <div className="w-20 h-6 bg-[#E8F0FA] rounded" />
            <div className="w-24 h-6 bg-[#E8F0FA] rounded" />
            <div className="w-20 h-6 bg-[#E8F0FA] rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
