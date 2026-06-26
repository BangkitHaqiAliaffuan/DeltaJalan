import { useState, useRef, useEffect, type ImgHTMLAttributes } from 'react'
import { useBlobImage } from '@/hooks/useBlobImage'

export function SafeImage(props: ImgHTMLAttributes<HTMLImageElement>) {
  const blobSrc = useBlobImage(props.src)
  const [loaded, setLoaded] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  const parentClasses = (props.className ?? '')
    .replace(/\bopacity-\S+/g, '')
    .replace(/\btransition-opacity\b/g, '')
    .trim()

  useEffect(() => {
    if (imgRef.current?.complete) {
      setLoaded(true)
    }
  }, [blobSrc])

  return (
    <div className="relative w-full h-full">
      {!loaded && (
        <div className="absolute inset-0 bg-[#D0DAE8] animate-pulse" />
      )}
      <img
        ref={imgRef}
        {...props}
        src={blobSrc}
        className={`${parentClasses} ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
      />
    </div>
  )
}
