'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useLocale, useTranslations } from 'next-intl'
import CinematicButton from '@/components/ui/CinematicButton'

gsap.registerPlugin(ScrollTrigger)

export default function CinematicHero() {
  const locale = useLocale()
  const isRTL = locale === 'ar'
  const t = useTranslations('home.hero')
  const containerRef = useRef<HTMLDivElement>(null)
  const mediaRef     = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Parallax on wrapper containing both Image and Video
      gsap.to(mediaRef.current, {
        y: '20%',
        ease: 'none',
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      })

      // Staggered text reveals
      const tl = gsap.timeline({ defaults: { ease: 'power3.out', duration: 1.2 } })

      tl.from('.hero-eyebrow', { opacity: 0, y: 20, delay: 0.5 })
        .from('.hero-title-part-1', { opacity: 0, y: 40, stagger: 0.1 }, '-=0.8')
        .from('.hero-title-part-2', { opacity: 0, scale: 0.95, filter: 'blur(10px)' }, '-=0.6')
        .from('.hero-cta', { opacity: 0, y: 20, stagger: 0.1 }, '-=0.8')
    }, containerRef)

    return () => ctx.revert()
  }, [])

  return (
    <section
      ref={containerRef}
      className="relative h-[100dvh] w-full overflow-hidden flex items-end pb-20 sm:pb-32 px-6 sm:px-16"
    >
      {/* Background Media */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        {/*
          mediaRef wrapper: Image + Video scale together for parallax.
          scale-110 provides buffer so edges don't show during y:20% translation.
        */}
        <div ref={mediaRef} className="absolute inset-0 scale-110">
          {/*
            Next.js Image as LCP element:
            - priority → <link rel="preload"> injected into <head> during SSR
            - fill + sizes → serves ~750px WebP to mobile instead of 186KB full poster
            - quality={85} → optimal compression/quality balance
          */}
          <Image
            src="/assets/hero/hero-poster.webp"
            alt=""
            fill
            priority
            quality={85}
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 100vw, 1920px"
            className="object-cover"
          />

          {/* Video overlays Image once loaded — no poster needed since Image handles visual */}
          <video
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          >
            <source src="/assets/hero/hero-menu.mp4" type="video/mp4" />
          </video>
        </div>

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-brand-black via-brand-black/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-black/40 via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-7xl mx-auto text-start">
        <p className="hero-eyebrow font-satoshi text-brand-gold text-xs sm:text-sm font-bold tracking-[0.3em] uppercase mb-6 opacity-80">
          {t('eyebrow')}
        </p>

        <h1 className="mb-10 leading-[0.9] flex flex-col">
          <span
            className={`
              hero-title-part-1 text-5xl sm:text-8xl font-bold text-brand-text
              ${isRTL ? 'font-cairo' : 'font-editorial'}
            `}
          >
            {t('titlePart1')}
          </span>
          <span
            className={`
              hero-title-part-2 text-7xl sm:text-[12rem] font-bold text-brand-gold mt-2
              ${isRTL ? 'font-cairo' : 'font-editorial italic'}
            `}
          >
            {t('titlePart2')}
          </span>
        </h1>

        <div className="hero-cta flex flex-wrap gap-4 justify-start">
          <CinematicButton
            href="/menu"
            isRTL={isRTL}
            className="px-8 py-4 font-bold rounded-full"
          >
            {t('orderNow')}
          </CinematicButton>
          <CinematicButton
            href="/branches"
            isRTL={isRTL}
            variant="secondary"
            showIcon={false}
            className="px-8 py-4 font-bold rounded-full"
          >
            {t('branches')}
          </CinematicButton>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 opacity-50">
        <span className="text-[10px] font-bold tracking-widest uppercase text-brand-gold [writing-mode:vertical-rl]">
          {t('scrollDown')}
        </span>
        <div className="w-px h-12 bg-gradient-to-b from-brand-gold to-transparent" />
      </div>
    </section>
  )
}
