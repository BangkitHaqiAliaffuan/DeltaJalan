import { useRef, useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface BlurTextProps {
  text: string;
  tag?: React.ElementType;
  className?: string;
  delay?: number;
  duration?: number;
  threshold?: number;
  once?: boolean;
}


export default function BlurText({
  text,
  tag: Tag = "h2",
  className = "",
  delay = 0,
  duration = 0.7,
  threshold = 0.2,
  once = true,
}: BlurTextProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    gsap.set(el, { opacity: 0, filter: "blur(16px)", y: 20 });

    const st = ScrollTrigger.create({
      trigger: el,
      start: `top ${(1 - threshold) * 100}%`,
      once,
      onEnter: () => {
        gsap.to(el, {
          opacity: 1,
          filter: "blur(0px)",
          y: 0,
          duration,
          delay,
          ease: "power3.out",
        });
      },
    });

    return () => st.kill();
  }, [delay, duration, threshold, once]);

  return (
    <Tag ref={ref as React.RefObject<HTMLElement>} className={className} style={{ visibility: "visible" }}>
      {text}
    </Tag>
  );
}
