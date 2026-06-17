import { type ImgHTMLAttributes } from 'react'
import { useBlobImage } from '@/hooks/useBlobImage'

export function SafeImage(props: ImgHTMLAttributes<HTMLImageElement>) {
  const blobSrc = useBlobImage(props.src)
  return <img {...props} src={blobSrc} loading="lazy" />
}
