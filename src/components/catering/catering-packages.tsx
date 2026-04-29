import { useLocale, useTranslations } from 'next-intl'
import { CATERING_REQUEST_STYLES } from '@/lib/catering'

export default function CateringPackages() {
  const t = useTranslations('catering.styles')
  const locale = useLocale()
  const isAr = locale === 'ar'

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
      <div className="flex flex-col gap-3 text-start">
        <p className="text-xs font-satoshi font-bold tracking-[0.3em] uppercase text-brand-gold">
          {t('eyebrow')}
        </p>
        <h2 className={`text-3xl sm:text-5xl font-black text-brand-text ${isAr ? 'font-cairo' : 'font-editorial'}`}>
          {t('title')}
        </h2>
      </div>

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-5">
        {CATERING_REQUEST_STYLES.map((style, index) => (
          <article key={style} className="rounded-2xl border border-brand-border bg-brand-surface p-6">
            <span className="font-satoshi text-5xl font-light text-brand-gold/35">
              {String(index + 1).padStart(2, '0')}
            </span>
            <h3 className={`mt-7 text-2xl font-black text-brand-text ${isAr ? 'font-cairo' : 'font-editorial'}`}>
              {t(`items.${style}.title`)}
            </h3>
            <p className={`mt-4 min-h-28 text-sm leading-7 text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {t(`items.${style}.description`)}
            </p>
            <a
              href="#catering-inquiry"
              aria-label={t(`items.${style}.cta`)}
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg border border-brand-gold/40 px-5 py-3 text-sm font-bold text-brand-gold transition-colors duration-200 hover:bg-brand-gold hover:text-brand-black"
            >
              {t(`items.${style}.cta`)}
            </a>
          </article>
        ))}
      </div>

      <div className={`mt-6 rounded-2xl border border-brand-gold/25 bg-brand-gold/10 px-5 py-4 text-sm leading-7 text-brand-gold-light ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
        {t('note')}
      </div>
    </section>
  )
}
