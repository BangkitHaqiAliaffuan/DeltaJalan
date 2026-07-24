import { useState, useRef, useEffect, type ImgHTMLAttributes } from "react";
import { useBlobImage } from "@/hooks/useBlobImage";

const imgLoadTimers = new Map<string, number>();

export function SafeImage(props: ImgHTMLAttributes<HTMLImageElement>) {
  const blobSrc = useBlobImage(props.src);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const srcKeyRef = useRef(props.src);

  const parentClasses = (props.className ?? "")
    .replace(/\bopacity-\S+/g, "")
    .replace(/\btransition-opacity\b/g, "")
    .trim();

  useEffect(() => {
    if (imgRef.current?.complete) {
      setLoaded(true);
    }
    if (props.src && !imgLoadTimers.has(props.src)) {
      imgLoadTimers.set(props.src, performance.now());
    }
  }, [blobSrc]);

  return (
    <div className="relative">
      {!loaded && <div className="absolute inset-0 bg-[#D0DAE8] animate-pulse" />}
      <img
        ref={imgRef}
        {...props}
        src={blobSrc}
        loading="lazy"
        className={`${parentClasses} ${loaded ? "opacity-100" : "opacity-0"} transition-opacity duration-300`}
        onLoad={() => {
          if (srcKeyRef.current && imgLoadTimers.has(srcKeyRef.current)) {
            const elapsed = performance.now() - imgLoadTimers.get(srcKeyRef.current)!;
            console.log(`[PERF] Img loaded: ${srcKeyRef.current.substring(0, 50)}... — ${elapsed.toFixed(0)}ms`);
            imgLoadTimers.delete(srcKeyRef.current);
          }
          setLoaded(true);
        }}
        onError={() => setLoaded(true)}
      />
    </div>
  );
}
