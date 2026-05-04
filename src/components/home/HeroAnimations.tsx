'use client'

import { useEffect } from 'react'
import gsap from 'gsap'

// Initial opacity:0 is set via CSS in globals.css (.hero-eyebrow, etc.)
// so this component no longer needs to call gsap.set() synchronously before paint.
// Loaded as a dynamic import (ssr: false) to keep GSAP out of the critical bundle.
export default function HeroAnimations() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    // Titles are NOT animated — any JS-animated property on the LCP element
    // causes Chrome to defer LCP to animation completion. Eyebrow + CTA are
    // small non-LCP elements and animate fine.
    const targets = ['.hero-eyebrow', '.hero-cta']

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: 'power3.out', duration: 0.9 },
        onComplete: () => {
          gsap.set(targets, { willChange: 'auto', clearProps: 'willChange' })
        },
      })
      tl.to('.hero-eyebrow', { opacity: 0.8 }, 0.2)
      tl.to('.hero-cta',     { opacity: 1, y: 0 }, 0.4)
    })

    return () => ctx.revert()
  }, [])

  return null
}
