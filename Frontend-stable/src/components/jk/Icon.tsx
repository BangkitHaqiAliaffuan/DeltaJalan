export function Icon({
  name,
  className = "",
  filled = false,
  weight,
}: {
  name: string;
  className?: string;
  filled?: boolean;
  weight?: number;
}) {
  const style: React.CSSProperties = {};
  const parts: string[] = [];
  if (filled) parts.push("'FILL' 1");
  if (weight) parts.push(`'wght' ${weight}`);
  if (parts.length) style.fontVariationSettings = parts.join(", ");
  return (
    <span className={`material-symbols-outlined ${className}`} style={style}>
      {name}
    </span>
  );
}
