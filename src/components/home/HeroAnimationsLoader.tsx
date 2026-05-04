'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

// ssr: false is valid here because this is a Client Component.
// The dynamic import keeps GSAP (~30KB) out of the initial JS bundle;
// HeroAnimations loads lazily after hydration and is excluded from SSR.
const HeroAnimations = dynamic(() => import('./HeroAnimations'), { ssr: false })

export default function HeroAnimationsLoader() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const start = () => setEnabled(true)

    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(start, { timeout: 1800 })
      return () => window.cancelIdleCallback(idleId)
    }

    const timer = globalThis.setTimeout(start, 1200)
    return () => globalThis.clearTimeout(timer)
  }, [])

  if (!enabled) return null

  return <HeroAnimations />
}
