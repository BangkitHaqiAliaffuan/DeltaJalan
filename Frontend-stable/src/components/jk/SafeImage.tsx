import { useState, type ImgHTMLAttributes } from 'react'
import { useBlobImage } from '@/hooks/useBlobImage'

export function SafeImage(props: ImgHTMLAttributes<HTMLImageElement>) {
  const blobSrc = useBlobImage(props.src)
  const [loaded, setLoaded] = useState(false)

  return (
    <div className="relative w-full h-full">
      {!loaded && (
        <div className="absolute inset-0 bg-[#D0DAE8] animate-pulse" />
      )}
      <img
        {...props}
        src={blobSrc}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className={`${props.className ?? ''} ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
      />
    </div>
  )
}
