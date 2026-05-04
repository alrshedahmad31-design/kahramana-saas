'use client'

import { useEffect } from 'react'
import gsap from 'gsap'

// Initial opacity:0 is set via CSS in globals.css (.hero-eyebrow, etc.)
// so this component no longer needs to call gsap.set() synchronously before paint.
// Loaded as a dynamic import (ssr: false) to keep GSAP out of the critical bundle.
export default function HeroAnimations() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const targets = ['.hero-eyebrow', '.hero-title-part-1', '.hero-title-part-2', '.hero-cta']

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: 'power3.out', duration: 0.9 },
        onComplete: () => {
          gsap.set(targets, { willChange: 'auto', clearProps: 'willChange' })
        },
      })
      // Titles: y-only — opacity is NOT animated so LCP fires at FCP regardless of GSAP timing
      tl.to('.hero-title-part-1', { y: 0 }, 0)
      tl.to('.hero-title-part-2', { y: 0 }, 0.1)
      // Eyebrow + CTA: small elements, opacity fade is fine
      tl.to('.hero-eyebrow', { opacity: 1 }, 0.2)
      tl.to('.hero-cta',     { opacity: 1, y: 0 }, 0.3)
    })

    return () => ctx.revert()
  }, [])

  return null
}
