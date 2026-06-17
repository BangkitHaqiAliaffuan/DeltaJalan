import { useEffect, useRef } from 'react'
import { getToken } from '@/lib/auth'

const isNative =
  typeof window !== 'undefined' &&
  (window as any).Capacitor !== undefined &&
  (window as any).Capacitor.isNativePlatform?.() === true

const apiBase = (import.meta.env.VITE_API_BASE_URL ?? 'http://10.0.2.2:8080/api').replace(/\/+$/, '')

async function sendTokenToBackend(fcmToken: string) {
  const authToken = getToken()
  if (!authToken) return

  try {
    const res = await fetch(`${apiBase}/push/fcm-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
        Accept: 'application/json',
      },
      body: JSON.stringify({ fcm_token: fcmToken, device_info: { platform: 'android' } }),
    })
    if (!res.ok) {
      console.warn('[FCM] Failed to save token to backend:', res.status)
    }
  } catch (err) {
    console.warn('[FCM] Error saving token to backend:', err)
  }
}

async function removeTokenFromBackend(fcmToken: string) {
  const authToken = getToken()
  if (!authToken) return

  try {
    await fetch(`${apiBase}/push/fcm-token`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
        Accept: 'application/json',
      },
      body: JSON.stringify({ fcm_token: fcmToken }),
    })
  } catch {
  }
}

export function useFcmRegistration() {
  const fcmTokenRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isNative) return

    let removeListeners: (() => void) | null = null

    async function init() {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications')

        await PushNotifications.createChannel({
          id: 'delta_jalan_general',
          name: 'DeltaJalan',
          description: 'Notifikasi laporan dan tugas DeltaJalan',
          importance: 4,
          visibility: 1,
          sound: 'default',
          vibration: true,
          lights: true,
        }).catch(() => {})

        await PushNotifications.addListener('registration', (token) => {
          fcmTokenRef.current = token.value
          sendTokenToBackend(token.value)
        })

        await PushNotifications.addListener('registrationError', (err) => {
          console.warn('[FCM] Registration error:', err.error)
        })

        await PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('[FCM] Received:', notification)
        })

        await PushNotifications.addListener('pushNotificationActionPerformed', () => {
        })

        removeListeners = () => {
          PushNotifications.removeAllListeners()
        }

        const permStatus = await PushNotifications.checkPermissions()
        if (permStatus.receive === 'prompt') {
          const result = await PushNotifications.requestPermissions()
          if (result.receive !== 'granted') return
        } else if (permStatus.receive !== 'granted') {
          return
        }

        await PushNotifications.register()
      } catch (err) {
        console.warn('[FCM] Init error:', err)
      }
    }

    init()

    return () => {
      removeListeners?.()
    }
  }, [])

  useEffect(() => {
    if (!isNative) return

    const handleLogout = () => {
      const token = fcmTokenRef.current
      if (token) {
        removeTokenFromBackend(token)
      }
    }

    window.addEventListener('auth:logout', handleLogout)
    return () => window.removeEventListener('auth:logout', handleLogout)
  }, [])
}
