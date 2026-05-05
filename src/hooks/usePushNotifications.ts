/**
 * usePushNotifications
 *
 * Handles the full Web Push subscription lifecycle for drivers:
 *  1. Requests notification permission from the browser.
 *  2. Subscribes to the service worker's push manager using the VAPID public key.
 *  3. Persists the subscription in Supabase via `savePushSubscription`.
 *  4. Provides `requestPermission()` that can be triggered by a button.
 *
 * Usage:
 *   const { permissionState, requestPermission } = usePushNotifications()
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import { savePushSubscription } from '@/app/[locale]/driver/push-actions'

type PermissionState = 'unsupported' | 'default' | 'granted' | 'denied'

interface UsePushNotificationsResult {
  permissionState: PermissionState
  requestPermission: () => Promise<void>
}

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding  = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64   = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData  = atob(base64)
  const buffer   = new ArrayBuffer(rawData.length)
  const view     = new Uint8Array(buffer)
  for (let i = 0; i < rawData.length; i++) view[i] = rawData.charCodeAt(i)
  return buffer
}

export function usePushNotifications(): UsePushNotificationsResult {
  const [permissionState, setPermissionState] = useState<PermissionState>('default')

  // Check initial state
  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setPermissionState('unsupported')
      return
    }
    setPermissionState(Notification.permission as PermissionState)
  }, [])

  const subscribe = useCallback(async (registration: ServiceWorkerRegistration) => {
    if (!VAPID_PUBLIC_KEY) {
      console.warn('[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY not set')
      return
    }

    try {
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      const json = sub.toJSON()
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return

      await savePushSubscription({
        endpoint:  json.endpoint,
        keys:      { p256dh: json.keys.p256dh, auth: json.keys.auth },
        userAgent: navigator.userAgent,
      })
    } catch (err) {
      console.error('[push] subscribe failed:', err)
    }
  }, [])

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return

    const result = await Notification.requestPermission()
    setPermissionState(result as PermissionState)

    if (result !== 'granted') return

    const registration = await navigator.serviceWorker.ready
    await subscribe(registration)
  }, [subscribe])

  // Auto-subscribe if permission was already granted (e.g. returning user)
  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      Notification.permission !== 'granted'
    ) return

    navigator.serviceWorker.ready.then(subscribe)
  }, [subscribe])

  return { permissionState, requestPermission }
}
