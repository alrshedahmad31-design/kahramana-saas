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
        defaults: { ease: 'power3.out', duration: 1.2 },
        onComplete: () => {
          gsap.set(targets, { willChange: 'auto', clearProps: 'willChange' })
        },
      })
      tl.to('.hero-eyebrow',          { opacity: 1, y: 0, delay: 0.2 }, 0)
      tl.fromTo('.hero-title-part-1', { y: 40, opacity: 0 }, { y: 0, opacity: 1 }, 0.3)
      tl.fromTo('.hero-title-part-2', { scale: 0.95, opacity: 0 }, { scale: 1, opacity: 1 }, 0.6)
      tl.to('.hero-cta',              { opacity: 1, y: 0 }, 0.7)
    })

    return () => ctx.revert()
  }, [])

  return null
}
