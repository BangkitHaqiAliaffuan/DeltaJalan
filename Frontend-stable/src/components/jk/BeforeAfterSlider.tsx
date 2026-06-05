import { useRef, useState, useCallback, useEffect } from "react";

interface BeforeAfterSliderProps {
  beforeSrc: string;
  afterSrc: string;
  beforeLabel?: string;
  afterLabel?: string;
}

export function BeforeAfterSlider({
  beforeSrc,
  afterSrc,
  beforeLabel = "Sebelum",
  afterLabel = "Sesudah",
}: BeforeAfterSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sliderPos, setSliderPos] = useState(50);
  const [aspect, setAspect] = useState<number | null>(null);
  const [imgLoaded, setImgLoaded] = useState(0);
  const draggingRef = useRef(false);

  const getPositionFromEvent = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = "touches" in e ? e.touches[0].clientX : e.clientX;
      const pct = ((x - rect.left) / rect.width) * 100;
      setSliderPos(Math.max(0, Math.min(100, pct)));
    },
    [],
  );

  const onDragStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      draggingRef.current = true;
      if ("touches" in e) {
        getPositionFromEvent(e.nativeEvent as TouchEvent);
      } else {
        getPositionFromEvent(e.nativeEvent as MouseEvent);
      }
    },
    [getPositionFromEvent],
  );

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!draggingRef.current) return;
      getPositionFromEvent(e);
    };
    const onUp = () => {
      draggingRef.current = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [getPositionFromEvent]);

  const bothLoaded = imgLoaded >= 2;

  return (
    <div
      ref={containerRef}
      className="relative w-full select-none overflow-hidden rounded-lg bg-[#0F172A] max-h-[55vh]"
      style={{
        ...(aspect ? { aspectRatio: `${aspect}` } : { minHeight: 280 }),
        touchAction: "none",
      }}
    >
      {/* After image (full width, bottom layer) */}
      <img
        src={afterSrc}
        alt={afterLabel}
        className="absolute inset-0 w-full h-full object-contain"
        onLoad={(e) => {
          const img = e.currentTarget;
          if (img.naturalWidth && img.naturalHeight && !aspect) {
            setAspect(img.naturalWidth / img.naturalHeight);
          }
          setImgLoaded((p) => Math.max(p, 1));
        }}
      />

      {/* Before image (clipped from right via clip-path) */}
      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
      >
        <img
          src={beforeSrc}
          alt={beforeLabel}
          className="w-full h-full object-contain"
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalWidth && img.naturalHeight && !aspect) {
              setAspect(img.naturalWidth / img.naturalHeight);
            }
            setImgLoaded((p) => Math.max(p, 2));
          }}
        />
      </div>

      {/* Loading spinner */}
      {!bothLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0F172A]/50 z-10">
          <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* Divider line + handle */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white z-20 cursor-col-resize"
        style={{ left: `${sliderPos}%`, transform: "translateX(-50%)" }}
        onMouseDown={onDragStart}
        onTouchStart={onDragStart}
      >
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 3L2 7L5 11" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 3L12 7L9 11" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Labels */}
      <div
        className="absolute top-3 left-3 z-20 pointer-events-none transition-opacity"
        style={{ opacity: bothLoaded ? 1 : 0 }}
      >
        <span className="px-2 py-1 text-[10px] font-bold text-white bg-black/50 rounded-md">
          {beforeLabel}
        </span>
      </div>
      <div
        className="absolute top-3 right-3 z-20 pointer-events-none transition-opacity"
        style={{ opacity: bothLoaded ? 1 : 0 }}
      >
        <span className="px-2 py-1 text-[10px] font-bold text-white bg-black/50 rounded-md">
          {afterLabel}
        </span>
      </div>
    </div>
  );
}
