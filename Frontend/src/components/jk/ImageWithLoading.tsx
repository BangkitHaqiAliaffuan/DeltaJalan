import { useState, useRef, useEffect } from "react";

interface ImageWithLoadingProps {
  src: string;
  alt: string;
  className?: string;
  wrapperClassName?: string;
  loading?: "lazy" | "eager";
}

export function ImageWithLoading({
  src,
  alt,
  className = "w-full h-full object-contain",
  wrapperClassName = "relative aspect-video bg-slate-100 rounded-lg overflow-hidden",
  loading = "lazy",
}: ImageWithLoadingProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (imgRef.current?.complete) {
      setLoaded(true);
    }
  }, []);

  return (
    <div className={wrapperClassName}>
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className={className}
        loading={loading}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
      {!loaded && !error && (
        <div className="absolute inset-0 bg-gray-100/80 flex items-center justify-center">
          <span className="jk-spinner" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <p className="text-[10px] text-on-surface-variant">Gagal memuat</p>
          </div>
        </div>
      )}
    </div>
  );
}
