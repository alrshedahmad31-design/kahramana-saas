import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'

export default function CateringHero() {
  const t = useTranslations('catering.hero')
  const locale = useLocale()
  const isAr = locale === 'ar'
  const visualItems = ['family', 'corporate', 'feasts', 'home'] as const

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(209,159,81,0.18),transparent_34%),linear-gradient(180deg,rgba(17,11,5,0),rgba(17,11,5,1))]" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-14 md:pt-20 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-[1.02fr_0.98fr] gap-10 lg:gap-14 items-center">
          <div className="text-center">
            <p className="section-subtitle">
              {t('eyebrow')}
            </p>
            <h1 className={`section-title mx-auto max-w-3xl ${isAr ? 'font-cairo' : 'font-editorial'}`}>
              {t('title')}
            </h1>
            <p className={`mt-6 mx-auto max-w-2xl text-base sm:text-lg leading-8 text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {t('description')}
            </p>

            <div className="mt-9 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-center">
              <a
                href="#catering-inquiry"
                aria-label={t('primaryCta')}
                className="inline-flex min-h-12 items-center justify-center rounded-lg bg-brand-gold px-6 py-3 text-sm font-bold text-brand-black shadow-[0_20px_50px_rgba(209,159,81,0.18)] transition-transform duration-200 hover:scale-[1.02]"
              >
                {t('primaryCta')}
              </a>
              <Link
                href="/menu"
                aria-label={t('secondaryCta')}
                className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/10 px-6 py-3 text-sm font-bold text-brand-text transition-colors duration-200 hover:border-brand-gold hover:text-brand-gold"
              >
                {t('secondaryCta')}
              </Link>
            </div>

            <p className={`mt-5 mx-auto max-w-xl text-xs leading-6 text-brand-muted/80 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {t('microcopy')}
            </p>
          </div>

          <div className="relative">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] border border-brand-border bg-brand-surface">
              <video
                src="/assets/hero/hero-catering.mp4"
                poster="/assets/catering/hero-catering.webp"
                autoPlay
                loop
                muted
                playsInline
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-brand-black via-brand-black/20 to-transparent" />
              <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/10 bg-brand-black/60 p-4 backdrop-blur-xl sm:inset-x-6 sm:bottom-6 sm:p-5 shadow-2xl">
                <p className="text-[10px] font-satoshi font-bold uppercase tracking-[0.32em] text-brand-gold/90">
                  {t('visualLabel')}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {visualItems.map((item) => (
                    <span
                      key={item}
                      className={`rounded-lg border border-white/5 bg-white/[0.05] px-3 py-2.5 text-[11px] font-medium text-brand-text/90 backdrop-blur-md transition-colors duration-300 hover:bg-white/[0.08] ${isAr ? 'font-almarai' : 'font-satoshi'}`}
                    >
                      {t(`visualItems.${item}`)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="absolute -bottom-6 -start-4 hidden w-32 rounded-2xl border border-brand-gold/30 bg-brand-gold/10 px-4 py-5 text-center backdrop-blur-md sm:block">
              <span className="block text-4xl font-satoshi font-light text-brand-gold">01</span>
              <span className={`mt-1 block text-xs text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                {t('consultationBadge')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
