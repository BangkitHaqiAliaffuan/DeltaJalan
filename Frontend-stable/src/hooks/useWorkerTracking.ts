import { useCallback, useEffect, useRef } from 'react'
import { getCurrentUser, getToken } from '@/lib/auth'

const isNative =
  typeof window !== 'undefined' &&
  (window as any).Capacitor !== undefined &&
  (window as any).Capacitor.isNativePlatform?.() === true

const apiBase = (import.meta.env.VITE_API_BASE_URL ?? 'http://10.0.2.2:8080/api').replace(/\/+$/, '')

const INTERVAL_MS = 15 * 60 * 1000
const WORK_START = '07:30'
const WORK_END = '16:00'

function isWorkHours(): boolean {
  const now = new Date()
  const h = now.getHours().toString().padStart(2, '0')
  const m = now.getMinutes().toString().padStart(2, '0')
  const cur = `${h}:${m}`
  return cur >= WORK_START && cur < WORK_END
}

async function sendLocation(): Promise<boolean> {
  const user = getCurrentUser()
  const token = getToken()
  if (!user || !token || user.role !== 'petugas_eksekusi') return false
  if (!isWorkHours()) return false

  try {
    const { Geolocation } = await import('@capacitor/geolocation')
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
    })

    const lat = pos.coords.latitude
    const lng = pos.coords.longitude
    const battery = pos.coords.accuracy !== undefined ? undefined : undefined
    const now = new Date()
    const trackedAt =
      now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0') + ' ' +
      String(now.getHours()).padStart(2, '0') + ':' +
      String(now.getMinutes()).padStart(2, '0') + ':' +
      String(now.getSeconds()).padStart(2, '0')

    const res = await fetch(`${apiBase}/worker/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      body: JSON.stringify({
        latitude: lat,
        longitude: lng,
        tracked_at: trackedAt,
      }),
    })
    return res.ok
  } catch (err) {
    console.warn('[WorkerTracking] Failed to send location:', err)
    return false
  }
}

export function useWorkerTracking() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startTracking = useCallback(() => {
    if (intervalRef.current) return
    sendLocation()
    intervalRef.current = setInterval(sendLocation, INTERVAL_MS)
  }, [])

  const stopTracking = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!isNative) return

    const user = getCurrentUser()
    if (user?.role !== 'petugas_eksekusi') return

    let removeListeners: (() => void) | null = null

    async function init() {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications')

        const listenerHandle = await PushNotifications.addListener(
          'pushNotificationReceived',
          (notification) => {
            const data = notification.data as Record<string, string> | undefined
            if (data?.type === 'gps_reminder') {
              if (data.action === 'start') {
                startTracking()
              } else if (data.action === 'stop') {
                stopTracking()
              }
            }
          },
        )

        removeListeners = () => {
          listenerHandle.remove()
        }
      } catch {
      }
    }

    init()

    if (isWorkHours()) {
      startTracking()
    }

    return () => {
      removeListeners?.()
      stopTracking()
    }
  }, [startTracking, stopTracking])
}
