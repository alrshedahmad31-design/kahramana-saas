'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Image from 'next/image'

gsap.registerPlugin(ScrollTrigger)

interface Props {
  eyebrow: string
  title: string
  description: string
  imageAlt: string
  isAr: boolean
}

export default function ContactHero({ eyebrow, title, description, imageAlt, isAr }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const heroTextRef = useRef<HTMLDivElement>(null)
  const bgRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Parallax effect
      gsap.to(bgRef.current, {
        yPercent: 30,
        ease: 'none',
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      })

      // Text entrance
      const tl = gsap.timeline()
      tl.from('.hero-eyebrow', {
        y: 20,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
      })
      .from('.hero-title', {
        y: 40,
        opacity: 0,
        duration: 1,
        ease: 'power4.out',
      }, '-=0.5')
      .from('.hero-description', {
        y: 20,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
      }, '-=0.6')
    }, containerRef.current || undefined)

    return () => ctx.revert()
  }, [])

  return (
    <div 
      ref={containerRef}
      className="relative h-[60vh] min-h-[500px] w-full overflow-hidden flex items-center justify-center pt-20"
    >
      {/* Background with cinematic texture */}
      <div ref={bgRef} className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-brand-black/70 z-10" />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-black/40 via-transparent to-brand-black z-20" />
        
        <div className="relative w-full h-[120%] -top-[10%]">
           <Image
            src="/assets/hero/hero-contact.webp"
            alt={imageAlt}
            fill
            sizes="100vw"
            className="object-cover opacity-60 contrast-125"
            priority
          />
        </div>
        
        {/* Mesopotamian Pattern Overlay */}
        <div className="absolute inset-0 z-15 opacity-[0.03] pointer-events-none bg-[url('/assets/patterns/stardust.png')] bg-repeat" />
      </div>

      {/* Content */}
      <div className="container relative z-30 px-6 sm:px-16 text-center">
        <div ref={heroTextRef} className="max-w-4xl mx-auto">
          <span className={`hero-eyebrow block text-brand-gold text-sm font-black tracking-[0.3em] uppercase mb-6 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {eyebrow}
          </span>
          <h1 className={`hero-title text-5xl sm:text-7xl font-black text-brand-text mb-8 leading-tight ${isAr ? 'font-cairo' : 'font-editorial'}`}>
            {title}
          </h1>
          <p className={`hero-description text-brand-muted text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {description}
          </p>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-brand-black to-transparent z-40" />
    </div>
  )
}
