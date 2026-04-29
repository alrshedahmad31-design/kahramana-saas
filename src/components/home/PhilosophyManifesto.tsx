'use client'

import { useEffect, useRef } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export default function PhilosophyManifesto() {
  const locale = useLocale()
  const isRTL = locale === 'ar'
  const t = useTranslations('home.philosophy')
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      const words = gsap.utils.toArray('.reveal-word')
      
      gsap.from(words, {
        opacity: 0.1,
        y: 20,
        stagger: 0.05,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 70%',
          end: 'bottom 40%',
          scrub: true,
        }
      })
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  const standard = t('standard')
  const kahramana = t('kahramana')

  return (
    <section 
      ref={sectionRef}
      className="py-32 px-6 sm:px-16 bg-brand-black relative overflow-hidden flex flex-col items-center text-center"
    >
      {/* Background Texture */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute inset-0 bg-[url('/assets/hero/hero-poster.webp')] bg-cover bg-center grayscale" />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-black via-transparent to-brand-black" />
      </div>

      <div className="relative z-10 max-w-4xl">
        <p className="font-satoshi text-xs sm:text-sm font-bold tracking-[0.3em] uppercase text-brand-muted mb-12">
          {t('eyebrow')}
        </p>

        <h2 className="flex flex-col gap-8 sm:gap-16">
          <span className="text-xl sm:text-3xl text-brand-muted opacity-80 leading-relaxed max-w-2xl mx-auto">
            {standard.split(' ').map((word, i) => (
              <span key={i} className="reveal-word inline-block mx-1">{word}</span>
            ))}
          </span>
          
          <span 
            className={`
              text-4xl sm:text-7xl font-bold text-brand-gold leading-[1.1]
              ${isRTL ? 'font-cairo' : 'font-editorial italic'}
            `}
          >
            {kahramana.split(' ').map((word, i) => (
              <span key={i} className="reveal-word inline-block mx-1">{word}</span>
            ))}
          </span>
        </h2>
      </div>
    </section>
  )
}
