'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { playBell } from '@/lib/audio/bells'

// Persistent looping alert for KDS — rings every INTERVAL_MS until stopped.
// Pass in mutedRef from useAudioAlert so mute state stays shared.
const INTERVAL_MS = 6_000

export function useKitchenAlert(mutedRef: React.MutableRefObject<boolean>) {
  const [isAlerting, setIsAlerting]   = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startAlert = useCallback(() => {
    if (intervalRef.current) return // already looping
    setIsAlerting(true)
    if (!mutedRef.current) playBell('new')
    intervalRef.current = setInterval(() => {
      if (!mutedRef.current) playBell('new')
    }, INTERVAL_MS)
  }, [mutedRef])

  const stopAlert = useCallback(() => {
    setIsAlerting(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  // Clean up on unmount
  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
  }, [])

  return { startAlert, stopAlert, isAlerting }
}
