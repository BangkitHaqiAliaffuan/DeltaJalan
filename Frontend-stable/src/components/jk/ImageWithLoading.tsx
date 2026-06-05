import { useState, useRef, useEffect } from "react";

interface ImageWithLoadingProps {
  src: string;
  alt: string;
  className?: string;
  wrapperClassName?: string;
  loading?: "lazy" | "eager";
  preserveAspect?: boolean;
}

export function ImageWithLoading({
  src,
  alt,
  className = "w-full h-full object-contain",
  wrapperClassName = "relative bg-slate-100 rounded-lg overflow-hidden",
  loading = "lazy",
  preserveAspect = false,
}: ImageWithLoadingProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [naturalAspect, setNaturalAspect] = useState<number | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setLoaded(false);
    setError(false);
    setNaturalAspect(null);
  }, [src]);

  useEffect(() => {
    if (imgRef.current?.complete) {
      setLoaded(true);
      const img = imgRef.current;
      if (img.naturalWidth && img.naturalHeight) {
        setNaturalAspect(img.naturalWidth / img.naturalHeight);
      }
    }
  }, [src]);

  const wrapperStyle =
    preserveAspect && naturalAspect
      ? { aspectRatio: `${naturalAspect}` }
      : undefined;

  const wrapperClasses = preserveAspect
    ? wrapperClassName.replace(/\baspect-video\b/g, "")
    : wrapperClassName;

  return (
    <div className={wrapperClasses} style={wrapperStyle}>
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className={className}
        loading={loading}
        onLoad={(e) => {
          setLoaded(true);
          const img = e.currentTarget;
          if (img.naturalWidth && img.naturalHeight) {
            setNaturalAspect(img.naturalWidth / img.naturalHeight);
          }
        }}
        onError={() => setError(true)}
      />
      {!loaded && !error && (
        <div className="absolute inset-0 bg-gray-100/80 flex items-center justify-center">
          <span className="w-5 h-5 border-2 border-[#1A4F8A]/30 border-t-[#1A4F8A] rounded-full animate-spin" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <p className="text-[10px] text-[#64748B]">Gagal memuat</p>
          </div>
        </div>
      )}
    </div>
  );
}
