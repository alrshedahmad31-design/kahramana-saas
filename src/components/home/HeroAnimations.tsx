'use client'

import { useEffect } from 'react'
import gsap from 'gsap'

// CLS fix: set initial states synchronously so the browser never paints
// SSR-visible elements and then snaps them to the GSAP "from" values.
// That snap was the source of CLS 0.151.
export default function HeroAnimations() {
  useEffect(() => {
    const targets = ['.hero-eyebrow', '.hero-title-part-1', '.hero-title-part-2', '.hero-cta']

    // Hide elements immediately before first client paint to prevent flicker
    gsap.set(targets, { opacity: 0, willChange: 'transform, opacity' })

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: 'power3.out', duration: 1.2 },
        onComplete: () => {
          // Release compositing layers once animation is done
          gsap.set(targets, { willChange: 'auto', clearProps: 'willChange' })
        },
      })
      tl.to('.hero-eyebrow',     { opacity: 1, y: 0, delay: 0.2 }, 0)
      tl.fromTo('.hero-title-part-1', { y: 40, opacity: 0 }, { y: 0, opacity: 1 }, 0.3)
      tl.fromTo('.hero-title-part-2', { scale: 0.95, opacity: 0 }, { scale: 1, opacity: 1 }, 0.6)
      tl.to('.hero-cta',         { opacity: 1, y: 0 }, 0.7)
    })

    return () => ctx.revert()
  }, [])

  return null
}
