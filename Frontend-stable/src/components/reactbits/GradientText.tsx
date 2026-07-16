interface GradientTextProps {
  text: string;
  className?: string;
  gradient?: string;
}

export default function GradientText({
  text,
  className = "",
  gradient = "linear-gradient(135deg, #1e40af 0%, #6366f1 50%, #2e68d8 100%)",
}: GradientTextProps) {
  return (
    <span
      className={className}
      style={{
        background: gradient,
        backgroundSize: "200% 200%",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        animation: "gradient-shift 4s ease infinite",
      }}
    >
      {text}
    </span>
  );
}
