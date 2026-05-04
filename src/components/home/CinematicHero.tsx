import Image from 'next/image'
import { getTranslations, getLocale } from 'next-intl/server'
import CinematicButton from '@/components/ui/CinematicButton'
import HeroAnimationsLoader from './HeroAnimationsLoader'

export default async function CinematicHero() {
  const locale = await getLocale() as 'ar' | 'en'
  const isRTL = locale === 'ar'
  const t = await getTranslations('home.hero')

  // h-screen (100vh) instead of 100svh: svh recalculates on mobile browser
  // chrome resize, causing CLS. 100vh is stable on all tested devices.
  return (
    <section className="relative h-screen w-full overflow-hidden flex items-end pb-20 sm:pb-32 px-6 sm:px-16">
      {/* LCP image: priority + fetchPriority ensure early browser discovery */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/assets/hero/hero-poster.webp"
          alt={t('visualAlt')}
          fill
          priority
          fetchPriority="high"
          decoding="sync"
          quality={75}
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-black via-brand-black/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-black/40 via-transparent to-transparent" />
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto text-start">
        <p className="hero-eyebrow font-satoshi text-brand-gold text-xs sm:text-sm font-bold tracking-[0.3em] uppercase mb-6 opacity-80">
          {t('eyebrow')}
        </p>

        <h1 className="mb-4 leading-[0.9] flex flex-col">
          <span className={`hero-title-part-1 text-4xl sm:text-7xl font-bold text-brand-text ${isRTL ? 'font-cairo' : 'font-editorial'}`}>
            {t('titlePart1')}
          </span>
          <span className={`hero-title-part-2 text-3xl sm:text-6xl font-bold text-brand-gold mt-2 ${isRTL ? 'font-cairo' : 'font-editorial italic'}`}>
            {t('titlePart2')}
          </span>
        </h1>

        {/* Geo-intent prose: SSR-visible for AI crawlers and passage indexing */}
        <p className={`hero-desc text-brand-text/70 text-sm leading-relaxed mb-4 max-w-lg ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
          {isRTL
            ? 'مطعم عراقي أصيل في البحرين منذ 2018 — فرعان في الرفاع وقلالي. مسگوف مشوي على الفحم، قوزي، مشاوي بغدادية، وإفطار عراقي تراثي.'
            : 'Authentic Iraqi restaurant in Bahrain since 2018 — branches in Riffa and Qallali. Charcoal Masgouf, Quzi, Iraqi grills, and Baghdadi breakfast.'}
        </p>

        {/* Trust signal: GBP rating rendered visibly for E-E-A-T and SXO */}
        <p className="hero-trust text-brand-gold/60 text-xs font-bold tracking-wider mb-6">
          {isRTL ? '★★★★★ ٤٫٥ — ١٥٣١+ تقييم جوجل · منذ ٢٠١٨' : '★★★★★ 4.5 — 1,531+ Google Reviews · Since 2018'}
        </p>

        <div className="hero-cta flex flex-wrap gap-4 justify-start">
          <CinematicButton href="/menu" isRTL={isRTL} className="px-8 py-4 font-bold rounded-full">
            {t('orderNow')}
          </CinematicButton>
          <CinematicButton href={isRTL ? '/branches' : '/en/branches'} isRTL={isRTL} variant="secondary" showIcon={false} className="px-8 py-4 font-bold rounded-full">
            {t('branches')}
          </CinematicButton>
        </div>
      </div>

      {/* GSAP animations: loaded lazily via HeroAnimationsLoader (ssr:false dynamic) */}
      <HeroAnimationsLoader />

      <div className="absolute bottom-10 start-1/2 -translate-x-1/2 flex flex-col items-center gap-4 opacity-50">
        <span className="text-[10px] font-bold tracking-widest uppercase text-brand-gold [writing-mode:vertical-rl]">
          {t('scrollDown')}
        </span>
        <div className="w-px h-12 bg-gradient-to-b from-brand-gold to-transparent" />
      </div>
    </section>
  )
}
