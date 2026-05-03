'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useLocale, useTranslations } from 'next-intl'
import { DEFAULT_BRANCH } from '@/constants/contact'
import CinematicButton from '@/components/ui/CinematicButton'

gsap.registerPlugin(ScrollTrigger)

export default function CinematicHero() {
  const locale = useLocale() as 'ar' | 'en'
  const isRTL = locale === 'ar'
  const t = useTranslations('home.hero')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return;
    
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ 
        defaults: { ease: 'power3.out', duration: 1.2 } 
      });
      
      tl.from('.hero-eyebrow', { opacity: 0, y: 20, delay: 0.5 });
      // opacity removed from title — text stays visible for LCP even before JS runs
      tl.from('.hero-title-part-1', { y: 40, stagger: 0.1 }, '-=0.8');
      tl.from('.hero-title-part-2', { scale: 0.95, filter: 'blur(10px)' }, '-=0.6');
      tl.from('.hero-cta', { opacity: 0, y: 20, stagger: 0.1 }, '-=0.8');
    }, containerRef.current || undefined);

    return () => ctx.revert();
  }, []);

  const waLink = `${DEFAULT_BRANCH.waLink}?text=${encodeURIComponent(t('waMessage'))}`

  return (
    <section 
      ref={containerRef}
      className="relative h-[100dvh] w-full overflow-hidden flex items-end pb-20 sm:pb-32 px-6 sm:px-16"
    >
      <div className="absolute inset-0 z-0">
        <Image
          src="/assets/hero/hero-poster.webp"
          alt={t('visualAlt')}
          fill
          priority
          fetchPriority="high"
          className="object-cover scale-110"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-black via-brand-black/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-black/40 via-transparent to-transparent" />
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto text-start">
        <p className="hero-eyebrow font-satoshi text-brand-gold text-xs sm:text-sm font-bold tracking-[0.3em] uppercase mb-6 opacity-80">
          {t('eyebrow')}
        </p>

        <h1 className="mb-10 leading-[0.9] flex flex-col">
          <span 
            className={`
              hero-title-part-1 text-4xl sm:text-7xl font-bold text-brand-text
              ${isRTL ? 'font-cairo' : 'font-editorial'}
            `}
          >
            {t('titlePart1')}
          </span>
          <span 
            className={`
              hero-title-part-2 text-3xl sm:text-6xl font-bold text-brand-gold mt-2
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
            href={waLink}
            isRTL={isRTL}
            variant="secondary"
            showIcon={false}
            className="px-8 py-4 font-bold rounded-full"
          >
            {t('branches')}
          </CinematicButton>
        </div>
      </div>

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 opacity-50">
        <span className="text-[10px] font-bold tracking-widest uppercase text-brand-gold [writing-mode:vertical-rl]">
          {t('scrollDown')}
        </span>
        <div className="w-px h-12 bg-gradient-to-b from-brand-gold to-transparent" />
      </div>
    </section>
  )
}
