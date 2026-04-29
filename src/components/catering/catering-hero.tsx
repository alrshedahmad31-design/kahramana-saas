import Image from 'next/image'
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
          <div className="text-start">
            <p className="text-xs font-satoshi font-bold tracking-[0.34em] uppercase text-brand-gold">
              {t('eyebrow')}
            </p>
            <h1 className={`mt-5 max-w-3xl text-4xl sm:text-5xl lg:text-7xl font-black leading-[1.05] text-brand-text ${isAr ? 'font-cairo' : 'font-editorial'}`}>
              {t('title')}
            </h1>
            <p className={`mt-6 max-w-2xl text-base sm:text-lg leading-8 text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {t('description')}
            </p>

            <div className="mt-9 flex flex-col sm:flex-row gap-3 sm:items-center">
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

            <p className={`mt-5 max-w-xl text-xs leading-6 text-brand-muted/80 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {t('microcopy')}
            </p>
          </div>

          <div className="relative">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] border border-brand-border bg-brand-surface">
              <Image
                src="/assets/catering/wedding.webp"
                alt={t('visualAlt')}
                fill
                priority
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 48vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-brand-black via-brand-black/20 to-transparent" />
              <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/10 bg-brand-black/70 p-4 backdrop-blur-md sm:inset-x-6 sm:bottom-6 sm:p-5">
                <p className="text-[10px] font-satoshi font-bold uppercase tracking-[0.28em] text-brand-gold">
                  {t('visualLabel')}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {visualItems.map((item) => (
                    <span
                      key={item}
                      className={`rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-brand-text ${isAr ? 'font-almarai' : 'font-satoshi'}`}
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
