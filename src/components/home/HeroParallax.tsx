'use client'

import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

// Forced reflow fix: register plugin lazily inside useEffect, not at module
// level. Top-level registerPlugin runs synchronously during JS evaluation and
// triggers layout reads (offsetWidth etc.) before the browser finishes painting.

export default function HeroParallax() {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)

    // Promote the image to its own compositor layer before ScrollTrigger
    // attaches -- prevents forced reflows on each scroll tick.
    const img = document.querySelector<HTMLElement>('.hero-image')
    if (img) img.style.willChange = 'transform'

    const ctx = gsap.context(() => {
      gsap.to('.hero-image', {
        y: '30%',
        ease: 'none',
        force3D: true,
        scrollTrigger: {
          trigger: '.hero-section',
          start: 'top top',
          end: 'bottom top',
          scrub: 1,
        },
      })
    })

    return () => {
      ctx.revert()
      if (img) img.style.willChange = 'auto'
    }
  }, [])

  return null
}
