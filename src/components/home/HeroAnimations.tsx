'use client'

import { useEffect } from 'react'
import gsap from 'gsap'

export default function HeroAnimations() {
  useEffect(() => {
    let ctx: ReturnType<typeof gsap.context> | null = null
    const timer = setTimeout(() => {
      ctx = gsap.context(() => {
        const tl = gsap.timeline({ defaults: { ease: 'power3.out', duration: 1.2 } })
        tl.from('.hero-eyebrow', { opacity: 0, y: 20, delay: 0.2 })
        tl.from('.hero-title-part-1', { y: 40, stagger: 0.1 }, '-=0.8')
        tl.from('.hero-title-part-2', { scale: 0.95 }, '-=0.6')
        tl.from('.hero-cta', { opacity: 0, y: 20, stagger: 0.1 }, '-=0.8')
      })
    }, 100)
    return () => {
      clearTimeout(timer)
      ctx?.revert()
    }
  }, [])

  return null
}
