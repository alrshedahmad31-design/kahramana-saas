'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export default function AboutReveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = ref.current
    if (!container) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    // Pass the DOM element (not the RefObject) as the gsap.context scope
    const ctx = gsap.context(() => {
      const sections = Array.from(container.querySelectorAll<HTMLElement>('section'))

      gsap.set(sections, { opacity: 0, y: 40 })

      sections.forEach((section) => {
        gsap.to(section, {
          opacity: 1,
          y: 0,
          duration: 0.85,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: section,
            start: 'top 82%',
            once: true,
          },
        })
      })
    }, container)

    return () => ctx.revert()
  }, [])

  return <div ref={ref}>{children}</div>
}
