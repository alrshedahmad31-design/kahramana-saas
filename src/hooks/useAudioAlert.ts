'use client'

import { useCallback, useRef, useState } from 'react'
import { playBell, type BellType } from '@/lib/audio/bells'

export function useAudioAlert() {
  const [isMuted, setIsMuted] = useState(false)
  // Ref keeps the mute state readable inside stale callbacks (useCallback deps)
  const mutedRef = useRef(false)

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      mutedRef.current = !prev
      return !prev
    })
  }, [])

  // Stable function — safe to call inside useCallback without adding to deps
  const alert = useCallback((type: BellType = 'new') => {
    if (!mutedRef.current) playBell(type)
  }, [])

  return { alert, toggleMute, isMuted, mutedRef }
}
