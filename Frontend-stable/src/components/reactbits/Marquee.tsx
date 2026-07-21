import { useState, useEffect, useInsertionEffect, useRef } from "react";

interface MarqueeProps {
  items: string[];
  speed?: number;
  className?: string;
  itemClassName?: string;
  separator?: string;
  reverse?: boolean;
  startOnIntersect?: boolean;
}

const KEYFRAME_ID = "__marquee_scroll";

function injectKeyframes() {
  if (document.getElementById(KEYFRAME_ID)) return;
  const style = document.createElement("style");
  style.id = KEYFRAME_ID;
  style.textContent = `@keyframes marquee-scroll{to{transform:translateX(-50%)}}
@media(prefers-reduced-motion:reduce){.marquee-track{animation:none!important}}`;
  document.head.appendChild(style);
}

export default function Marquee({
  items,
  speed = 30,
  className = "",
  itemClassName = "",
  separator = "•",
  reverse = false,
  startOnIntersect = false,
}: MarqueeProps) {
  const [visible, setVisible] = useState(!startOnIntersect);
  const containerRef = useRef<HTMLDivElement>(null);
  const doubled = [...items, ...items];

  useInsertionEffect(() => { injectKeyframes(); }, []);

  useEffect(() => {
    if (!startOnIntersect) return;
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [startOnIntersect]);

  return (
    <div ref={containerRef} className={`overflow-hidden w-full ${className}`}>
      <div
        className="marquee-track flex gap-0 whitespace-nowrap will-change-transform"
        style={{
          animation: `marquee-scroll ${speed}s linear infinite`,
          animationDirection: reverse ? "reverse" : "normal",
          animationPlayState: visible ? "running" : "paused",
        }}
      >
        {doubled.map((item, i) => (
          <span key={i} className={`inline-flex items-center gap-4 px-4 flex-shrink-0 ${itemClassName}`}>
            <span className="text-[#6366f1]/40 text-sm">{separator}</span>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
