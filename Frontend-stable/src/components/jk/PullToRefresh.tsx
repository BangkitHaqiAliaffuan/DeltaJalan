import { useRef, useState, useCallback, useEffect } from "react";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

const THRESHOLD = 60;
const RESISTANCE = 0.4;

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const currentY = useRef(0);

  function isAtTop() {
    const el = outerRef.current;
    return el && el.scrollTop <= 0;
  }

  function applyPull(y: number) {
    const el = innerRef.current;
    const ind = indicatorRef.current;
    if (!el || !ind) return;

    const height = Math.min(y * RESISTANCE, THRESHOLD * 1.5);
    currentY.current = height;

    el.style.transform = `translateY(${height}px)`;

    if (height >= THRESHOLD) {
      ind.textContent = "Lepaskan untuk memuat ulang";
      ind.className = "text-sm text-primary font-medium";
    } else {
      ind.textContent = "Tarik untuk memuat ulang";
      ind.className = "text-sm text-on-surface-variant";
    }
  }

  function resetPull() {
    const el = innerRef.current;
    const ind = indicatorRef.current;
    if (!el || !ind) return;
    currentY.current = 0;
    el.style.transition = "transform 0.3s ease";
    el.style.transform = "translateY(0px)";
    ind.textContent = "Tarik untuk memuat ulang";
    ind.className = "text-sm text-on-surface-variant";
    setTimeout(() => {
      if (el) el.style.transition = "none";
    }, 300);
  }

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (refreshing) return;
      if (!isAtTop()) return;
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    },
    [refreshing],
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!pulling.current || refreshing) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        pulling.current = false;
        resetPull();
        return;
      }
      e.preventDefault();
      applyPull(dy);
    },
    [refreshing],
  );

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;
    if (currentY.current >= THRESHOLD) {
      setRefreshing(true);
      const el = innerRef.current;
      if (el) {
        el.style.transition = "transform 0.3s ease";
        el.style.transform = `translateY(${THRESHOLD}px)`;
      }
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        const el2 = innerRef.current;
        if (el2) {
          el2.style.transform = "translateY(0px)";
          currentY.current = 0;
          setTimeout(() => {
            if (el2) el2.style.transition = "none";
          }, 300);
        }
      }
    } else {
      resetPull();
    }
  }, [onRefresh]);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd);
    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return (
    <div ref={outerRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
      <div ref={innerRef}>
        <div
          ref={indicatorRef}
          className="flex items-center justify-center"
          style={{ height: THRESHOLD, marginTop: -THRESHOLD }}
        >
          <span className="text-sm text-on-surface-variant">Tarik untuk memuat ulang</span>
        </div>
        {children}
      </div>
      {refreshing && (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-surface text-primary"
          style={{ height: THRESHOLD, paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Memuat ulang...</span>
        </div>
      )}
    </div>
  );
}
