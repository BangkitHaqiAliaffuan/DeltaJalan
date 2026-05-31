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
