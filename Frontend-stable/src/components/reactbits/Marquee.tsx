import { useRef, useEffect } from "react";
import { gsap } from "gsap";

interface MarqueeProps {
  items: string[];
  speed?: number; // seconds for one full loop
  className?: string;
  itemClassName?: string;
  separator?: string;
  reverse?: boolean;
}

export default function Marquee({
  items,
  speed = 30,
  className = "",
  itemClassName = "",
  separator = "•",
  reverse = false,
}: MarqueeProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const tweenRef = useRef<gsap.core.Tween | null>(null);

  // Duplicate items so we can seamlessly loop
  const doubled = [...items, ...items];

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const totalWidth = track.scrollWidth / 2; // half = one set of items

    gsap.set(track, { x: reverse ? -totalWidth : 0 });

    tweenRef.current = gsap.to(track, {
      x: reverse ? 0 : -totalWidth,
      duration: speed,
      ease: "none",
      repeat: -1,
    });

    return () => {
      tweenRef.current?.kill();
    };
  }, [items, speed, reverse]);

  return (
    <div className={`overflow-hidden w-full ${className}`}>
      <div ref={trackRef} className="flex gap-0 whitespace-nowrap will-change-transform">
        {doubled.map((item, i) => (
          <span key={i} className={`inline-flex items-center gap-4 px-4 ${itemClassName}`}>
            <span className="text-[#6366f1]/40 text-sm">{separator}</span>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
