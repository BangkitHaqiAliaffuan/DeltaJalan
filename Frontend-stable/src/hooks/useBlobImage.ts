import { useState, useEffect, useRef } from 'react'
import { Capacitor, CapacitorHttp } from '@capacitor/core'
import { getToken } from '@/lib/auth'

const isNative = Capacitor.isNativePlatform?.() === true

const MAX_RETRIES = 3
const BASE_DELAY_MS = 2_000

function jitter(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function isProbablyBase64(s: string): boolean {
  if (s.length < 20) return false
  return /^[A-Za-z0-9+/=]+$/.test(s.substring(0, 100))
}

function decodeToBlob(data: string): Blob | null {
  let raw: string
  let mime = ''

  const comma = data.indexOf(',')

  if (comma !== -1) {
    const header = data.slice(0, comma)
    const match = header.match(/^data:\s*([^;]+)/)
    if (match) mime = match[1]
    raw = data.slice(comma + 1)
  } else if (isProbablyBase64(data)) {
    raw = data
  } else {
    raw = data
  }

  try {
    const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0))
    return new Blob([bytes], { type: mime || 'image/jpeg' })
  } catch {
    return null
  }
}

async function fetchBlobWithRetry(url: string, checkCancelled: () => boolean): Promise<string | null> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (checkCancelled()) return null
    try {
      const token = getToken()
      const res = await CapacitorHttp.get({
        url,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        responseType: 'blob',
        connectTimeout: 10_000,
        readTimeout: 30_000,
      })
      const data = res.data as string
      const blob = decodeToBlob(data)
      if (!blob) continue
      const blobUrl = URL.createObjectURL(blob)
      return blobUrl
    } catch {
      if (attempt < MAX_RETRIES && !checkCancelled()) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt) + jitter(0, 1_000)
        await new Promise((r) => setTimeout(r, delay))
      }
    }
  }
  return null
}

export function useBlobImage(src: string | undefined): string | undefined {
  // isNative adalah konstanta module-level, tidak berubah antar render —
  // aman digunakan sebagai kondisi tanpa melanggar rules of hooks.
  const [blobUrl, setBlobUrl] = useState<string | undefined>(isNative ? undefined : src)
  const prevUrlRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (!src) { setBlobUrl(undefined); return }
    if (!isNative) { setBlobUrl(src); return }

    let cancelled = false
    const isCancelled = () => cancelled

    ;(async () => {
      const result = await fetchBlobWithRetry(src, isCancelled)
      if (cancelled) return

      if (result) {
        if (prevUrlRef.current?.startsWith('blob:')) URL.revokeObjectURL(prevUrlRef.current)
        prevUrlRef.current = result
        setBlobUrl(result)
      } else if (!cancelled) {
        setBlobUrl(src)
      }
    })()

    return () => { cancelled = true }
  }, [src])

  useEffect(() => {
    return () => {
      if (prevUrlRef.current?.startsWith('blob:')) URL.revokeObjectURL(prevUrlRef.current)
    }
  }, [])

  // Browser: return src langsung dari parameter, hindari stale 1-frame state
  if (!isNative) return src

  return blobUrl
}
